-- L27.2D.2 — Investor scoped access + KPI snapshot
-- Generalizes the existing Investor Business Plan room without weakening the
-- current password/session model. Existing invites default to business_plan.

alter table public.investor_business_plan_invites
  add column if not exists scopes text[] not null
  default array['business_plan']::text[];

alter table public.investor_business_plan_invites
  add constraint investor_business_plan_invites_scopes_check
  check (
    cardinality(scopes) >= 1
    and scopes <@ array['business_plan','kpi']::text[]
  );

create or replace function investor_private.l272d2_investor_access_list_impl()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when not private.is_platform_superadmin() then
      jsonb_build_object('allowed',false,'invites','[]'::jsonb)
    else
      jsonb_build_object(
        'allowed',true,
        'invites',
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id',i.id,
              'share_token',i.share_token,
              'label',i.label,
              'investor_email',i.investor_email,
              'scopes',to_jsonb(i.scopes),
              'status',
                case
                  when i.status='revoked' then 'revoked'
                  when i.expires_at <= now() then 'expired'
                  else 'active'
                end,
              'created_at',i.created_at,
              'expires_at',i.expires_at,
              'revoked_at',i.revoked_at,
              'revoke_reason',i.revoke_reason,
              'failed_attempts',i.failed_attempts,
              'locked_until',i.locked_until,
              'last_accessed_at',i.last_accessed_at,
              'access_count',i.access_count
            )
            order by i.created_at desc
          ),
          '[]'::jsonb
        )
      )
  end
  from public.investor_business_plan_invites i;
$function$;

revoke execute on function investor_private.l272d2_investor_access_list_impl() from public;
grant execute on function investor_private.l272d2_investor_access_list_impl() to authenticated;

create or replace function investor_private.l272d2_create_investor_access_invite_impl(
  p_label text,
  p_investor_email text,
  p_password text,
  p_expires_at timestamptz,
  p_scopes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_id uuid;
  v_share_token uuid;
  v_label text := btrim(coalesce(p_label,''));
  v_email text := nullif(lower(btrim(coalesce(p_investor_email,''))),'');
  v_scopes text[];
begin
  if not private.is_platform_superadmin() then
    raise exception 'Platform Owner required' using errcode='42501';
  end if;
  if v_label='' then
    raise exception 'Invite label required' using errcode='22023';
  end if;
  if length(coalesce(p_password,'')) < 12 then
    raise exception 'Investor password must contain at least 12 characters' using errcode='22023';
  end if;
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '180 days' then
    raise exception 'Invite expiry must be between now and 180 days' using errcode='22023';
  end if;
  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Valid investor email required' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct scope order by scope), '{}'::text[])
    into v_scopes
  from unnest(coalesce(p_scopes,'{}'::text[])) as scope_value(scope)
  where scope in ('business_plan','kpi');

  if cardinality(v_scopes) < 1
     or cardinality(v_scopes) <> cardinality(coalesce(p_scopes,'{}'::text[])) then
    raise exception 'At least one valid investor scope is required' using errcode='22023';
  end if;

  insert into public.investor_business_plan_invites(
    label,investor_email,password_hash,created_by,expires_at,scopes
  ) values (
    v_label,
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf',12)),
    v_actor,
    p_expires_at,
    v_scopes
  )
  returning id,share_token into v_id,v_share_token;

  insert into public.investor_business_plan_access_events(
    invite_id,event_type,actor_user_id,metadata
  ) values (
    v_id,'invite_created',v_actor,
    jsonb_build_object(
      'label',v_label,
      'investor_email',v_email,
      'expires_at',p_expires_at,
      'scopes',v_scopes
    )
  );

  return jsonb_build_object(
    'id',v_id,
    'share_token',v_share_token,
    'label',v_label,
    'investor_email',v_email,
    'expires_at',p_expires_at,
    'scopes',to_jsonb(v_scopes)
  );
end;
$function$;

revoke execute on function investor_private.l272d2_create_investor_access_invite_impl(text,text,text,timestamptz,text[]) from public;
grant execute on function investor_private.l272d2_create_investor_access_invite_impl(text,text,text,timestamptz,text[]) to authenticated;

create or replace function investor_private.l272d2_update_investor_access_scopes_impl(
  p_invite_id uuid,
  p_scopes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_scopes text[];
  v_row public.investor_business_plan_invites;
begin
  if not private.is_platform_superadmin() then
    raise exception 'Platform Owner required' using errcode='42501';
  end if;

  select coalesce(array_agg(distinct scope order by scope), '{}'::text[])
    into v_scopes
  from unnest(coalesce(p_scopes,'{}'::text[])) as scope_value(scope)
  where scope in ('business_plan','kpi');

  if cardinality(v_scopes) < 1
     or cardinality(v_scopes) <> cardinality(coalesce(p_scopes,'{}'::text[])) then
    raise exception 'At least one valid investor scope is required' using errcode='22023';
  end if;

  update public.investor_business_plan_invites
  set scopes=v_scopes
  where id=p_invite_id
    and status='active'
    and expires_at>now()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Active investor invite not found' using errcode='P0002';
  end if;

  update public.investor_business_plan_sessions
  set revoked_at=coalesce(revoked_at,now())
  where invite_id=p_invite_id
    and revoked_at is null;

  insert into public.investor_business_plan_access_events(
    invite_id,event_type,actor_user_id,metadata
  ) values (
    p_invite_id,'invite_created',v_actor,
    jsonb_build_object('operation','scopes_updated','scopes',v_scopes)
  );

  return jsonb_build_object('id',v_row.id,'scopes',to_jsonb(v_scopes));
end;
$function$;

revoke execute on function investor_private.l272d2_update_investor_access_scopes_impl(uuid,text[]) from public;
grant execute on function investor_private.l272d2_update_investor_access_scopes_impl(uuid,text[]) to authenticated;

create or replace function investor_private.l272d2_investor_access_validate_impl(
  p_share_token uuid,
  p_session_token text,
  p_required_scope text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_hash text := encode(extensions.digest(coalesce(p_session_token,''),'sha256'),'hex');
  v_session public.investor_business_plan_sessions;
  v_invite public.investor_business_plan_invites;
begin
  select s.* into v_session
  from public.investor_business_plan_sessions s
  join public.investor_business_plan_invites i on i.id=s.invite_id
  where i.share_token=p_share_token
    and i.status='active'
    and i.expires_at>now()
    and s.session_token_hash=v_hash
    and s.revoked_at is null
    and s.expires_at>now()
  limit 1;

  if v_session.id is null then
    return jsonb_build_object('ok',false);
  end if;

  select * into v_invite
  from public.investor_business_plan_invites
  where id=v_session.invite_id;

  if p_required_scope is not null
     and not (p_required_scope = any(v_invite.scopes)) then
    return jsonb_build_object(
      'ok',false,
      'code','scope_denied',
      'scopes',to_jsonb(v_invite.scopes)
    );
  end if;

  update public.investor_business_plan_sessions
  set last_seen_at=now(), access_count=access_count+1
  where id=v_session.id;

  update public.investor_business_plan_invites
  set last_accessed_at=now()
  where id=v_invite.id;

  return jsonb_build_object(
    'ok',true,
    'label',v_invite.label,
    'scopes',to_jsonb(v_invite.scopes),
    'session_expires_at',v_session.expires_at
  );
end;
$function$;

revoke execute on function investor_private.l272d2_investor_access_validate_impl(uuid,text,text) from public;
grant execute on function investor_private.l272d2_investor_access_validate_impl(uuid,text,text) to anon, authenticated;

create or replace function investor_private.l272d2_kpi_snapshot_payload()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'as_of',now(),
    'stage','pre_launch',
    'measured',jsonb_build_array(
      jsonb_build_object(
        'key','network_profiles',
        'label','Seeded/discovered Network profiles',
        'value',(select count(*) from public.network_companies where archived_at is null),
        'status','measured_prelaunch',
        'note','Profile inventory, not active-customer traction.'
      ),
      jsonb_build_object(
        'key','published_network_profiles',
        'label','Published Network profiles',
        'value',(select count(*) from public.network_companies where archived_at is null and publication_status='published'),
        'status','measured_prelaunch',
        'note','Published company graph inventory.'
      ),
      jsonb_build_object(
        'key','approved_claims',
        'label','Approved company claims',
        'value',(select count(*) from public.network_company_claims where status='approved'),
        'status','measured_prelaunch',
        'note','Claim workflow evidence; not MAO.'
      ),
      jsonb_build_object(
        'key','verified_companies',
        'label','Current verified companies',
        'value',(select count(distinct company_id) from public.network_verifications where is_current and status='verified'),
        'status','measured_prelaunch',
        'note','Platform verification state.'
      ),
      jsonb_build_object(
        'key','marketplace_requests',
        'label','Marketplace requests',
        'value',(select count(*) from public.marketplace_requests),
        'status','measured_prelaunch',
        'note','Includes pre-launch requests; not liquidity proof.'
      ),
      jsonb_build_object(
        'key','marketplace_responses',
        'label','Marketplace responses',
        'value',(select count(*) from public.marketplace_responses),
        'status','measured_prelaunch',
        'note','Supplier-response baseline.'
      ),
      jsonb_build_object(
        'key','marketplace_pilot_participants',
        'label','Marketplace pilot participants',
        'value',(select count(*) from public.marketplace_pilot_participants),
        'status','measured_prelaunch',
        'note','Controlled pilot participants.'
      ),
      jsonb_build_object(
        'key','network_activity_events',
        'label','Canonical Network activity events',
        'value',(select count(*) from public.network_activity_events),
        'status','measured_prelaunch',
        'note','Platform activity ledger; not MAU.'
      )
    ),
    'targets',jsonb_build_array(
      jsonb_build_object('key','activated_orgs','label','Activated organizations','value','50','status','target','note','Initial directional PLG cohort.'),
      jsonb_build_object('key','self_service_payers','label','Self-service paying organizations','value','5','status','target','note','First monetization gate.'),
      jsonb_build_object('key','retained_60d','label','Paid organizations retained at 60 days','value','3','status','target','note','Earliest retention gate once observable.'),
      jsonb_build_object('key','paid_attach','label','Activated-to-paid attach','value','5–10%','status','hypothesis','note','Internal hypothesis to test, not an external benchmark.'),
      jsonb_build_object('key','free_cost','label','Free active-org variable cost','value','≤€0.75 / MAO / month','status','target','note','Working unit-economics ceiling.'),
      jsonb_build_object('key','blended_variable_cost','label','Blended variable revenue cost','value','≤25% of revenue','status','target','note','Working contribution-margin guardrail.')
    )
  );
$function$;

revoke execute on function investor_private.l272d2_kpi_snapshot_payload() from public;

create or replace function investor_private.l272d2_owner_kpi_snapshot_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not private.is_platform_superadmin() then
    raise exception 'Platform Owner required' using errcode='42501';
  end if;
  return investor_private.l272d2_kpi_snapshot_payload();
end;
$function$;

revoke execute on function investor_private.l272d2_owner_kpi_snapshot_impl() from public;
grant execute on function investor_private.l272d2_owner_kpi_snapshot_impl() to authenticated;

create or replace function investor_private.l272d2_investor_kpi_snapshot_impl(
  p_share_token uuid,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_access jsonb;
begin
  v_access := investor_private.l272d2_investor_access_validate_impl(
    p_share_token,p_session_token,'kpi'
  );
  if coalesce((v_access->>'ok')::boolean,false) is not true then
    return jsonb_build_object('ok',false,'code',coalesce(v_access->>'code','access_denied'));
  end if;

  return jsonb_build_object(
    'ok',true,
    'label',v_access->>'label',
    'scopes',v_access->'scopes',
    'snapshot',investor_private.l272d2_kpi_snapshot_payload()
  );
end;
$function$;

revoke execute on function investor_private.l272d2_investor_kpi_snapshot_impl(uuid,text) from public;
grant execute on function investor_private.l272d2_investor_kpi_snapshot_impl(uuid,text) to anon, authenticated;

create or replace function public.l272d2_investor_access_list()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select investor_private.l272d2_investor_access_list_impl();
$function$;

create or replace function public.l272d2_create_investor_access_invite(
  p_label text,
  p_investor_email text,
  p_password text,
  p_expires_at timestamptz,
  p_scopes text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select investor_private.l272d2_create_investor_access_invite_impl(
    p_label,p_investor_email,p_password,p_expires_at,p_scopes
  );
$function$;

create or replace function public.l272d2_update_investor_access_scopes(
  p_invite_id uuid,
  p_scopes text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select investor_private.l272d2_update_investor_access_scopes_impl(
    p_invite_id,p_scopes
  );
$function$;

create or replace function public.l272d2_investor_access_validate(
  p_share_token uuid,
  p_session_token text,
  p_required_scope text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select investor_private.l272d2_investor_access_validate_impl(
    p_share_token,p_session_token,p_required_scope
  );
$function$;

create or replace function public.l272d2_owner_kpi_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select investor_private.l272d2_owner_kpi_snapshot_impl();
$function$;

create or replace function public.l272d2_investor_kpi_snapshot(
  p_share_token uuid,
  p_session_token text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select investor_private.l272d2_investor_kpi_snapshot_impl(
    p_share_token,p_session_token
  );
$function$;

revoke execute on function public.l272d2_investor_access_list() from public, anon;
grant execute on function public.l272d2_investor_access_list() to authenticated;

revoke execute on function public.l272d2_create_investor_access_invite(text,text,text,timestamptz,text[]) from public, anon;
grant execute on function public.l272d2_create_investor_access_invite(text,text,text,timestamptz,text[]) to authenticated;

revoke execute on function public.l272d2_update_investor_access_scopes(uuid,text[]) from public, anon;
grant execute on function public.l272d2_update_investor_access_scopes(uuid,text[]) to authenticated;

revoke execute on function public.l272d2_investor_access_validate(uuid,text,text) from public;
grant execute on function public.l272d2_investor_access_validate(uuid,text,text) to anon, authenticated;

revoke execute on function public.l272d2_owner_kpi_snapshot() from public, anon;
grant execute on function public.l272d2_owner_kpi_snapshot() to authenticated;

revoke execute on function public.l272d2_investor_kpi_snapshot(uuid,text) from public;
grant execute on function public.l272d2_investor_kpi_snapshot(uuid,text) to anon, authenticated;
