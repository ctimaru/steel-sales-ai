-- NET-PROFILE-DATA2: machine-assisted first-party source review.
-- Private, auditable, repeatable per reviewer version. Only service-role workers
-- may fetch the bounded queue or record a finding; neither anon nor members
-- receive direct access. Publication of the *company* is never touched.

create table if not exists private.netprofile_data2_reviews (
 id uuid primary key default gen_random_uuid(),
 evidence_id uuid not null references private.network_company_enrichment(id) on delete cascade,
 company_id uuid not null references public.network_companies(id) on delete cascade,
 reviewer_version text not null check (length(reviewer_version) between 6 and 80),
 verdict text not null check (verdict in ('supported','needs_review','blocked')),
 model_name text not null check (length(model_name) between 2 and 120),
 source_url text not null check (length(source_url) between 10 and 2048),
 source_sha256 text check (source_sha256 ~ '^[0-9a-f]{64}$'),
 support_quote text check (length(support_quote) <= 400),
 confidence numeric(4,3) check (confidence between 0 and 1),
 reason_codes text[] not null default '{}'::text[],
 recorded_at timestamptz not null default now(),
 unique(evidence_id, reviewer_version)
);
create or replace function private.netprofile_data2_immutable_guard()
returns trigger language plpgsql set search_path to '' as $guard$
begin
 raise exception 'Machine-review audit is append-only' using errcode='42501';
end $guard$;
drop trigger if exists netprofile_data2_immutable on private.netprofile_data2_reviews;
create trigger netprofile_data2_immutable
before update or delete on private.netprofile_data2_reviews
for each row execute function private.netprofile_data2_immutable_guard();

create index if not exists netprofile_data2_reviews_company_idx
 on private.netprofile_data2_reviews (company_id, recorded_at desc);
alter table private.netprofile_data2_reviews enable row level security;
revoke all on private.netprofile_data2_reviews from public, anon, authenticated;
comment on table private.netprofile_data2_reviews is
 'Internal machine review ledger. Supported means source-grounded company description/products/services only; never company verification, stock or an RFQ commitment.';

-- The service-role queue never sends another tenant's member or contact data.
-- Exact domain match, unique legal entity, fresh HTTPS source and canonical
-- published company are required. Discovered/private research is excluded.
create or replace function public.netprofile_data2_queue(p_limit int default 25)
returns jsonb language plpgsql stable security definer set search_path to ''
as $fn$
declare v_items jsonb;
begin
 if (select auth.role()) is distinct from 'service_role' then
   raise exception 'Service role required' using errcode='42501';
 end if;
 if p_limit is null or p_limit not between 1 and 50 then
   raise exception 'Invalid queue limit' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'evidence_id',q.evidence_id,
   'company_id',q.company_id,
   'company_name',q.company_name,
   'website_url',q.website_url,
   'website_domain',q.website_domain,
   'field_key',q.field_key,
   'field_value',q.field_value,
   'evidence_url',q.evidence_url,
   'evidence_excerpt',q.evidence_excerpt,
   'fetched_at',q.fetched_at
 ) order by q.created_at,q.evidence_id),'[]'::jsonb)
 into v_items
 from (
   select e.id evidence_id,c.id company_id,c.legal_name company_name,
     c.website_url,c.website_domain,e.field_key,e.field_value,
     e.evidence_url,e.evidence_excerpt,e.fetched_at,e.created_at
   from private.network_company_enrichment e
   join public.network_companies c on c.id=e.canonical_company_id
   where e.review_status='candidate'
     and e.discovered_record_id is null
     and e.field_key in ('description','products','services')
     and e.evidence_url like 'https://%'
     and e.fetched_at>=now()-interval '90 days'
     and c.publication_status='published' and c.archived_at is null
     and c.website_url like 'https://%'
     and coalesce(nullif(c.website_domain,''),'')<>''
     and lower(regexp_replace(split_part(split_part(e.evidence_url,'://',2),'/',1),'^www[.]','', 'i'))
       = lower(regexp_replace(c.website_domain,'^www[.]','', 'i'))
     and lower(regexp_replace(split_part(split_part(c.website_url,'://',2),'/',1),'^www[.]','', 'i'))
       = lower(regexp_replace(c.website_domain,'^www[.]','', 'i'))
     and (select count(*) from public.network_companies c2
       where c2.archived_at is null
         and lower(regexp_replace(c2.website_domain,'^www[.]','', 'i'))
           =lower(regexp_replace(c.website_domain,'^www[.]','', 'i'))) = 1
     and not exists (select 1 from private.netprofile_data2_reviews r
       where r.evidence_id=e.id and r.reviewer_version='net-profile-data2-v1')
   order by e.created_at,e.id
   limit p_limit
 ) q;
 return jsonb_build_object('contract','net-profile-data2-queue-v1','items',v_items);
end $fn$;

-- The machine reviewer may accept only its high-confidence, corroborated,
-- specifically approved low-risk content categories. Never set verified
-- company status, claim, inventories, price or technical grade capability.
create or replace function public.netprofile_data2_record(
 p_evidence_id uuid,p_reviewer_version text,p_verdict text,
 p_model_name text,p_source_url text,p_source_sha256 text,
 p_support_quote text,p_confidence numeric,p_reason_codes text[] default '{}'
) returns jsonb language plpgsql security definer set search_path to ''
as $fn$
declare
 v_e private.network_company_enrichment%rowtype;
 v_c public.network_companies%rowtype;
 v_accepted boolean := false;
begin
 if (select auth.role()) is distinct from 'service_role' then
   raise exception 'Service role required' using errcode='42501';
 end if;
 if p_reviewer_version<>'net-profile-data2-v1'
   or p_verdict not in ('supported','needs_review','blocked')
   or nullif(btrim(p_model_name),'') is null or length(p_model_name)>120
   or p_source_url is null or length(p_source_url)>2048
   or p_reason_codes is null or cardinality(p_reason_codes)>12
   or exists (select 1 from unnest(p_reason_codes) r where length(r)>100)
 then raise exception 'Invalid reviewer metadata' using errcode='22023'; end if;

 select * into v_e from private.network_company_enrichment where id=p_evidence_id for update;
 if not found then raise exception 'Unknown evidence' using errcode='P0002'; end if;
 if v_e.review_status<>'candidate' or v_e.canonical_company_id is null
   or v_e.discovered_record_id is not null
   or v_e.field_key not in ('description','products','services')
 then raise exception 'Candidate not eligible' using errcode='22023'; end if;

 select * into v_c from public.network_companies where id=v_e.canonical_company_id;
 if not found or v_c.archived_at is not null or v_c.publication_status<>'published'
   or v_c.website_url not like 'https://%' or v_e.evidence_url not like 'https://%'
   or lower(regexp_replace(split_part(split_part(v_e.evidence_url,'://',2),'/',1),'^www[.]','', 'i'))
     is distinct from lower(regexp_replace(v_c.website_domain,'^www[.]','', 'i'))
   or lower(regexp_replace(split_part(split_part(v_c.website_url,'://',2),'/',1),'^www[.]','', 'i'))
     is distinct from lower(regexp_replace(v_c.website_domain,'^www[.]','', 'i'))
   or (select count(*) from public.network_companies c2 where c2.archived_at is null
         and lower(regexp_replace(c2.website_domain,'^www[.]','', 'i'))
           =lower(regexp_replace(v_c.website_domain,'^www[.]','', 'i')))<>1
   or v_e.fetched_at<now()-interval '90 days'
   or p_source_url<>v_e.evidence_url
 then raise exception 'First party source/identity mismatch' using errcode='22023'; end if;

 if p_verdict='supported' then
   if p_model_name='none' or p_confidence is null or p_confidence<0.970
     or p_source_sha256 is null or p_source_sha256 !~ '^[0-9a-f]{64}$'
     or length(coalesce(p_support_quote,'')) not between 12 and 400
     or p_reason_codes <> '{}'::text[]
     or v_e.field_value::text ~* '(availability|disponibilit|giacenz|in[ -]?stock|stock immediat|prezz|€/|certificat|produzione attual|lead time|consegna immediata)'
   then raise exception 'Source support insufficient for automatic acceptance' using errcode='22023'; end if;
   v_accepted := true;
 end if;
 insert into private.netprofile_data2_reviews(
   evidence_id,company_id,reviewer_version,verdict,model_name,
   source_url,source_sha256,support_quote,confidence,reason_codes
 ) values(
   p_evidence_id,v_c.id,p_reviewer_version,p_verdict,p_model_name,
   p_source_url,p_source_sha256,left(p_support_quote,400),p_confidence,p_reason_codes
 );
 if v_accepted then
   update private.network_company_enrichment set review_status='accepted',
     confidence=least(p_confidence,0.999)
   where id=v_e.id and review_status='candidate';
 end if;
 return jsonb_build_object('contract','net-profile-data2-review-v1',
   'evidence_id',p_evidence_id,'verdict',p_verdict,'accepted',v_accepted,
   'company_publication_changed',false,'stock_changed',false);
end $fn$;

revoke all on function public.netprofile_data2_queue(integer) from public, anon, authenticated;
revoke all on function public.netprofile_data2_record(uuid,text,text,text,text,text,text,numeric,text[]) from public, anon, authenticated;
grant execute on function public.netprofile_data2_queue(integer) to service_role;
grant execute on function public.netprofile_data2_record(uuid,text,text,text,text,text,text,numeric,text[]) to service_role;
