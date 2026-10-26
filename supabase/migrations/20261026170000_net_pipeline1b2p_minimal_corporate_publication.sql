-- Founder-directed minimal public company facts batch (2026-10-26).
-- NOT a grant of database/content reuse rights; no scraped descriptions, people, capabilities, or contacts.
-- Corporate-form-only, clear official-domain evidence, duplicate hold, unverified public status.
create table if not exists private.net_pipeline1b2p_publication_ledger (
 lead_id uuid primary key references public.network_core_target_leads(id),
 company_id uuid not null unique references public.network_companies(id),
 official_evidence_url text not null,
 basis text not null default 'founder_authorized_minimal_public_company_facts',
 published_at timestamptz not null default now()
);
revoke all on private.net_pipeline1b2p_publication_ledger from public,anon,authenticated;

do $batch$
declare v_count integer;
begin
 perform pg_advisory_xact_lock(810021,20262);
 with candidate as (
 select l.id,l.company_name,l.canonical_domain,l.evidence_url,
 lower(regexp_replace(trim(l.canonical_domain),'^www[.]','')) dm,
 lower(regexp_replace(trim(l.company_name),'[^[:alnum:]]','','g')) nm,
 lower(regexp_replace(split_part(regexp_replace(l.evidence_url,'^https?://',''), '/',1),'^www[.]','')) host
 from public.network_core_target_leads l
 where trim(l.company_name) ~* '(s[.]?r[.]?l[.]?|s[.]?p[.]?a[.]?)[[:space:]]*$'
 and l.evidence_url ~* '^https://'
 and nullif(trim(l.canonical_domain),'') is not null
 ), ranked as (
 select c.*,count(*) over(partition by nm) name_count from candidate c
 ), qualified as (
 select c.* from ranked c
 where c.name_count=1
 and (c.host=c.dm or right(c.host,length(c.dm)+1)='.'||c.dm)
 and not exists(select 1 from public.network_companies n
 where lower(regexp_replace(coalesce(n.website_domain,''),'^www[.]',''))=c.dm
 or lower(regexp_replace(trim(n.legal_name),'[^[:alnum:]]','','g'))=c.nm)
 and not exists(select 1 from private.net_pipeline1b2p_publication_ledger k where k.lead_id=c.id)
 ), created as (
 insert into public.network_companies
 (legal_name,country_code,website_url,website_domain,publication_status,claimed_status,verification_status)
 select trim(company_name),'IT',evidence_url,dm,'published','unclaimed','unverified'
 from qualified
 returning id,website_domain
 )
 insert into private.net_pipeline1b2p_publication_ledger(lead_id,company_id,official_evidence_url)
 select q.id,c.id,q.evidence_url from qualified q join created c on c.website_domain=q.dm;
 get diagnostics v_count = row_count;
 raise notice 'Minimal factual corporate profiles published: %',v_count;
end;$batch$;
