-- NET-UX3B.1: review conflict recovery is a separate, authenticated
-- Platform governance decision; it never approves or publishes a facility.
create table if not exists public.network_it_geo_conflict_reopen_ledger (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.network_it_geo_evidence_candidates(id) on delete restrict,
  prior_status text not null check(prior_status='conflict'),
  prior_review_note text,
  prior_reviewed_by uuid references auth.users(id),
  prior_reviewed_at timestamptz,
  reopened_by uuid not null references auth.users(id),
  reopen_note text not null check(length(btrim(reopen_note)) between 12 and 2000),
  reopened_at timestamptz not null default now()
);
alter table public.network_it_geo_conflict_reopen_ledger enable row level security;
revoke all on public.network_it_geo_conflict_reopen_ledger from public,anon,authenticated;
grant select on public.network_it_geo_conflict_reopen_ledger to service_role;

create or replace function private.netux3b1_conflicts_queue_impl()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v jsonb;
begin
  perform private.require_platform_permission('discovery.read');
  select jsonb_build_object(
    'contract','netux3b1-conflicts-v1',
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'legal_name',c.legal_name,'city',e.city,
      'province_code',e.province_code,'region',e.region,
      'source_url',e.source_url,'evidence_snippet',e.evidence_snippet,
      'review_note',e.review_note,'reviewed_at',e.reviewed_at
    ) order by e.reviewed_at nulls last),'[]'::jsonb)
  ) into v
  from public.network_it_geo_evidence_candidates e
  join public.network_companies c on c.id=e.company_id
  where e.status='conflict' and c.publication_status='published'
    and c.archived_at is null and c.country_code='IT';
  return v;
end;
$$;

create or replace function private.netux3b1_reopen_conflict_impl(
  p_evidence_id uuid,p_note text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  e public.network_it_geo_evidence_candidates%rowtype;
  v_actor uuid;
begin
  perform private.require_platform_permission('discovery.governance_review');
  v_actor:=auth.uid();
  if v_actor is null then
    raise exception 'Authenticated reviewer identity required' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_note,''))) not between 12 and 2000 then
    raise exception 'Explicit reason for reopening required' using errcode='22023';
  end if;
  select * into e from public.network_it_geo_evidence_candidates
  where id=p_evidence_id for update;
  if not found or e.status<>'conflict' then
    raise exception 'Only active conflicted evidence may be reopened' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.network_companies c
    where c.id=e.company_id and c.publication_status='published'
      and c.archived_at is null and c.country_code='IT'
  ) then raise exception 'Company no longer published' using errcode='42501'; end if;
  if exists(select 1 from public.network_it_geo_publication_ledger l
            where l.evidence_id=e.id) then
    raise exception 'Published evidence is immutable' using errcode='42501';
  end if;
  insert into public.network_it_geo_conflict_reopen_ledger(
    evidence_id,prior_status,prior_review_note,prior_reviewed_by,
    prior_reviewed_at,reopened_by,reopen_note
  ) values (
    e.id,e.status,e.review_note,e.reviewed_by,
    e.reviewed_at,v_actor,btrim(p_note)
  );
  update public.network_it_geo_evidence_candidates
  set status='pending_review',review_note=null,reviewed_by=null,reviewed_at=null
  where id=e.id;
  return jsonb_build_object('id',e.id,'status','pending_review',
                            'human_review_required',true,'facility_published',false);
end;
$$;

create or replace function public.netux3b1_conflicts_queue()
returns jsonb language sql stable security invoker set search_path=''
as 'select private.netux3b1_conflicts_queue_impl();';

create or replace function public.netux3b1_reopen_conflict(
  p_evidence_id uuid,p_note text
) returns jsonb language sql security invoker set search_path=''
as 'select private.netux3b1_reopen_conflict_impl(p_evidence_id,p_note);';

revoke all on function private.netux3b1_conflicts_queue_impl() from public,anon,authenticated;
revoke all on function private.netux3b1_reopen_conflict_impl(uuid,text) from public,anon,authenticated;
revoke all on function public.netux3b1_conflicts_queue() from public,anon,authenticated;
revoke all on function public.netux3b1_reopen_conflict(uuid,text) from public,anon,authenticated;
grant execute on function private.netux3b1_conflicts_queue_impl() to authenticated;
grant execute on function private.netux3b1_reopen_conflict_impl(uuid,text) to authenticated;
grant execute on function public.netux3b1_conflicts_queue() to authenticated;
grant execute on function public.netux3b1_reopen_conflict(uuid,text) to authenticated;
comment on function public.netux3b1_reopen_conflict(uuid,text) is
  'NET-UX3B.1 authenticated Platform conflict reopening with append-only original decision provenance; never auto-approval.';
