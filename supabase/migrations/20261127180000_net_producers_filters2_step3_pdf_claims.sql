-- NET-PRODUCERS-FILTERS2 · passo 3 (founder decisions 18 and 23 Nov 2026):
-- short technical facts (standards, grades, processes, section shapes) read from
-- the producer's OWN public PDF catalogues are published at once as
-- «da confermare dal produttore»; the producer confirms or removes each one.
-- Only short facts, never tables or PDF copies. No grant (B2) is created or implied.
--
-- * private.network_producer_pdf_claims_queue: one row per official PDF link, its own
--   lease/retry cycle (independent from the B3.E size-table queue).
-- * public.netproducers3_pdf_claims(operation, payload): SERVICE ROLE ONLY.
--     seed     → queue official first-party PDF links of published Italian producers
--     claim    → lease 1–3 documents (mode 'review' never publishes; 'publish' also
--                re-leases documents only inspected in review mode)
--     stage    → validate and insert short facts into network_producer_technical_claims
--                (existing triggers publish them as structured facts, pending review)
--     complete → close the lease with counters
-- Every write re-checks: lease, company published IT producer, link official_pdf /
-- link_only / official_link_observed on the company's own domain, closed value shapes.

create table if not exists private.network_producer_pdf_claims_queue (
  company_id uuid not null references public.network_companies(id) on delete cascade,
  source_url text not null,
  status text not null default 'pending'
    check (status in ('pending','leased','inspected','complete','blocked','retry')),
  attempts int not null default 0 check (attempts between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  lease_mode text check (lease_mode in ('review','publish')),
  last_error text check (char_length(last_error)<=80),
  candidates int not null default 0 check (candidates between 0 and 40),
  published int not null default 0 check (published between 0 and 40),
  updated_at timestamptz not null default now(),
  primary key (company_id,source_url)
);
alter table private.network_producer_pdf_claims_queue enable row level security;
revoke all on private.network_producer_pdf_claims_queue from public,anon,authenticated,service_role;

create or replace function private.netproducers3_link_ok(p_company uuid,p_url text)
returns table(title text) language sql stable security definer set search_path=''
as $fn$
  select l.title
  from private.network_producer_catalog_links l
  join public.network_companies c on c.id=l.company_id
  where l.company_id=p_company and l.source_url=p_url
    and l.document_type='official_pdf' and l.rights_status='link_only'
    and l.source_status='official_link_observed'
    and l.source_url ~ '^https://[^[:space:]<>#]+$'
    and c.publication_status='published' and c.archived_at is null
    and c.country_code='IT' and c.website_domain is not null
    and lower(split_part(l.source_url,'/',3)) in (
      regexp_replace(lower(c.website_domain),'^www[.]',''),
      'www.'||regexp_replace(lower(c.website_domain),'^www[.]','')
    )
    and exists (
      select 1 from public.network_company_role_assignments a
      join public.network_company_roles r on r.id=a.role_id
      where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
    );
$fn$;
revoke all on function private.netproducers3_link_ok(uuid,text) from public,anon,authenticated,service_role;

create or replace function private.netproducers3_pdf_claims_impl(p_operation text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
  v_limit int; v_added int:=0; v_rows jsonb; v_count int:=0;
  v_company uuid; v_url text; v_token uuid; v_status text; v_mode text;
  v_title text; v_item jsonb; v_kind text; v_value text; v_page int; v_new int:=0;
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>20000 then
    raise exception 'Bad F2 payload' using errcode='22023';
  end if;

  if p_operation='seed' then
    v_limit:=coalesce((p_payload->>'limit')::int,40);
    if v_limit not between 1 and 100 then raise exception 'Bad seed limit' using errcode='22023'; end if;
    with eligible as (
      select l.company_id,l.source_url
      from private.network_producer_catalog_links l
      where exists (select 1 from private.netproducers3_link_ok(l.company_id,l.source_url))
        and not exists (select 1 from private.network_producer_pdf_claims_queue q
                        where q.company_id=l.company_id and q.source_url=l.source_url)
      order by l.company_id,l.source_url limit v_limit
    ), added as (
      insert into private.network_producer_pdf_claims_queue(company_id,source_url)
      select company_id,source_url from eligible
      on conflict (company_id,source_url) do nothing returning 1
    ) select count(*) into v_added from added;
    return jsonb_build_object('contract','netproducers3-pdf-claims-v1','operation','seed','added',v_added);

  elsif p_operation='claim' then
    v_limit:=coalesce((p_payload->>'limit')::int,1);
    v_mode:=p_payload->>'mode';
    if v_limit not between 1 and 3 or v_mode not in ('review','publish') then
      raise exception 'Bad claim request' using errcode='22023';
    end if;
    with selected as (
      select q.company_id,q.source_url from private.network_producer_pdf_claims_queue q
      where q.next_attempt_at<=now() and q.attempts<10
        and (q.status in ('pending','retry')
             or (q.status='inspected' and v_mode='publish')
             or (q.status='leased' and q.lease_until<now()))
      order by (q.status='inspected'),q.updated_at
      limit v_limit for update skip locked
    ), leased as (
      update private.network_producer_pdf_claims_queue q
      set status='leased',attempts=q.attempts+1,lease_token=gen_random_uuid(),
          lease_until=now()+interval '10 minutes',lease_mode=v_mode,updated_at=now()
      from selected s where q.company_id=s.company_id and q.source_url=s.source_url
      returning q.company_id,q.source_url,q.lease_token
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'company_id',ld.company_id,'source_url',ld.source_url,'lease_token',ld.lease_token,
      'canonical_domain',regexp_replace(lower(c.website_domain),'^www[.]',''),
      'source_status','official_link_observed','rights_status','link_only')),'[]'::jsonb),count(*)
    into v_rows,v_count
    from leased ld join public.network_companies c on c.id=ld.company_id;
    return jsonb_build_object('contract','netproducers3-pdf-claims-v1','operation','claim',
      'mode',v_mode,'items',v_rows,'count',v_count);

  elsif p_operation='stage' then
    v_company:=(p_payload->>'company_id')::uuid;
    v_url:=p_payload->>'source_url';
    v_token:=(p_payload->>'lease_token')::uuid;
    if v_company is null or v_url is null or v_token is null
       or jsonb_typeof(p_payload->'facts')<>'array'
       or jsonb_array_length(p_payload->'facts') not between 1 and 40 then
      raise exception 'Bad F2 stage request' using errcode='22023';
    end if;
    perform 1 from private.network_producer_pdf_claims_queue q
      where q.company_id=v_company and q.source_url=v_url and q.status='leased'
        and q.lease_token=v_token and q.lease_until>now() and q.lease_mode='publish'
      for update;
    if not found then raise exception 'Stale or review-only F2 lease' using errcode='42501'; end if;
    select t.title into v_title from private.netproducers3_link_ok(v_company,v_url) t;
    if v_title is null then raise exception 'F2 source not eligible' using errcode='42501'; end if;
    for v_item in select * from jsonb_array_elements(p_payload->'facts') loop
      v_kind:=v_item->>'kind'; v_value:=btrim(coalesce(v_item->>'value','')); v_page:=(v_item->>'page')::int;
      if v_page is null or v_page not between 1 and 60
         or v_kind not in ('technical_standard','steel_grade','manufacturing_process','section_shape')
         or char_length(v_value) not between 2 and 60
         or (v_kind='technical_standard' and v_value !~ '^(EN|ASTM|API|DIN|ISO|UNI) [A-Z0-9]{1,6}(-[0-9])?$')
         or (v_kind='steel_grade' and v_value !~ '^(AISI [0-9]{3}[A-Za-z]{0,2}|[A-Z0-9][A-Za-z0-9.+-]{2,18})$')
         or (v_kind='manufacturing_process' and v_value not in (
              'Senza saldatura','Saldatura ad alta frequenza','Saldatura laser','Saldatura TIG',
              'Saldatura longitudinale','Tubi saldati','Trafilati a freddo','Formati a freddo',
              'Finiti a caldo','Laminati a caldo'))
         or (v_kind='section_shape' and v_value not in ('Tondo','Quadro','Rettangolare','Ovale')) then
        raise exception 'F2 fact rejected' using errcode='22023';
      end if;
      insert into private.network_producer_technical_claims(
        company_id,product_scope,claim_kind,claim_value,source_url,source_title,
        evidence_status,rights_status)
      values (v_company,'catalogo PDF ufficiale',v_kind,v_value,
        v_url||'#page='||v_page,
        left(case when char_length(v_title)>=6 then v_title else 'Catalogo ufficiale' end,160),
        'first_party_observed','link_only')
      on conflict (company_id,product_scope,claim_kind,claim_value,source_url) do nothing;
      get diagnostics v_count=row_count;
      v_new:=v_new+v_count;
    end loop;
    return jsonb_build_object('contract','netproducers3-pdf-claims-v1','operation','stage','added',v_new);

  elsif p_operation='complete' then
    v_company:=(p_payload->>'company_id')::uuid;
    v_url:=p_payload->>'source_url';
    v_token:=(p_payload->>'lease_token')::uuid;
    v_status:=p_payload->>'status';
    if v_company is null or v_url is null or v_token is null
       or v_status not in ('inspected','complete','blocked','retry')
       or char_length(coalesce(p_payload->>'error_code',''))>80 then
      raise exception 'Bad F2 completion' using errcode='22023';
    end if;
    update private.network_producer_pdf_claims_queue q set
      status=v_status,lease_token=null,lease_until=null,
      last_error=case when v_status in ('inspected','complete') then null else p_payload->>'error_code' end,
      candidates=least(40,greatest(0,coalesce((p_payload->>'candidates')::int,q.candidates))),
      published=case when v_status='complete'
        then least(40,greatest(0,coalesce((p_payload->>'published')::int,0))) else q.published end,
      next_attempt_at=case when v_status='retry'
        then now()+least(q.attempts*interval '1 hour',interval '24 hours') else q.next_attempt_at end,
      updated_at=now()
    where q.company_id=v_company and q.source_url=v_url and q.status='leased'
      and q.lease_token=v_token and q.lease_until>now()
      -- A review lease can never be closed as published.
      and not (q.lease_mode='review' and v_status='complete');
    get diagnostics v_count=row_count;
    if v_count<>1 then raise exception 'Stale F2 lease' using errcode='42501'; end if;
    return jsonb_build_object('contract','netproducers3-pdf-claims-v1','operation','complete','updated',v_count);

  elsif p_operation='stats' then
    return jsonb_build_object('contract','netproducers3-pdf-claims-v1','operation','stats',
      'by_status',coalesce((select jsonb_object_agg(status,n) from (
        select status,count(*)::int n from private.network_producer_pdf_claims_queue group by status) s),'{}'::jsonb),
      'published',coalesce((select sum(published)::int from private.network_producer_pdf_claims_queue),0));
  else
    raise exception 'Unknown F2 operation' using errcode='22023';
  end if;
end;
$fn$;

create or replace function public.netproducers3_pdf_claims(p_operation text,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path=''
as $fn$ select private.netproducers3_pdf_claims_impl(p_operation,p_payload); $fn$;

revoke all on function private.netproducers3_pdf_claims_impl(text,jsonb) from public,anon,authenticated;
revoke all on function public.netproducers3_pdf_claims(text,jsonb) from public,anon,authenticated;
grant execute on function private.netproducers3_pdf_claims_impl(text,jsonb) to service_role;
grant execute on function public.netproducers3_pdf_claims(text,jsonb) to service_role;

comment on function public.netproducers3_pdf_claims(text,jsonb)
is 'NET-PRODUCERS-FILTERS2 step 3: service-only queue for short facts from first-party public PDF catalogues; review mode never publishes; published facts are pending producer confirmation and removable.';
