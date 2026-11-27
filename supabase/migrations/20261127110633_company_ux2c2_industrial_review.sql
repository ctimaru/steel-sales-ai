-- COMPANY-UX2.C.2: explicit company decisions on industrial labels already
-- collected by NET-RESEARCH1. This does not change research or infer evidence,
-- facilities, geography, product relationships or certification details.

create table private.company_ux2c2_industrial_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  network_company_id uuid not null references public.network_companies(id) on delete restrict,
  actor_user_id uuid null references auth.users(id) on delete set null,
  kind text not null check (kind in ('product','capability','market','certification')),
  content_key text not null check (content_key ~ '^[a-f0-9]{64}$'),
  proposal_hash text not null check (proposal_hash ~ '^[a-f0-9]{64}$'),
  label text not null check (char_length(label) between 2 and 80),
  suggested_key text,
  source_urls text[] not null check (cardinality(source_urls) between 1 and 12),
  observed_at timestamptz,
  extractor_version text,
  mapping_version text not null default 'company-ux2c2-map-v1',
  decision text not null check (decision in ('confirmed','ignored')),
  effect text not null check (effect in ('added','already_present','ignored')),
  selection jsonb,
  -- Polymorphic historical identity: later manual removal must not erase or
  -- prevent retention of the original decision.
  target_id uuid,
  before_state_hash text not null check (before_state_hash ~ '^[a-f0-9]{64}$'),
  after_state_hash text not null check (after_state_hash ~ '^[a-f0-9]{64}$'),
  decided_at timestamptz not null default now(),
  unique (organization_id,network_company_id,content_key),
  check ((decision='ignored' and effect='ignored' and selection is null and target_id is null)
    or (decision='confirmed' and effect in ('added','already_present')
      and selection is not null and jsonb_typeof(selection)='object' and target_id is not null))
);
create index company_ux2c2_industrial_decisions_actor_idx
  on private.company_ux2c2_industrial_decisions(actor_user_id) where actor_user_id is not null;
alter table private.company_ux2c2_industrial_decisions enable row level security;
revoke all on private.company_ux2c2_industrial_decisions from public,anon,authenticated,service_role;
-- Reuse C.1's immutable-record guard, including its narrowly scoped FK actor
-- anonymization exception. No existing guard, writer or grant is replaced.
create trigger company_ux2c2_industrial_decisions_immutable
before update or delete on private.company_ux2c2_industrial_decisions
for each row execute function private.company_ux2c1_decision_immutable_guard();
comment on table private.company_ux2c2_industrial_decisions is
  'C.2 private company decision ledger: exact research snapshots and explicit selections; no inferred verification, publication or per-label evidence.';

create function private.company_ux2c2_normalize_label(p_label text)
returns text language sql immutable security invoker set search_path=''
as $fn$
  select lower(btrim(regexp_replace(coalesce(p_label,''),'[[:space:]]+',' ','g')));
$fn$;
revoke all on function private.company_ux2c2_normalize_label(text) from public,anon,authenticated,service_role;

-- Exact taxonomy names/keys and a small reviewed synonym list. No substring,
-- fuzzy or model matching. Ambiguity returns NULL for explicit human selection.
-- A generic PED / AD 2000 / ISO 3834 label never implies a directive or part.
create function private.company_ux2c2_suggest_key(p_kind text,p_label text)
returns text language sql stable security invoker set search_path=''
as $fn$
  with taxonomy as (
    select 'product'::text as kind,canonical_key,display_name,status from public.network_product_families
    union all select 'capability',canonical_key,display_name,status from public.network_capabilities
    union all select 'market',canonical_key,display_name,status from public.network_markets
    union all select 'certification',canonical_key,display_name,status from public.network_certification_types
  ), aliases(kind,label,canonical_key) as (values
    ('product','Tubi','tubes_pipes'),('product','Tubi saldati','tubes_pipes'),
    ('product','Tubi senza saldatura','tubes_pipes'),('product','Tubi in acciaio','tubes_pipes'),
    ('product','Tubazioni','tubes_pipes'),('product','Profilati cavi','hollow_sections'),
    ('product','Profili cavi','hollow_sections'),('product','Barre','bars'),
    ('product','Travi','beams_sections'),('product','Travi e profilati','beams_sections'),
    ('product','Coil','coils'),('product','Lamiere da treno','plates'),
    ('product','Prodotti piani','flat_products'),('product','Prodotti lunghi','long_products'),
    ('product','Tondo per cemento armato','rebar'),('product','Vergella e filo','wire_rod_wire'),
    ('capability','Taglio laser','laser_cutting'),('capability','Taglio laser tubi','laser_cutting'),
    ('capability','Piegatura','bending_forming'),('capability','Formatura','bending_forming'),
    ('capability','Piegatura e formatura','bending_forming'),('capability','Taglio a misura','cut_to_length'),
    ('capability','Zincatura','galvanizing'),('capability','Trattamento termico','heat_treatment'),
    ('capability','Ossitaglio','oxy_cutting'),('capability','Verniciatura','painting_coating'),
    ('capability','Verniciatura e rivestimento','painting_coating'),
    ('capability','Decapaggio e oliatura','pickling_oiling'),('capability','Taglio plasma','plasma_cutting'),
    ('capability','Segagione','sawing'),('capability','Taglio coil','slitting'),
    ('capability','Prove e controlli non distruttivi','testing_ndt'),
    ('capability','Saldatura','welding_fabrication'),('capability','Saldatura robotizzata','welding_fabrication'),
    ('capability','Saldatura e carpenteria','welding_fabrication'),
    ('market','Edilizia','construction_infrastructure'),('market','Costruzioni','construction_infrastructure'),
    ('market','Infrastrutture','construction_infrastructure'),
    ('market','Edilizia e infrastrutture','construction_infrastructure'),
    ('market','Energia','energy'),('market','Climatizzazione','hvac'),
    ('market','Meccanica','mechanical_engineering_market'),
    ('market','Industria meccanica','mechanical_engineering_market'),
    ('market','Macchine agricole','agri_machinery'),('market','Elettrodomestici','appliances'),
    ('market','Navale','marine'),('market','Cantieristica navale','marine'),
    ('certification','UNI EN ISO 9001','iso_9001'),('certification','EN ISO 9001','iso_9001'),
    ('certification','UNI EN ISO 14001','iso_14001'),('certification','EN ISO 14001','iso_14001'),
    ('certification','UNI EN ISO 45001','iso_45001'),('certification','EN ISO 45001','iso_45001'),
    ('certification','EN 1090-1','en_1090'),('certification','UNI EN 1090-1','en_1090')
  ), matched as (
    select distinct t.canonical_key
    from taxonomy t
    where t.kind=p_kind and t.status='active' and t.canonical_key ~ '^[a-z][a-z0-9_]{0,79}$'
      and (
        regexp_replace(lower(t.canonical_key),'[^a-z0-9]+','','g')=
          regexp_replace(lower(p_label),'[^a-z0-9]+','','g')
        or regexp_replace(lower(t.display_name),'[^a-z0-9]+','','g')=
          regexp_replace(lower(p_label),'[^a-z0-9]+','','g')
        or exists (select 1 from aliases a where a.kind=t.kind and a.canonical_key=t.canonical_key
          and regexp_replace(lower(a.label),'[^a-z0-9]+','','g')=
            regexp_replace(lower(p_label),'[^a-z0-9]+','','g'))
      )
  ) select case when count(*)=1 then min(canonical_key) else null end from matched;
$fn$;
revoke all on function private.company_ux2c2_suggest_key(text,text) from public,anon,authenticated,service_role;

create function private.company_ux2c2_candidates(
  p_network_company_id uuid,p_current_website_url text,p_research private.network_company_research
)
returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
declare
  v_sources text[];
  v_domain text;
  v_proposals jsonb;
begin
  if p_research.status is distinct from 'published' then
    return jsonb_build_object('availability','no_research','source_urls','[]'::jsonb,
      'observed_at',null,'extractor_version',null,'proposals','[]'::jsonb);
  end if;
  select coalesce(array_agg(u order by u),'{}'::text[]) into v_sources
  from (select distinct btrim(value) as u from unnest(p_research.source_urls) as s(value)) sources;
  v_domain := private.hp4_normalize_domain(p_current_website_url);
  if p_current_website_url is null or p_current_website_url !~* '^https?://'
     or v_domain is null or v_domain !~ '^[a-z0-9.-]+$'
     or cardinality(v_sources) not between 1 and 12
     or exists (
       select 1 from unnest(v_sources) u
       where u is null or char_length(u) not between 10 and 2048
         or u !~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#]|$)'
         or (private.hp4_normalize_domain(u) is distinct from v_domain
             and private.hp4_normalize_domain(u) not like '%.' || v_domain)
     ) then
    return jsonb_build_object('availability','source_mismatch','source_urls','[]'::jsonb,
      'observed_at',null,'extractor_version',null,'proposals','[]'::jsonb);
  end if;

  with raw_labels as (
    select 'product'::text as kind,unnest(p_research.products) as label
    union all select 'capability',unnest(p_research.activities)
    union all select 'market',unnest(p_research.sectors)
    union all select 'certification',unnest(p_research.certifications)
  ), cleaned as (
    select kind,btrim(regexp_replace(label,'[[:space:]]+',' ','g')) as label from raw_labels
  ), deduplicated as (
    select distinct on (kind,private.company_ux2c2_normalize_label(label)) kind,label
    from cleaned where char_length(label) between 2 and 80 and label !~* '[@/<>]|https?:|www\.'
    order by kind,private.company_ux2c2_normalize_label(label),label
  ), mapped as (
    select kind,label,private.company_ux2c2_suggest_key(kind,label) as suggested_key,
      private.company_ux2c1_description_hash(jsonb_build_array(kind,
        private.company_ux2c2_normalize_label(label))::text) as content_key
    from deduplicated
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind',kind,'content_key',content_key,'label',label,'suggested_key',suggested_key,
    'proposal_hash',private.company_ux2c1_description_hash(jsonb_build_object(
      'contract','company-ux2c2-industrial-v1','company_id',p_network_company_id,
      'kind',kind,'content_key',content_key,'label',label,'suggested_key',suggested_key,
      'mapping_version','company-ux2c2-map-v1','source_urls',to_jsonb(v_sources),
      'extractor_version',nullif(btrim(p_research.extractor_version),'')
    )::text),
    'source_urls',to_jsonb(v_sources),'observed_at',p_research.published_at,
    'extractor_version',nullif(btrim(p_research.extractor_version),''),'decision',null
  ) order by kind,content_key),'[]'::jsonb) into v_proposals from mapped;
  return jsonb_build_object('availability',case when jsonb_array_length(v_proposals)>0 then 'available' else 'empty' end,
    'source_urls',to_jsonb(v_sources),'observed_at',p_research.published_at,
    'extractor_version',nullif(btrim(p_research.extractor_version),''),'proposals',v_proposals);
end;
$fn$;
revoke all on function private.company_ux2c2_candidates(uuid,text,private.network_company_research)
  from public,anon,authenticated,service_role;

-- Only the selected group participates in CAS. Facility changes also invalidate
-- products/capabilities/certifications; a market change does not invalidate them.
-- Timestamps are excluded: they are not part of the selected industrial value.
create function private.company_ux2c2_group_state(p_network_company_id uuid,p_kind text)
returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
declare v_rows jsonb; v_facilities jsonb := '[]'::jsonb;
begin
  if p_kind is null or p_kind not in ('product','capability','market','certification') then
    raise exception 'invalid industrial group' using errcode='22023';
  end if;
  if p_kind<>'market' then
    select coalesce(jsonb_agg(to_jsonb(f)-'created_at'-'updated_at' order by f.id),'[]'::jsonb)
    into v_facilities from public.network_facilities f where f.company_id=p_network_company_id;
  end if;
  if p_kind='product' then
    select coalesce(jsonb_agg((to_jsonb(r)-'created_at') || jsonb_build_object(
      'source_ownership',a.ownership_type,'source_type',a.source_type,'source_review_state',a.review_state)
      order by r.id),'[]'::jsonb) into v_rows
    from public.network_company_products r left join public.network_data_assertions a on a.id=r.source_assertion_id
    where r.company_id=p_network_company_id;
  elsif p_kind='capability' then
    select coalesce(jsonb_agg((to_jsonb(r)-'created_at') || jsonb_build_object(
      'source_ownership',a.ownership_type,'source_type',a.source_type,'source_review_state',a.review_state)
      order by r.id),'[]'::jsonb) into v_rows
    from public.network_facility_capabilities r join public.network_facilities f on f.id=r.facility_id
    left join public.network_data_assertions a on a.id=r.source_assertion_id
    where f.company_id=p_network_company_id;
  elsif p_kind='market' then
    select coalesce(jsonb_agg((to_jsonb(r)-'created_at') || jsonb_build_object(
      'source_ownership',a.ownership_type,'source_type',a.source_type,'source_review_state',a.review_state)
      order by r.id),'[]'::jsonb) into v_rows
    from public.network_company_markets r left join public.network_data_assertions a on a.id=r.source_assertion_id
    where r.company_id=p_network_company_id;
  else
    select coalesce(jsonb_agg((to_jsonb(r)-'created_at') || jsonb_build_object(
      'source_ownership',a.ownership_type,'source_type',a.source_type,'source_review_state',a.review_state)
      order by r.id),'[]'::jsonb) into v_rows
    from public.network_company_certifications r left join public.network_data_assertions a on a.id=r.source_assertion_id
    where r.company_id=p_network_company_id;
  end if;
  return jsonb_build_object('kind',p_kind,'relations',v_rows,'facilities',v_facilities);
end;
$fn$;
revoke all on function private.company_ux2c2_group_state(uuid,text) from public,anon,authenticated,service_role;

create function private.company_ux2c2_state_hash(p_network_company_id uuid,p_kind text)
returns text language sql stable security invoker set search_path=''
as $fn$
  select private.company_ux2c1_description_hash(private.company_ux2c2_group_state(p_network_company_id,p_kind)::text);
$fn$;
revoke all on function private.company_ux2c2_state_hash(uuid,text) from public,anon,authenticated,service_role;

create function private.company_ux2c2_selection(p_kind text,p_selection jsonb)
returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
declare v_key text; v_relationship text; v_facility uuid; v_allowed text[];
begin
  if jsonb_typeof(p_selection) is distinct from 'object'
     or jsonb_typeof(p_selection->'key') is distinct from 'string' then
    raise exception 'explicit taxonomy selection required' using errcode='22023';
  end if;
  v_key := btrim(p_selection->>'key');
  if v_key !~ '^[a-z][a-z0-9_]{0,79}$' then
    raise exception 'invalid taxonomy key' using errcode='22023';
  end if;
  if p_kind='product' then
    v_allowed := array['key','relationship_type','facility_id'];
  elsif p_kind in ('capability','certification') then
    v_allowed := array['key','facility_id'];
  elsif p_kind='market' then
    v_allowed := array['key'];
  else
    raise exception 'invalid industrial group' using errcode='22023';
  end if;
  if p_selection-v_allowed<>'{}'::jsonb then
    raise exception 'unexpected industrial selection fields' using errcode='22023';
  end if;
  if p_kind<>'market' then
    if not (p_selection ? 'facility_id') then
      raise exception 'explicit company or facility scope required' using errcode='22023';
    end if;
    if jsonb_typeof(p_selection->'facility_id')='null' then
      v_facility := null;
    elsif jsonb_typeof(p_selection->'facility_id')='string' then
      begin
        v_facility := (p_selection->>'facility_id')::uuid;
      exception when invalid_text_representation then
        raise exception 'invalid facility identity' using errcode='22023';
      end;
    else
      raise exception 'invalid facility identity' using errcode='22023';
    end if;
    if p_kind='capability' and v_facility is null then
      raise exception 'a capability requires an existing facility' using errcode='22023';
    end if;
  end if;
  if p_kind='product' then
    if jsonb_typeof(p_selection->'relationship_type') is distinct from 'string' then
      raise exception 'explicit product relationship required' using errcode='22023';
    end if;
    v_relationship := btrim(p_selection->>'relationship_type');
    if v_relationship not in ('produces','distributes','stocks','processes','uses') then
      raise exception 'invalid product relationship' using errcode='22023';
    end if;
    return jsonb_build_object('key',v_key,'relationship_type',v_relationship,'facility_id',v_facility);
  elsif p_kind='market' then
    return jsonb_build_object('key',v_key);
  end if;
  return jsonb_build_object('key',v_key,'facility_id',v_facility);
end;
$fn$;
revoke all on function private.company_ux2c2_selection(text,jsonb) from public,anon,authenticated,service_role;

create function private.company_ux2c2_lock_group(p_network_company_id uuid,p_kind text)
returns void language plpgsql security invoker set search_path=''
as $fn$
begin
  if p_kind<>'market' then
    -- Capabilities reference the facility rather than the company: these locks
    -- also serialize new capability FK inserts with the C.2 decision.
    perform f.id from public.network_facilities f where f.company_id=p_network_company_id order by f.id for update;
  end if;
  if p_kind='product' then
    perform r.id from public.network_company_products r where r.company_id=p_network_company_id order by r.id for update;
  elsif p_kind='capability' then
    perform r.id from public.network_facility_capabilities r join public.network_facilities f on f.id=r.facility_id
    where f.company_id=p_network_company_id order by r.id for update of r;
  elsif p_kind='market' then
    perform r.id from public.network_company_markets r where r.company_id=p_network_company_id order by r.id for update;
  elsif p_kind='certification' then
    perform r.id from public.network_company_certifications r where r.company_id=p_network_company_id order by r.id for update;
  else
    raise exception 'invalid industrial group' using errcode='22023';
  end if;
end;
$fn$;
revoke all on function private.company_ux2c2_lock_group(uuid,text) from public,anon,authenticated,service_role;

create function private.company_ux2c2_industrial_review_impl(p_organization_id uuid,p_network_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare
  v_company public.network_companies%rowtype;
  v_research private.network_company_research%rowtype;
  v_decision private.company_ux2c2_industrial_decisions%rowtype;
  v_candidates jsonb;
  v_proposal jsonb;
  v_proposals jsonb := '[]'::jsonb;
begin
  perform private.company_ux2c1_require_owner(p_organization_id,p_network_company_id);
  select * into v_company from public.network_companies where id=p_network_company_id;
  select * into v_research from private.network_company_research where company_id=p_network_company_id;
  v_candidates := private.company_ux2c2_candidates(p_network_company_id,v_company.website_url,v_research);
  for v_proposal in select value from jsonb_array_elements(v_candidates->'proposals') loop
    select * into v_decision from private.company_ux2c2_industrial_decisions
    where organization_id=p_organization_id and network_company_id=p_network_company_id
      and content_key=v_proposal->>'content_key';
    if found then
      v_proposal := jsonb_build_object(
        'kind',v_decision.kind,'content_key',v_decision.content_key,'proposal_hash',v_decision.proposal_hash,
        'label',v_decision.label,'suggested_key',v_decision.suggested_key,
        'source_urls',to_jsonb(v_decision.source_urls),'observed_at',v_decision.observed_at,
        'extractor_version',v_decision.extractor_version,'decision',jsonb_build_object(
          'action',v_decision.decision,'effect',v_decision.effect,'decided_at',v_decision.decided_at,
          'target_id',v_decision.target_id,'selection',v_decision.selection)
      );
    end if;
    v_proposals := v_proposals || jsonb_build_array(v_proposal);
  end loop;
  return jsonb_build_object('contract','company-ux2c2-industrial-v1','network_company_id',p_network_company_id,
    'availability',v_candidates->>'availability','source_urls',v_candidates->'source_urls',
    'observed_at',v_candidates->'observed_at','extractor_version',v_candidates->'extractor_version',
    'state_hashes',jsonb_build_object(
      'products',private.company_ux2c2_state_hash(p_network_company_id,'product'),
      'capabilities',private.company_ux2c2_state_hash(p_network_company_id,'capability'),
      'markets',private.company_ux2c2_state_hash(p_network_company_id,'market'),
      'certifications',private.company_ux2c2_state_hash(p_network_company_id,'certification')),
    'proposals',v_proposals);
end;
$fn$;
revoke all on function private.company_ux2c2_industrial_review_impl(uuid,uuid) from public,anon,service_role;
grant execute on function private.company_ux2c2_industrial_review_impl(uuid,uuid) to authenticated;

create function public.company_ux2c2_industrial_review(p_organization_id uuid,p_network_company_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $fn$
  select private.company_ux2c2_industrial_review_impl(p_organization_id,p_network_company_id);
$fn$;
revoke all on function public.company_ux2c2_industrial_review(uuid,uuid) from public,anon,service_role;
grant execute on function public.company_ux2c2_industrial_review(uuid,uuid) to authenticated;

create function private.company_ux2c2_decide_industrial_impl(
  p_organization_id uuid,p_network_company_id uuid,p_expected_proposal_hash text,
  p_expected_state_hash text,p_action text,p_selection jsonb default null
)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
  v_user uuid;
  v_company public.network_companies%rowtype;
  v_after public.network_companies%rowtype;
  v_research private.network_company_research%rowtype;
  v_existing private.company_ux2c2_industrial_decisions%rowtype;
  v_candidates jsonb;
  v_proposal jsonb;
  v_selection jsonb;
  v_writer_result jsonb;
  v_kind text;
  v_action text;
  v_key text;
  v_relationship text;
  v_facility uuid;
  v_taxonomy_id uuid;
  v_target_id uuid;
  v_decision_id uuid;
  v_before_hash text;
  v_after_hash text;
  v_effect text;
  v_changed boolean := false;
  v_sources text[];
begin
  -- P3.7 writers also support platform operators; C.2 deliberately requires the
  -- stricter active company admin + link + approved claim in the explicit org.
  v_user := private.company_ux2c1_require_owner(p_organization_id,p_network_company_id);
  if p_expected_proposal_hash is null or p_expected_proposal_hash !~ '^[a-f0-9]{64}$'
     or p_expected_state_hash is null or p_expected_state_hash !~ '^[a-f0-9]{64}$'
     or p_action is null or p_action not in ('confirm','ignore')
     or (p_action='ignore' and p_selection is not null)
     or (p_action='confirm' and jsonb_typeof(p_selection) is distinct from 'object') then
    raise exception 'invalid industrial decision input' using errcode='22023';
  end if;
  v_action := case p_action when 'confirm' then 'confirmed' else 'ignored' end;
  select * into v_company from public.network_companies where id=p_network_company_id for update;
  perform private.company_ux2c1_require_owner(p_organization_id,p_network_company_id);

  select * into v_existing from private.company_ux2c2_industrial_decisions
  where organization_id=p_organization_id and network_company_id=p_network_company_id
    and proposal_hash=p_expected_proposal_hash;
  if found then
    v_selection := case when p_action='confirm'
      then private.company_ux2c2_selection(v_existing.kind,p_selection) else null end;
    if v_existing.decision<>v_action or v_existing.selection is distinct from v_selection then
      raise exception 'company_ux2c2_already_decided' using errcode='40001';
    end if;
    return jsonb_build_object('contract','company-ux2c2-industrial-v1',
      'decision',v_existing.decision,'effect',v_existing.effect,'decision_id',v_existing.id,
      'changed',false,'idempotent',true,'target_id',v_existing.target_id,
      'state_hash',private.company_ux2c2_state_hash(p_network_company_id,v_existing.kind));
  end if;

  -- Match C.1/research ordering: company first, then the research snapshot.
  select * into v_research from private.network_company_research
  where company_id=p_network_company_id for share;
  v_candidates := private.company_ux2c2_candidates(p_network_company_id,v_company.website_url,v_research);
  select value into v_proposal from jsonb_array_elements(v_candidates->'proposals')
  where value->>'proposal_hash'=p_expected_proposal_hash;
  if not found then
    raise exception 'company_ux2c2_proposal_changed' using errcode='40001';
  end if;
  v_kind := v_proposal->>'kind';
  v_selection := case when p_action='confirm'
    then private.company_ux2c2_selection(v_kind,p_selection) else null end;
  perform private.company_ux2c2_lock_group(p_network_company_id,v_kind);
  v_before_hash := private.company_ux2c2_state_hash(p_network_company_id,v_kind);
  if v_before_hash is distinct from p_expected_state_hash then
    raise exception 'company_ux2c2_state_changed' using errcode='40001';
  end if;
  if exists (select 1 from private.company_ux2c2_industrial_decisions
    where organization_id=p_organization_id and network_company_id=p_network_company_id
      and content_key=v_proposal->>'content_key') then
    raise exception 'company_ux2c2_already_decided' using errcode='40001';
  end if;

  if p_action='confirm' then
    v_key := v_selection->>'key';
    v_facility := (v_selection->>'facility_id')::uuid;
    v_relationship := v_selection->>'relationship_type';
    if v_facility is not null and not exists (
      select 1 from public.network_facilities f where f.id=v_facility
        and f.company_id=p_network_company_id and f.publication_status<>'archived' and f.archived_at is null
    ) then
      raise exception 'managed company facility required' using errcode='42501';
    end if;

    -- The selected canonical key is an explicit company choice, not a client
    -- assertion of what the model knows. Keep its active taxonomy row stable.
    if v_kind='product' then
      select id into v_taxonomy_id from public.network_product_families
      where canonical_key=v_key and status='active' for share;
    elsif v_kind='capability' then
      select id into v_taxonomy_id from public.network_capabilities
      where canonical_key=v_key and status='active' for share;
    elsif v_kind='market' then
      select id into v_taxonomy_id from public.network_markets
      where canonical_key=v_key and status='active' for share;
    else
      select id into v_taxonomy_id from public.network_certification_types
      where canonical_key=v_key and status='active' for share;
    end if;
    if v_taxonomy_id is null then
      raise exception 'active taxonomy selection required' using errcode='22023';
    end if;

    if v_kind='product' then
      select id into v_target_id from public.network_company_products
      where company_id=p_network_company_id and product_family_id=v_taxonomy_id
        and relationship_type=v_relationship and facility_id is not distinct from v_facility
      order by created_at,id limit 1;
    elsif v_kind='capability' then
      select id into v_target_id from public.network_facility_capabilities
      where facility_id=v_facility and capability_id=v_taxonomy_id;
    elsif v_kind='market' then
      select id into v_target_id from public.network_company_markets
      where company_id=p_network_company_id and market_id=v_taxonomy_id;
    else
      -- Multiple real certificates of one type can legitimately coexist. C.2
      -- only knows type+scope, so any existing match is left to manual management.
      select id into v_target_id from public.network_company_certifications
      where company_id=p_network_company_id and certification_type_id=v_taxonomy_id
        and facility_id is not distinct from v_facility
      order by created_at,id limit 1;
    end if;

    if v_target_id is not null then
      v_effect := 'already_present';
      -- In particular, never replace a platform/manual source assertion with a
      -- company assertion just because the research also mentioned this value.
    else
      if v_kind='product' then
        v_writer_result := private.p3_7b_set_product_impl(
          p_network_company_id,v_key,v_relationship,v_facility,true);
        v_target_id := (v_writer_result->>'relation_id')::uuid;
      elsif v_kind='capability' then
        v_writer_result := private.p3_7b_set_facility_capability_impl(
          p_network_company_id,v_facility,v_key,true);
        v_target_id := (v_writer_result->>'relation_id')::uuid;
      elsif v_kind='market' then
        v_writer_result := private.p3_7b_set_market_impl(p_network_company_id,v_key,true);
        v_target_id := (v_writer_result->>'relation_id')::uuid;
      else
        -- No issuer, dates, identifier, evidence_reference or scope_text is
        -- inferred from the code or the shared list of research URLs.
        v_writer_result := private.p3_7b_upsert_certification_impl(
          p_network_company_id,null,jsonb_build_object('certification_type_key',v_key,'facility_id',v_facility));
        v_target_id := (v_writer_result->>'certification_id')::uuid;
      end if;
      if v_target_id is null then
        raise exception 'industrial writer returned no target' using errcode='40001';
      end if;
      v_changed := not coalesce((v_writer_result->>'idempotent')::boolean,false);
      v_effect := case when v_changed then 'added' else 'already_present' end;
    end if;

    select * into v_after from public.network_companies where id=p_network_company_id;
    if v_after.legal_name is distinct from v_company.legal_name
       or v_after.trading_name is distinct from v_company.trading_name
       or v_after.country_code is distinct from v_company.country_code
       or v_after.registration_id is distinct from v_company.registration_id
       or v_after.vat_id is distinct from v_company.vat_id
       or v_after.website_url is distinct from v_company.website_url
       or v_after.website_domain is distinct from v_company.website_domain
       or v_after.description is distinct from v_company.description
       or v_after.publication_status is distinct from v_company.publication_status
       or v_after.verification_status is distinct from v_company.verification_status
       or v_after.claimed_status is distinct from v_company.claimed_status then
      raise exception 'company_ux2c2_unexpected_company_change' using errcode='40001';
    end if;
  else
    v_effect := 'ignored';
  end if;

  v_after_hash := private.company_ux2c2_state_hash(p_network_company_id,v_kind);
  select array_agg(value order by ordinality) into v_sources
  from jsonb_array_elements_text(v_proposal->'source_urls') with ordinality;
  insert into private.company_ux2c2_industrial_decisions(
    organization_id,network_company_id,actor_user_id,kind,content_key,proposal_hash,label,suggested_key,
    source_urls,observed_at,extractor_version,decision,effect,selection,target_id,before_state_hash,after_state_hash
  ) values (
    p_organization_id,p_network_company_id,v_user,v_kind,v_proposal->>'content_key',v_proposal->>'proposal_hash',
    v_proposal->>'label',v_proposal->>'suggested_key',v_sources,(v_proposal->>'observed_at')::timestamptz,
    v_proposal->>'extractor_version',v_action,v_effect,v_selection,v_target_id,v_before_hash,v_after_hash
  ) returning id into v_decision_id;
  return jsonb_build_object('contract','company-ux2c2-industrial-v1','decision',v_action,
    'effect',v_effect,'decision_id',v_decision_id,'changed',v_changed,'idempotent',false,
    'target_id',v_target_id,'state_hash',v_after_hash);
exception when unique_violation or deadlock_detected then
  -- A legacy manual writer may have read before the C.2 locks. Its natural
  -- product/capability/market uniqueness still wins: roll back the entire C.2
  -- attempt, including assertions/events, and ask for a current view.
  -- Certificates intentionally have no new global uniqueness constraint: a
  -- legitimate manual certificate inserted after this decision is not blocked.
  raise exception 'company_ux2c2_concurrent_change' using errcode='40001';
end;
$fn$;
revoke all on function private.company_ux2c2_decide_industrial_impl(uuid,uuid,text,text,text,jsonb)
  from public,anon,service_role;
grant execute on function private.company_ux2c2_decide_industrial_impl(uuid,uuid,text,text,text,jsonb) to authenticated;

create function public.company_ux2c2_decide_industrial(
  p_organization_id uuid,p_network_company_id uuid,p_expected_proposal_hash text,
  p_expected_state_hash text,p_action text,p_selection jsonb default null
)
returns jsonb language sql security invoker set search_path=''
as $fn$
  select private.company_ux2c2_decide_industrial_impl(
    p_organization_id,p_network_company_id,p_expected_proposal_hash,p_expected_state_hash,p_action,p_selection);
$fn$;
revoke all on function public.company_ux2c2_decide_industrial(uuid,uuid,text,text,text,jsonb)
  from public,anon,service_role;
grant execute on function public.company_ux2c2_decide_industrial(uuid,uuid,text,text,text,jsonb) to authenticated;
