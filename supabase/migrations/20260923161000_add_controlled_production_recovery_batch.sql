-- PA2.30.10 — Controlled Production Recovery Batch Cutover.
-- Service-role-only transfer buffer + fail-closed bootstrap preparation for the
-- 14 unique offered-source recoveries. Ambiguous sources remain untouched.

create table if not exists private.commercial_offer_recovery_transfer_chunks (
  transfer_id text not null,
  part_no integer not null check (part_no >= 0),
  payload_base64 text not null,
  created_at timestamptz not null default now(),
  primary key (transfer_id,part_no)
);

revoke all on private.commercial_offer_recovery_transfer_chunks
from public,anon,authenticated;
grant select,insert,delete on private.commercial_offer_recovery_transfer_chunks
to service_role;

create or replace function public.p1_prepare_offer_source_recovery_bootstrap(
  p_organization_id uuid,
  p_actor_id uuid,
  p_transfer_id text,
  p_expected_unique_count integer,
  p_expected_ambiguous_count integer
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  unique_count integer := 0;
  ambiguous_count integer := 0;
  transfer_part_count integer := 0;
  transfer_char_count bigint := 0;
  row_item record;
  existing public.commercial_offer_source_reingests%rowtype;
  reingest_id bigint;
  items jsonb := '[]'::jsonb;
begin
  if p_organization_id is null or p_actor_id is null then
    return jsonb_build_object('status','blocked','reason','organization_and_actor_required');
  end if;
  if nullif(btrim(coalesce(p_transfer_id,'')),'') is null then
    return jsonb_build_object('status','blocked','reason','transfer_id_required');
  end if;
  if coalesce(p_expected_unique_count,0)<=0 or coalesce(p_expected_ambiguous_count,0)<0 then
    return jsonb_build_object('status','blocked','reason','invalid_expected_counts');
  end if;

  if not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id=p_organization_id
      and m.user_id=p_actor_id
      and m.status='active'
  ) then
    return jsonb_build_object('status','blocked','reason','active_actor_membership_required');
  end if;

  select count(*)::int,coalesce(sum(length(payload_base64)),0)::bigint
  into transfer_part_count,transfer_char_count
  from private.commercial_offer_recovery_transfer_chunks
  where transfer_id=p_transfer_id;

  if transfer_part_count=0 or transfer_char_count=0 then
    return jsonb_build_object('status','blocked','reason','transfer_payload_missing');
  end if;

  with target as (
    select
      q.id remediation_queue_id,
      q.thread_id,
      ir.id invalidated_run_id,
      (
        select coalesce(array_agg(distinct o.source_filename order by o.source_filename)
          filter(where o.source_filename is not null and o.item_role='offered'),array[]::text[])
        from public.commercial_observations o
        where o.organization_id=q.organization_id
          and o.thread_id=q.thread_id
      ) offered_sources
    from public.commercial_offer_remediation_queue q
    join lateral (
      select r.id
      from public.commercial_offer_reparse_runs r
      join public.commercial_offer_reparse_run_invalidations i
        on i.organization_id=r.organization_id and i.run_id=r.id
      where r.organization_id=q.organization_id
        and r.remediation_queue_id=q.id
      order by r.id desc
      limit 1
    ) ir on true
    where q.organization_id=p_organization_id
      and q.category='source_reparse_required'
      and q.recommended_action='source_email_reparse'
      and q.status='pending'
  )
  select
    count(*) filter(where cardinality(offered_sources)=1)::int,
    count(*) filter(where cardinality(offered_sources)>1)::int
  into unique_count,ambiguous_count
  from target;

  if unique_count<>p_expected_unique_count
     or ambiguous_count<>p_expected_ambiguous_count then
    return jsonb_build_object(
      'status','blocked',
      'reason','recovery_population_drift',
      'observed_unique_count',unique_count,
      'observed_ambiguous_count',ambiguous_count,
      'expected_unique_count',p_expected_unique_count,
      'expected_ambiguous_count',p_expected_ambiguous_count
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'pa23010-recovery-bootstrap:'||p_organization_id::text,0
  ));

  for row_item in
    with target as (
      select
        q.id remediation_queue_id,
        q.thread_id,
        ir.id invalidated_run_id,
        (
          select coalesce(array_agg(distinct o.source_filename order by o.source_filename)
            filter(where o.source_filename is not null and o.item_role='offered'),array[]::text[])
          from public.commercial_observations o
          where o.organization_id=q.organization_id
            and o.thread_id=q.thread_id
        ) offered_sources
      from public.commercial_offer_remediation_queue q
      join lateral (
        select r.id
        from public.commercial_offer_reparse_runs r
        join public.commercial_offer_reparse_run_invalidations i
          on i.organization_id=r.organization_id and i.run_id=r.id
        where r.organization_id=q.organization_id
          and r.remediation_queue_id=q.id
        order by r.id desc
        limit 1
      ) ir on true
      where q.organization_id=p_organization_id
        and q.category='source_reparse_required'
        and q.recommended_action='source_email_reparse'
        and q.status='pending'
    )
    select *
    from target
    where cardinality(offered_sources)=1
    order by remediation_queue_id
  loop
    existing := null;

    select * into existing
    from public.commercial_offer_source_reingests s
    where s.organization_id=p_organization_id
      and s.remediation_queue_id=row_item.remediation_queue_id
      and s.status in ('requested','uploading','consumed')
    order by s.id desc
    limit 1;

    if existing.id is null then
      insert into public.commercial_offer_source_reingests(
        organization_id,remediation_queue_id,thread_id,requested_from_run_id,
        requested_by,note,selected_source_filename,source_selection_mode,
        selected_by,selected_at
      ) values (
        p_organization_id,row_item.remediation_queue_id,row_item.thread_id,
        row_item.invalidated_run_id,p_actor_id,
        'PA2.30.10 controlled production recovery batch cutover',
        row_item.offered_sources[1],'unique_offered_source',p_actor_id,now()
      )
      returning id into reingest_id;
    else
      reingest_id := existing.id;
    end if;

    items := items || jsonb_build_array(jsonb_build_object(
      'remediation_queue_id',row_item.remediation_queue_id,
      'thread_id',row_item.thread_id,
      'reingest_id',reingest_id,
      'expected_source_filename',row_item.offered_sources[1],
      'reingest_status',coalesce(existing.status,'requested')
    ));
  end loop;

  return jsonb_build_object(
    'status','ready',
    'transfer_id',p_transfer_id,
    'transfer_part_count',transfer_part_count,
    'transfer_base64_char_count',transfer_char_count,
    'unique_count',unique_count,
    'ambiguous_count',ambiguous_count,
    'items',items,
    'automatic_ambiguous_selection',false,
    'observation_mutation',false,
    'automatic_promotion',false,
    'control_phase','PA2.30.10'
  );
end;
$$;

revoke all on function public.p1_prepare_offer_source_recovery_bootstrap(uuid,uuid,text,integer,integer)
from public,anon,authenticated;
grant execute on function public.p1_prepare_offer_source_recovery_bootstrap(uuid,uuid,text,integer,integer)
to service_role;

create or replace function public.p1_offer_source_recovery_transfer_payload(
  p_transfer_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  part_count integer := 0;
  payload text;
begin
  if nullif(btrim(coalesce(p_transfer_id,'')),'') is null then
    return jsonb_build_object('status','blocked','reason','transfer_id_required');
  end if;

  select count(*)::int,string_agg(payload_base64,'' order by part_no)
  into part_count,payload
  from private.commercial_offer_recovery_transfer_chunks
  where transfer_id=p_transfer_id;

  if part_count=0 or payload is null then
    return jsonb_build_object('status','not_found','transfer_id',p_transfer_id);
  end if;

  return jsonb_build_object(
    'status','ready',
    'transfer_id',p_transfer_id,
    'part_count',part_count,
    'payload_base64',payload
  );
end;
$$;

revoke all on function public.p1_offer_source_recovery_transfer_payload(text)
from public,anon,authenticated;
grant execute on function public.p1_offer_source_recovery_transfer_payload(text)
to service_role;

create or replace function public.p1_cleanup_offer_source_recovery_transfer(
  p_transfer_id text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  deleted_count integer;
begin
  delete from private.commercial_offer_recovery_transfer_chunks
  where transfer_id=p_transfer_id;
  get diagnostics deleted_count = row_count;

  return jsonb_build_object(
    'status','cleaned',
    'transfer_id',p_transfer_id,
    'deleted_parts',deleted_count,
    'control_phase','PA2.30.10'
  );
end;
$$;

revoke all on function public.p1_cleanup_offer_source_recovery_transfer(text)
from public,anon,authenticated;
grant execute on function public.p1_cleanup_offer_source_recovery_transfer(text)
to service_role;
