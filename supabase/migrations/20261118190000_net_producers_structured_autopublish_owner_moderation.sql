-- NET-PRO-PRODUCERS1.C3.DATA1 — publish structured atomic steel facts first.
-- Every number/grade/standard/shape is ONE attributed source assertion.
-- No implied manufacturer capability/stock or cross-product joins.
-- Company can confirm or remove each fact after independent claim proof.

create table private.network_producer_structured_facts (
  id uuid primary key default gen_random_uuid(),
  source_claim_id uuid not null unique
    references private.network_producer_technical_claims(id),
  company_id uuid not null references public.network_companies(id),
  product_scope text not null check(length(product_scope) between 4 and 96),
  kind text not null check(kind in (
    'technical_standard','steel_grade','section_shape',
    'dimension_range','manufacturing_process'
  )),
  value text not null check(length(value) between 2 and 200),
  source_url text not null check(source_url ~ '^https://[^[:space:]<>]+$'),
  source_title text not null check(length(source_title) between 6 and 160),
  -- Numeric ranges belong ONLY to this source observation.
  -- A width, grade or standard from another row is never joined.
  shape_code text check(shape_code in ('CHS','SHS','RHS')),
  diameter_min_mm numeric(9,3),
  diameter_max_mm numeric(9,3),
  width_min_mm numeric(9,3),
  width_max_mm numeric(9,3),
  height_min_mm numeric(9,3),
  height_max_mm numeric(9,3),
  thickness_min_mm numeric(9,3),
  thickness_max_mm numeric(9,3),
  producer_review text not null default 'pending'
    check(producer_review in ('pending','confirmed','removed')),
  visibility text not null default 'published'
    check(visibility in ('published','withdrawn')),
  published_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  updated_at timestamptz not null default now(),
  constraint structured_dimensions_valid check(
    (diameter_min_mm is null or (diameter_min_mm>0 and diameter_max_mm>=diameter_min_mm))
    and (width_min_mm is null or (width_min_mm>0 and width_max_mm>=width_min_mm))
    and (height_min_mm is null or (height_min_mm>0 and height_max_mm>=height_min_mm))
    and (thickness_min_mm is null or (thickness_min_mm>0 and thickness_max_mm>=thickness_min_mm))
  ),
  constraint structured_shape_valid check(
    (shape_code='CHS' and width_min_mm is null and height_min_mm is null)
    or (shape_code in ('SHS','RHS') and diameter_min_mm is null)
    or (shape_code is null and diameter_min_mm is null and width_min_mm is null)
  )
);
alter table private.network_producer_structured_facts enable row level security;
revoke all on private.network_producer_structured_facts from public,anon,authenticated,service_role;
create index network_producer_structured_facts_public_idx
  on private.network_producer_structured_facts(company_id,product_scope,kind)
  where visibility='published' and producer_review<>'removed';

create table private.network_producer_structured_fact_events (
  id bigint generated always as identity primary key,
  fact_id uuid not null references private.network_producer_structured_facts(id),
  company_id uuid not null references public.network_companies(id),
  actor_id uuid,
  action text not null check(action in ('auto_published','owner_confirmed','owner_removed','owner_restored','source_withdrawn')),
  occurred_at timestamptz not null default now()
);
alter table private.network_producer_structured_fact_events enable row level security;
revoke all on private.network_producer_structured_fact_events from public,anon,authenticated,service_role;
create function private.netproducers1_structured_events_immutable()
returns trigger language plpgsql set search_path=''
as $body$
begin
  raise exception 'Producer fact review history is append only' using errcode='42501';
end;
$body$;
create trigger netproducers1_structured_events_append_only
  before update or delete on private.network_producer_structured_fact_events
  for each row execute function private.netproducers1_structured_events_immutable();

-- Extract numeric extrema from ONE first-party range phrase: not SKUs,
-- not complete size availability, not grade/dimension associations.
create function private.netproducers1_structure_dimension(p_value text)
returns jsonb language plpgsql immutable set search_path=''
as $body$
declare
  v_shape text;
  v_d text[];
  v_wh text[];
  v_t text[];
  v_result jsonb:='{}'::jsonb;
begin
  if p_value is null or length(p_value)>200 then return v_result; end if;
  if lower(p_value) like 'tondo%' then v_shape:='CHS';
  elsif lower(p_value) like 'quadro%' then v_shape:='SHS';
  elsif lower(p_value) like 'rettangolare%' then v_shape:='RHS';
  end if;
  if v_shape is not null then
    v_result:=jsonb_build_object('shape_code',v_shape);
  end if;
  if v_shape='CHS' then
    v_d:=regexp_match(p_value,
      'Ø[[:space:]]*([0-9]+[,.]?[0-9]*)[[:space:]]*[–-][[:space:]]*([0-9]+[,.]?[0-9]*)');
    if v_d is not null then
      v_result:=v_result||jsonb_build_object(
        'diameter_min_mm',replace(v_d[1],',','.')::numeric,
        'diameter_max_mm',replace(v_d[2],',','.')::numeric);
    end if;
  elsif v_shape in ('SHS','RHS') then
    v_wh:=regexp_match(p_value,
      '([0-9]+[,.]?[0-9]*)[×xX]([0-9]+[,.]?[0-9]*)[[:space:]]*[–-][[:space:]]*([0-9]+[,.]?[0-9]*)[×xX]([0-9]+[,.]?[0-9]*)');
    if v_wh is not null then
      v_result:=v_result||jsonb_build_object(
        'width_min_mm',replace(v_wh[1],',','.')::numeric,
        'height_min_mm',replace(v_wh[2],',','.')::numeric,
        'width_max_mm',replace(v_wh[3],',','.')::numeric,
        'height_max_mm',replace(v_wh[4],',','.')::numeric);
    end if;
  end if;
  v_t:=regexp_match(p_value,
    '(sp[.]|spessore[^:]{0,50}:)[[:space:]]*([0-9]+[,.]?[0-9]*)[[:space:]]*[–-][[:space:]]*([0-9]+[,.]?[0-9]*)',
    'i');
  if v_t is not null then
    v_result:=v_result||jsonb_build_object(
      'thickness_min_mm',replace(v_t[2],',','.')::numeric,
      'thickness_max_mm',replace(v_t[3],',','.')::numeric);
  end if;
  return v_result;
end;
$body$;

create function private.netproducers1_structured_sync_claim(p_claim uuid)
returns void language plpgsql security definer set search_path=''
as $body$
declare
  v private.network_producer_technical_claims%rowtype;
  v_norm jsonb;
  v_id uuid;
  v_valid boolean;
begin
  select * into v from private.network_producer_technical_claims where id=p_claim;
  if not found then return; end if;
  select exists(
    select 1 from public.network_companies c
    join public.network_company_role_assignments a on a.company_id=c.id
    join public.network_company_roles r on r.id=a.role_id
    where c.id=v.company_id and c.country_code='IT'
      and c.publication_status='published' and c.archived_at is null
      and c.website_domain is not null
      and length(c.website_domain)>4
      and r.canonical_key='producer' and r.status='active'
      -- Accept canonical first-party hostname or first-party subdomain only.
      and (
        regexp_replace(lower(split_part(v.source_url,'/',3)),'^www[.]','') =
          regexp_replace(lower(c.website_domain),'^www[.]','')
        or right(regexp_replace(lower(split_part(v.source_url,'/',3)),'^www[.]',''),
                 length(regexp_replace(lower(c.website_domain),'^www[.]',''))+1)
           ='.'||regexp_replace(lower(c.website_domain),'^www[.]','')
      )
  ) into v_valid;
  if not v_valid or v.evidence_status<>'first_party_observed'
    or v.rights_status<>'link_only' then
    update private.network_producer_structured_facts
      set visibility='withdrawn',updated_at=now()
    where source_claim_id=p_claim and visibility='published'
    returning id into v_id;
    if v_id is not null then
      insert into private.network_producer_structured_fact_events(
        fact_id,company_id,action
      ) values(v_id,v.company_id,'source_withdrawn');
    end if;
    return;
  end if;

  v_norm:=case when v.claim_kind='dimension_range'
    then private.netproducers1_structure_dimension(v.claim_value)
    else '{}'::jsonb end;

  insert into private.network_producer_structured_facts(
    source_claim_id,company_id,product_scope,kind,value,source_url,
    source_title,shape_code,diameter_min_mm,diameter_max_mm,
    width_min_mm,width_max_mm,height_min_mm,height_max_mm,
    thickness_min_mm,thickness_max_mm
  ) values(
    v.id,v.company_id,v.product_scope,v.claim_kind,v.claim_value,v.source_url,
    v.source_title,v_norm->>'shape_code',
    (v_norm->>'diameter_min_mm')::numeric,(v_norm->>'diameter_max_mm')::numeric,
    (v_norm->>'width_min_mm')::numeric,(v_norm->>'width_max_mm')::numeric,
    (v_norm->>'height_min_mm')::numeric,(v_norm->>'height_max_mm')::numeric,
    (v_norm->>'thickness_min_mm')::numeric,(v_norm->>'thickness_max_mm')::numeric
  )
  on conflict(source_claim_id) do update set
    product_scope=excluded.product_scope,
    kind=excluded.kind,value=excluded.value,source_url=excluded.source_url,
    source_title=excluded.source_title,shape_code=excluded.shape_code,
    diameter_min_mm=excluded.diameter_min_mm,
    diameter_max_mm=excluded.diameter_max_mm,
    width_min_mm=excluded.width_min_mm,width_max_mm=excluded.width_max_mm,
    height_min_mm=excluded.height_min_mm,height_max_mm=excluded.height_max_mm,
    thickness_min_mm=excluded.thickness_min_mm,
    thickness_max_mm=excluded.thickness_max_mm,
    updated_at=now()
  -- Never silently restore a producer-removed or source-withdrawn assertion.
  where private.network_producer_structured_facts.producer_review<>'removed'
    and private.network_producer_structured_facts.visibility='published'
  returning id into v_id;

  if v_id is not null and not exists(
    select 1 from private.network_producer_structured_fact_events
    where fact_id=v_id
  ) then
    insert into private.network_producer_structured_fact_events(
      fact_id,company_id,action
    ) values(v_id,v.company_id,'auto_published');
  end if;
end;
$body$;

create function private.netproducers1_structured_claim_trigger()
returns trigger language plpgsql security definer set search_path=''
as $body$
begin
  perform private.netproducers1_structured_sync_claim(new.id);
  return new;
end;
$body$;
create trigger netproducers1_structured_auto_publish
  after insert or update of evidence_status,claim_value,source_url,source_title,product_scope
  on private.network_producer_technical_claims
  for each row execute function private.netproducers1_structured_claim_trigger();

-- New trusted first-party observations auto-publish without requiring a
-- separate catalogue-link registration, claim or manual per-record approval.
-- Website identity, evidence status and publisher role remain checked.
-- One-off first ingestion of ALREADY OBSERVED single-source facts.
do $seed$
declare v_claim uuid;
begin
  for v_claim in
    select id from private.network_producer_technical_claims
    where evidence_status='first_party_observed' and rights_status='link_only'
  loop
    perform private.netproducers1_structured_sync_claim(v_claim);
  end loop;
end;
$seed$;

-- Public facts are separate rows, never a fabricated full SKU.
create function sec1_public.netproducers1_structured_public_impl(
  p_search text default '',p_limit integer default 160
) returns jsonb language plpgsql stable security definer set search_path=''
as $body$
declare
  v_search text:=lower(trim(coalesce(p_search,'')));
  v_rows jsonb;
  v_total int;
  v_firms int;
begin
  if p_search is not null and length(p_search)>100
    or p_limit is null or p_limit not between 1 and 160
  then
    raise exception 'Invalid structured producer search bounds' using errcode='22023';
  end if;
  select count(*),count(distinct s.company_id)
    into v_total,v_firms
  from private.network_producer_structured_facts s
  join public.network_companies c on c.id=s.company_id
  where c.publication_status='published' and c.archived_at is null
    and c.country_code='IT'
    and s.visibility='published' and s.producer_review<>'removed'
    and exists (
      select 1 from public.network_company_role_assignments a
      join public.network_company_roles r on r.id=a.role_id
      where a.company_id=c.id and r.canonical_key='producer'
        and r.status='active'
    );
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'company_id',q.company_id,'company_name',q.legal_name,
    'product_scope',q.product_scope,
    'kind',q.kind,'value',q.value,'source_url',q.source_url,
    'source_title',q.source_title,
    'shape_code',q.shape_code,
    'diameter_min_mm',q.diameter_min_mm,'diameter_max_mm',q.diameter_max_mm,
    'width_min_mm',q.width_min_mm,'width_max_mm',q.width_max_mm,
    'height_min_mm',q.height_min_mm,'height_max_mm',q.height_max_mm,
    'thickness_min_mm',q.thickness_min_mm,'thickness_max_mm',q.thickness_max_mm,
    'review_status',case when q.producer_review='confirmed'
      then 'attribute_confirmed_by_producer'
      else 'pending_producer_confirmation' end
  ) order by q.legal_name,q.product_scope,q.kind,q.value),'[]'::jsonb)
  into v_rows
  from (
    select s.*,c.legal_name
    from private.network_producer_structured_facts s
    join public.network_companies c on c.id=s.company_id
    where c.country_code='IT' and c.publication_status='published'
      and c.archived_at is null
      and s.visibility='published' and s.producer_review<>'removed'
      and exists (
        select 1 from public.network_company_role_assignments a
        join public.network_company_roles r on r.id=a.role_id
        where a.company_id=c.id and r.canonical_key='producer'
          and r.status='active'
      )
      and (
        v_search='' or position(v_search in lower(
          c.legal_name||' '||s.product_scope||' '||s.kind||' '||s.value
        ))>0
      )
    order by c.legal_name,s.product_scope,s.kind,s.value
    limit p_limit
  ) q;
  return jsonb_build_object(
    'contract','netproducers-structured-public-v1',
    'total_facts',v_total,'producers',v_firms,
    'items',v_rows,'count',jsonb_array_length(v_rows),
    'exact_skus_confirmed',0,'source_pdf_copies',0
  );
end;
$body$;
create function public.netproducers1_structured_public(
  p_search text default '',p_limit integer default 160
) returns jsonb language sql stable security invoker set search_path=''
as $body$
  select sec1_public.netproducers1_structured_public_impl(p_search,p_limit);
$body$;
revoke all on function sec1_public.netproducers1_structured_public_impl(text,integer)
  from public,anon,authenticated;
revoke all on function public.netproducers1_structured_public(text,integer)
  from public,anon,authenticated;
grant execute on function sec1_public.netproducers1_structured_public_impl(text,integer)
  to anon,authenticated,service_role;
grant execute on function public.netproducers1_structured_public(text,integer)
  to anon,authenticated,service_role;

-- Verified company admins may confirm a SINGLE attribute or remove it at once;
-- this never certifies a composite grade × standard × dimension or live stock.
create function private.netproducers1_structured_owner_manage(
  p_operation text,p_company uuid,p_fact uuid default null
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare
  v_fact private.network_producer_structured_facts%rowtype;
  v_items jsonb;
  v_action text;
begin
  if p_company is null or
    not private.netproducers1_b3c2_is_authorized_company_admin(p_company) then
    raise exception 'Verified producer administrator required' using errcode='42501';
  end if;
  if p_operation='list' and p_fact is null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',x.id,'value',x.value,'kind',x.kind,
      'product_scope',x.product_scope,'review_status',x.producer_review
    ) order by x.product_scope,x.kind,x.value),'[]'::jsonb)
      into v_items
    from (select id,value,kind,product_scope,producer_review
      from private.network_producer_structured_facts
      where company_id=p_company and visibility='published'
      order by product_scope,kind,value limit 160) x;
    return jsonb_build_object('contract','netproducers-structured-owner-v1',
      'items',v_items,'count',jsonb_array_length(v_items));
  end if;
  if p_operation not in ('confirm','remove','restore') or p_fact is null then
    raise exception 'Invalid owner moderation request' using errcode='22023';
  end if;
  select * into v_fact from private.network_producer_structured_facts
    where id=p_fact and company_id=p_company and visibility='published'
    for update;
  if not found then
    raise exception 'Fact is not owned by producer' using errcode='42501';
  end if;
  if p_operation='confirm' and v_fact.producer_review='removed' then
    raise exception 'Restore before confirming' using errcode='22023';
  end if;
  update private.network_producer_structured_facts
    set producer_review=case p_operation
      when 'confirm' then 'confirmed'
      when 'remove' then 'removed'
      when 'restore' then 'pending'
      else producer_review end,
      reviewed_at=now(),reviewed_by=(select auth.uid()),updated_at=now()
    where id=p_fact;
  v_action:=case p_operation
    when 'confirm' then 'owner_confirmed'
    when 'remove' then 'owner_removed'
    else 'owner_restored' end;
  insert into private.network_producer_structured_fact_events(
    fact_id,company_id,actor_id,action
  ) values(p_fact,p_company,(select auth.uid()),v_action);
  return jsonb_build_object('contract','netproducers-structured-owner-v1',
    'status',p_operation,'fact_id',p_fact);
end;
$body$;
create function public.netproducers1_structured_owner_manage(
  p_operation text,p_company uuid,p_fact uuid default null
) returns jsonb language sql security invoker set search_path=''
as $body$
 select private.netproducers1_structured_owner_manage(p_operation,p_company,p_fact);
$body$;
revoke all on function private.netproducers1_structured_owner_manage(text,uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.netproducers1_structured_owner_manage(text,uuid,uuid)
  from public,anon,authenticated;
grant execute on function private.netproducers1_structured_owner_manage(text,uuid,uuid)
  to authenticated;
grant execute on function public.netproducers1_structured_owner_manage(text,uuid,uuid)
  to authenticated;

-- Internal writers stay inaccessible to browser roles even when private schema
-- USAGE is enabled for other reviewed authenticated RPC implementations.
revoke all on function private.netproducers1_structured_sync_claim(uuid)
  from public,anon,authenticated;
revoke all on function private.netproducers1_structure_dimension(text)
  from public,anon,authenticated;
revoke all on function private.netproducers1_structured_claim_trigger()
  from public,anon,authenticated;
revoke all on function private.netproducers1_structured_events_immutable()
  from public,anon,authenticated;
