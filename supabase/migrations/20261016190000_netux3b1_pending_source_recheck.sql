-- NET-UX3B.1 — evidence-source recheck, NOT a review decision and NOT a publication.
-- Two still-pending official-site URLs were replaced with stable contact pages
-- verified against the company's own public website on 2026-10-16.
-- A first and second human Platform decision remain strictly required.

create table if not exists public.network_it_geo_source_recheck_ledger (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.network_it_geo_evidence_candidates(id) on delete restrict,
  prior_source_url text not null,
  updated_source_url text not null,
  prior_evidence_snippet text not null,
  updated_evidence_snippet text not null,
  verification_method text not null
    check(verification_method = 'external_official_site_recheck_not_human_approval'),
  checked_at timestamptz not null default now(),
  unique(evidence_id,updated_source_url),
  check(prior_source_url <> updated_source_url)
);
alter table public.network_it_geo_source_recheck_ledger enable row level security;
revoke all on public.network_it_geo_source_recheck_ledger from public,anon,authenticated;
grant select on public.network_it_geo_source_recheck_ledger to service_role;

do $recheck$
declare
  v_expected integer;
  v_changed integer;
begin
  -- During local schema reset there are no real production pilot candidates;
  -- the migration must remain safe and deterministic with zero existing IDs.
  select count(*) into v_expected from public.network_it_geo_evidence_candidates
  where id in (
    '68baa4fd-64e5-484d-9bad-89aa75696614'::uuid,
    '6bb0c059-e34b-49da-bab1-62fd661f199a'::uuid
  );
  if v_expected=0 then return; end if;
  if v_expected<>2 then
    raise exception 'NET-UX3B.1 partial production pilot; preserve original evidence' using errcode='22023';
  end if;

  with replacements(evidence_id,company_id,prior_url,new_url,new_snippet) as (
    values
    (
      '68baa4fd-64e5-484d-9bad-89aa75696614'::uuid,
      '0707d9ea-58f0-4357-9620-764cff053977'::uuid,
      'https://www.giulipas.it/'::text,
      'https://www.giulipas.it/contatti-curvatura-piegatura-metalli-brescia-milano-costi-lavorazione-metalli/'::text,
      'Giulipas srl - Via Ruca, 280 - 25065 Lumezzane (BS) - Italy'::text
    ),
    (
      '6bb0c059-e34b-49da-bab1-62fd661f199a'::uuid,
      '51100000-0000-5000-8000-000000000003'::uuid,
      'https://www.padanatubi.it/wp-content/uploads/2023/11/Allegato-Opinione-Verifica-ISO-14064-1-Padana-Tubi-2023-ITA.pdf'::text,
      'https://www.padanatubi.it/contatti/'::text,
      'Padana Tubi e Profilati Acciaio S.p.A. - Via Portamurata 8/A - 42016 Guastalla (RE)'::text
    )
  ),
  locked as (
    select e.id,e.source_url as old_url,e.evidence_snippet as old_snippet,
           r.new_url,r.new_snippet
    from public.network_it_geo_evidence_candidates e
    join replacements r on r.evidence_id=e.id and r.company_id=e.company_id
      and e.source_url=r.prior_url
    where e.status='pending_review' and e.reviewed_at is null and e.reviewed_by is null
      and e.istat_code is not null
    for update of e
  ),
  rewritten as (
    update public.network_it_geo_evidence_candidates e
      set source_url=l.new_url,evidence_snippet=l.new_snippet
    from locked l
    where e.id=l.id
    returning e.id, l.old_url,l.old_snippet,l.new_url,l.new_snippet
  )
  insert into public.network_it_geo_source_recheck_ledger(
    evidence_id,prior_source_url,updated_source_url,
    prior_evidence_snippet,updated_evidence_snippet,verification_method
  )
  select id,old_url,new_url,old_snippet,new_snippet,
    'external_official_site_recheck_not_human_approval'
  from rewritten;

  get diagnostics v_changed = row_count;
  if v_changed<>2 then
    raise exception 'NET-UX3B.1 evidence source update rejected or stale; transaction rolled back'
      using errcode='22023';
  end if;
end
$recheck$;

comment on table public.network_it_geo_source_recheck_ledger is
 'Source provenance correction before human review; NEVER proof of human approval or permission to publish.';
