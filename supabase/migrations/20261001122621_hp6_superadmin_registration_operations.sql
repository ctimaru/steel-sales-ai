-- HP6 — Superadmin Registration Operations.
--
-- Centralizes registration triage, lifecycle aging and identity-risk context,
-- and adds an atomic approve+activate operator shortcut.
-- Existing HP3 lifecycle rules, HP4 identity resolution and SA4 permissions
-- remain authoritative.

create or replace function private.hp6_registration_identity_summary(
  p_application_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_app public.company_registration_applications%rowtype;
  v_app_vat_key text;
  v_app_registration_key text;
  v_app_name_key text;
  v_app_domain text;
  v_blocking_count integer := 0;
  v_possible_count integer := 0;
  v_controlled_count integer := 0;
begin
  select *
  into v_app
  from public.company_registration_applications
  where id=p_application_id;

  if not found then
    raise exception 'registration application not found' using errcode='P0002';
  end if;

  v_app_vat_key := private.hp4_normalize_identifier(v_app.vat_id);
  v_app_registration_key := private.hp4_normalize_identifier(v_app.registration_id);
  v_app_name_key := private.hp4_company_name_key(v_app.legal_name);
  v_app_domain := private.hp4_normalize_domain(v_app.website_url);

  with candidate_base as (
    select
      nc.id,
      (
        nc.country_code=v_app.country_code
        and v_app_vat_key is not null
        and private.hp4_normalize_identifier(nc.vat_id)=v_app_vat_key
      ) as vat_match,
      (
        nc.country_code=v_app.country_code
        and v_app_registration_key is not null
        and private.hp4_normalize_identifier(nc.registration_id)=v_app_registration_key
      ) as registration_match,
      (
        nc.country_code=v_app.country_code
        and v_app_name_key is not null
        and private.hp4_company_name_key(nc.legal_name)=v_app_name_key
      ) as legal_name_match,
      (
        v_app_domain is not null
        and private.hp4_normalize_domain(nc.website_domain)=v_app_domain
      ) as domain_match,
      exists(
        select 1
        from public.organization_network_company_links l
        where l.network_company_id=nc.id
          and l.link_status='active'
      ) or exists(
        select 1
        from public.network_company_claims c
        where c.network_company_id=nc.id
          and c.status='approved'
      ) as controlled
    from public.network_companies nc
    where nc.publication_status<>'archived'
  ),
  classified as (
    select
      *,
      (vat_match or registration_match or legal_name_match) as blocking_match
    from candidate_base
    where vat_match or registration_match or legal_name_match or domain_match
  )
  select
    count(*) filter (where blocking_match),
    count(*) filter (where domain_match and not blocking_match),
    count(*) filter (where blocking_match and controlled)
  into v_blocking_count,v_possible_count,v_controlled_count
  from classified;

  return jsonb_build_object(
    'blocking_candidate_count',coalesce(v_blocking_count,0),
    'possible_match_count',coalesce(v_possible_count,0),
    'controlled_candidate_count',coalesce(v_controlled_count,0),
    'identity_state',
      case
        when coalesce(v_controlled_count,0)>0 then 'controlled_conflict'
        when coalesce(v_blocking_count,0)>0 then 'candidate'
        when coalesce(v_possible_count,0)>0 then 'shared_domain'
        else 'clear'
      end
  );
end;
$function$;

revoke all on function private.hp6_registration_identity_summary(uuid)
  from public,anon,authenticated;
grant execute on function private.hp6_registration_identity_summary(uuid)
  to service_role;

create or replace function private.hp6_registration_operations_queue_impl(
  p_status text default null,
  p_query text default null,
  p_limit integer default 200
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_query text;
  v_limit integer;
  v_rows jsonb;
  v_total integer;
  v_summary jsonb;
begin
  perform private.require_platform_permission('registrations.read');

  if p_status is not null and p_status not in (
    'draft','pending_review','needs_information','approved','rejected','activated'
  ) then
    raise exception 'invalid registration status filter' using errcode='22023';
  end if;

  v_query := nullif(lower(btrim(p_query)),'');
  v_limit := least(greatest(coalesce(p_limit,200),1),250);

  with operational as (
    select
      a.*,
      case
        when a.application_status in ('pending_review','approved')
          then private.hp6_registration_identity_summary(a.id)
        else jsonb_build_object(
          'blocking_candidate_count',0,
          'possible_match_count',0,
          'controlled_candidate_count',0,
          'identity_state','clear'
        )
      end as identity,
      case a.application_status
        when 'pending_review' then 'review'
        when 'needs_information' then 'waiting_company'
        when 'approved' then 'ready_activation'
        when 'activated' then 'completed'
        when 'rejected' then 'closed'
        else 'draft'
      end as operational_lane,
      case a.application_status
        when 'pending_review' then 'review_decision'
        when 'needs_information' then 'await_resubmission'
        when 'approved' then 'activate_workspace'
        else 'none'
      end as next_action,
      round(
        greatest(
          0,
          extract(epoch from (
            now() -
            case
              when a.application_status='pending_review' then coalesce(a.submitted_at,a.updated_at)
              when a.application_status in ('needs_information','approved') then coalesce(a.reviewed_at,a.updated_at)
              else a.updated_at
            end
          )) / 3600.0
        ),
        1
      ) as age_hours
    from public.company_registration_applications a
  ),
  filtered as (
    select *
    from operational o
    where (p_status is null or o.application_status=p_status)
      and (
        v_query is null
        or lower(o.legal_name) like '%'||v_query||'%'
        or lower(coalesce(o.trading_name,'')) like '%'||v_query||'%'
        or lower(o.applicant_email_snapshot) like '%'||v_query||'%'
        or lower(coalesce(o.vat_id,'')) like '%'||v_query||'%'
        or lower(coalesce(o.registration_id,'')) like '%'||v_query||'%'
      )
  ),
  ranked as (
    select *
    from filtered
    order by
      case operational_lane
        when 'review' then 0
        when 'ready_activation' then 1
        when 'waiting_company' then 2
        else 3
      end,
      case when (identity->>'controlled_candidate_count')::integer>0 then 0 else 1 end,
      age_hours desc,
      updated_at desc
    limit v_limit
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',r.id,
          'applicant_user_id',r.applicant_user_id,
          'applicant_email',r.applicant_email_snapshot,
          'legal_name',r.legal_name,
          'trading_name',r.trading_name,
          'country_code',r.country_code,
          'vat_id',r.vat_id,
          'registration_id',r.registration_id,
          'primary_company_type',r.primary_company_type,
          'application_status',r.application_status,
          'submitted_at',r.submitted_at,
          'reviewed_at',r.reviewed_at,
          'reviewed_by',r.reviewed_by,
          'activated_organization_id',r.activated_organization_id,
          'matched_network_company_id',r.matched_network_company_id,
          'created_at',r.created_at,
          'updated_at',r.updated_at,
          'operational_lane',r.operational_lane,
          'next_action',r.next_action,
          'age_hours',r.age_hours,
          'identity_state',r.identity->>'identity_state',
          'blocking_candidate_count',(r.identity->>'blocking_candidate_count')::integer,
          'possible_match_count',(r.identity->>'possible_match_count')::integer,
          'controlled_candidate_count',(r.identity->>'controlled_candidate_count')::integer,
          'attention_required',
            (
              (r.application_status='pending_review' and r.age_hours>=24)
              or (r.application_status='approved' and r.age_hours>=24)
              or (r.identity->>'controlled_candidate_count')::integer>0
            )
        )
        order by
          case r.operational_lane
            when 'review' then 0
            when 'ready_activation' then 1
            when 'waiting_company' then 2
            else 3
          end,
          case when (r.identity->>'controlled_candidate_count')::integer>0 then 0 else 1 end,
          r.age_hours desc,
          r.updated_at desc
      ),
      '[]'::jsonb
    ),
    (select count(*) from filtered)
  into v_rows,v_total
  from ranked r;

  with current_ops as (
    select
      a.*,
      case
        when a.application_status in ('pending_review','approved')
          then private.hp6_registration_identity_summary(a.id)
        else jsonb_build_object(
          'blocking_candidate_count',0,
          'possible_match_count',0,
          'controlled_candidate_count',0,
          'identity_state','clear'
        )
      end as identity
    from public.company_registration_applications a
  )
  select jsonb_build_object(
    'pending_review',count(*) filter (where application_status='pending_review'),
    'pending_over_24h',count(*) filter (
      where application_status='pending_review'
        and submitted_at is not null
        and submitted_at <= now()-interval '24 hours'
    ),
    'needs_information',count(*) filter (where application_status='needs_information'),
    'ready_activation',count(*) filter (where application_status='approved'),
    'identity_conflicts',count(*) filter (
      where application_status in ('pending_review','approved')
        and (identity->>'controlled_candidate_count')::integer>0
    ),
    'activated_last_7d',count(*) filter (
      where application_status='activated'
        and updated_at >= now()-interval '7 days'
    ),
    'oldest_pending_hours',
      coalesce(
        round(
          extract(epoch from (
            now()-min(submitted_at) filter (
              where application_status='pending_review' and submitted_at is not null
            )
          ))/3600.0,
          1
        ),
        0
      )
  )
  into v_summary
  from current_ops;

  return jsonb_build_object(
    'status_filter',p_status,
    'query',v_query,
    'count',jsonb_array_length(v_rows),
    'total',coalesce(v_total,0),
    'summary',coalesce(v_summary,'{}'::jsonb),
    'applications',v_rows
  );
end;
$function$;

revoke all on function private.hp6_registration_operations_queue_impl(text,text,integer)
  from public,anon;
grant execute on function private.hp6_registration_operations_queue_impl(text,text,integer)
  to authenticated,service_role;

create or replace function public.hp6_registration_operations_queue(
  p_status text default null,
  p_query text default null,
  p_limit integer default 200
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.hp6_registration_operations_queue_impl(p_status,p_query,p_limit);
$function$;

revoke all on function public.hp6_registration_operations_queue(text,text,integer)
  from public,anon;
grant execute on function public.hp6_registration_operations_queue(text,text,integer)
  to authenticated,service_role;

create or replace function private.p0a_admin_registration_detail_impl(
  p_application_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_application jsonb;
  v_events jsonb;
begin
  perform private.require_platform_permission('registrations.read');

  select to_jsonb(a)
  into v_application
  from public.company_registration_applications a
  where a.id=p_application_id;

  if v_application is null then
    raise exception 'registration application not found' using errcode='P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',e.id,
        'event_type',e.event_type,
        'actor_user_id',e.actor_user_id,
        'actor_email',u.email,
        'actor_type',e.actor_type,
        'from_status',e.from_status,
        'to_status',e.to_status,
        'metadata',e.metadata,
        'occurred_at',e.occurred_at
      )
      order by e.occurred_at asc,e.id asc
    ),
    '[]'::jsonb
  )
  into v_events
  from public.platform_registration_events e
  left join auth.users u on u.id=e.actor_user_id
  where e.application_id=p_application_id;

  return jsonb_build_object(
    'application',v_application,
    'events',v_events,
    'identity_summary',
      private.hp6_registration_identity_summary(p_application_id)
  );
end;
$function$;

create or replace function private.hp6_approve_and_activate_registration_impl(
  p_application_id uuid,
  p_network_company_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_app public.company_registration_applications%rowtype;
  v_approval jsonb;
  v_activation jsonb;
begin
  perform private.require_platform_permission('registrations.approve');
  perform private.require_platform_permission('registrations.activate');
  perform private.require_platform_permission('registrations.bridge_network');

  select *
  into v_app
  from public.company_registration_applications
  where id=p_application_id
  for update;

  if not found then
    raise exception 'registration application not found' using errcode='P0002';
  end if;

  if v_app.application_status='activated' then
    return jsonb_build_object(
      'application_id',v_app.id,
      'status','activated',
      'organization_id',v_app.activated_organization_id,
      'network_company_id',v_app.matched_network_company_id,
      'idempotent_replay',true
    );
  end if;

  if v_app.application_status='pending_review' then
    v_approval := private.p0a_approve_registration_application_impl(
      p_application_id
    );
  elsif v_app.application_status='approved' then
    v_approval := jsonb_build_object(
      'application_id',v_app.id,
      'status','approved',
      'idempotent_replay',true
    );
  else
    raise exception 'approve-and-activate requires pending_review or approved'
      using errcode='22023';
  end if;

  v_activation := private.hp1_1_activate_registration_application_impl(
    p_application_id,
    p_network_company_id
  );

  return jsonb_build_object(
    'application_id',p_application_id,
    'status',v_activation->>'status',
    'organization_id',v_activation->>'organization_id',
    'network_company_id',v_activation->>'network_company_id',
    'claim_id',v_activation->>'claim_id',
    'approved_in_operation',
      coalesce((v_approval->>'idempotent_replay')::boolean,false)=false,
    'idempotent_replay',false
  );
end;
$function$;

revoke all on function private.hp6_approve_and_activate_registration_impl(uuid,uuid)
  from public,anon;
grant execute on function private.hp6_approve_and_activate_registration_impl(uuid,uuid)
  to authenticated,service_role;

create or replace function public.hp6_approve_and_activate_registration(
  p_application_id uuid,
  p_network_company_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $function$
  select private.hp6_approve_and_activate_registration_impl(
    p_application_id,
    p_network_company_id
  );
$function$;

revoke all on function public.hp6_approve_and_activate_registration(uuid,uuid)
  from public,anon;
grant execute on function public.hp6_approve_and_activate_registration(uuid,uuid)
  to authenticated,service_role;

comment on function public.hp6_registration_operations_queue(text,text,integer) is
  'HP6 centralized registration operations queue with lifecycle lane, aging, identity risk and operational summary.';

comment on function public.hp6_approve_and_activate_registration(uuid,uuid) is
  'HP6 atomic operator shortcut. Approves and activates in one transaction; any identity or activation failure rolls back the approval.';
