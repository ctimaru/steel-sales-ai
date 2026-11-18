-- NET-EU-TUBIFICI1.D1: evidence-only European intake, seed-backed and batch independent.
-- Existing batch 01 is preserved; batch 02 and later correctly sourced
-- candidates may enter the same first-party identity worker without further
-- hand-coded country or batch filters. This migration does NOT touch the
-- C1 publisher, PA1.5 acceptance rules, company rows or Italian AUTO2/3.
--
-- Trust boundary: private research seed + canonical candidate + discovery run
-- must match COUNTRY, DOMAIN, FULL SOURCE URL, RESEARCH_ID and BATCH_KEY.
-- No candidate can grant itself producer identity or publication rights.
create or replace function private.net_eu_tubifici1_seed_matches(
 p_country text,p_domain text,p_source_url text,p_run_source_reference text,
 p_seed_id text,p_research_id text
)
returns boolean
language sql stable security definer set search_path=''
as $seed$
  select exists(
    select 1
    from private.network_web_research_seeds s
    where s.id::text=p_seed_id
      and s.research_id=p_research_id
      and s.country_code=p_country
      and s.country_code<>'IT'
      and s.canonical_domain=p_domain
      and s.source_url=p_source_url
      and s.source_kind='first_party_web'
      and s.verification_status='web_sourced_unverified'
      and s.publication_status='not_published'
      and s.proposed_role='producer'
      and s.review_lane in ('web_profile_review_pending',
        'legal_identity_review','group_facility_review')
      and s.batch_key ~ '^NET-EU-TUBIFICI-[0-9]{8}-[0-9]{2}$'
      and p_run_source_reference='net-eu-tubifici1:'||s.batch_key
      and s.source_url ~* '^https://'
      and lower(regexp_replace(
        split_part(split_part(s.source_url,'/',3),':',1),'^www[.]',''
      ))=lower(s.canonical_domain)
  );
$seed$;
revoke all on function private.net_eu_tubifici1_seed_matches(
  text,text,text,text,text,text
) from public,anon,authenticated,service_role;
comment on function private.net_eu_tubifici1_seed_matches(
  text,text,text,text,text,text
) is 'EU research-only candidate/seed provenance check; grants no publication or technical confirmation.';

-- Preserve the existing audited B1 implementations (including service JWT
-- restriction, first-party host check, verdict, idempotent evidence, and all
-- existing 3-day cooldowns). Replace only the two literal single-batch gates.
-- Fail closed on any upstream function-body change.
do $patch$
declare
  q_def text;
  r_def text;
  q_old constant text := 'r.source_reference=''net-eu-tubifici1:NET-EU-TUBIFICI-20261118-01''';
  r_old constant text := 'v_run.source_reference<>''net-eu-tubifici1:NET-EU-TUBIFICI-20261118-01''';
  q_new constant text := $fragment$
    private.net_eu_tubifici1_seed_matches(
      c.country_code,c.canonical_domain,c.source_url,r.source_reference,
      c.identity_quality->>'seed_id',c.identity_quality->>'research_id'
    )$fragment$;
  r_new constant text := $fragment$
    not private.net_eu_tubifici1_seed_matches(
      v_candidate.country_code,v_candidate.canonical_domain,
      v_candidate.source_url,v_run.source_reference,
      v_candidate.identity_quality->>'seed_id',
      v_candidate.identity_quality->>'research_id'
    )$fragment$;
begin
  select pg_catalog.pg_get_functiondef(p.oid) into q_def
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n
    on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='net_eu_tubifici1_queue'
    and pg_catalog.pg_get_function_identity_arguments(p.oid)='p_max integer';
  select pg_catalog.pg_get_functiondef(p.oid) into r_def
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n
    on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='net_eu_tubifici1_record';

  if q_def is null or r_def is null
    or pg_catalog.strpos(q_def,q_old)=0
    or pg_catalog.strpos(r_def,r_old)=0
    or pg_catalog.strpos(q_def,'net_eu_tubifici1_seed_matches')>0
    or pg_catalog.strpos(r_def,'net_eu_tubifici1_seed_matches')>0
  then
    raise exception 'Unexpected European B1 reviewer definition; fail closed instead of broadening queue';
  end if;
  execute pg_catalog.replace(q_def,q_old,q_new);
  execute pg_catalog.replace(r_def,r_old,r_new);
end
$patch$;
