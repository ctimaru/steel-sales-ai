-- NET-PROFILE1C.3: source-grounded staging. The discovered record source is
-- a VIEW, so preserve the UUID without an invalid foreign-key constraint.
create table if not exists private.network_company_enrichment (
 id uuid primary key default gen_random_uuid(),
 canonical_company_id uuid references public.network_companies(id) on delete cascade,
 discovered_record_id uuid,
 field_key text not null check (field_key in ('description','products','services','industry','city','region','website')),
 field_value jsonb not null,
 evidence_url text not null check (length(evidence_url) between 10 and 2048 and evidence_url ~* '^https?://'),
 evidence_excerpt text check (length(evidence_excerpt)<=1200),
 extractor_version text not null check (length(extractor_version) between 1 and 80),
 confidence numeric(4,3) check (confidence between 0 and 1),
 review_status text not null default 'candidate' check (review_status in ('candidate','accepted','rejected','superseded')),
 fetched_at timestamptz not null,
 created_at timestamptz not null default now(),
 check ((canonical_company_id is null) <> (discovered_record_id is null)),
 check (jsonb_typeof(field_value) in ('string','array','object'))
);
create index if not exists network_company_enrichment_canonical_idx on private.network_company_enrichment(canonical_company_id,review_status);
create index if not exists network_company_enrichment_discovered_idx on private.network_company_enrichment(discovered_record_id,review_status);
create unique index if not exists network_company_enrichment_canonical_dedupe on private.network_company_enrichment(canonical_company_id,field_key,evidence_url,extractor_version) where canonical_company_id is not null;
create unique index if not exists network_company_enrichment_discovered_dedupe on private.network_company_enrichment(discovered_record_id,field_key,evidence_url,extractor_version) where discovered_record_id is not null;
alter table private.network_company_enrichment enable row level security;
revoke all on private.network_company_enrichment from public,anon,authenticated;
comment on table private.network_company_enrichment is 'Internal candidate evidence; never automatically published or verified.';
