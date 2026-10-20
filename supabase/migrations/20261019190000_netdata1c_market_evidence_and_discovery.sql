-- NET-UX DATA1C — bounded, evidence-based market classifications for discovered companies.
-- "candidate" means an official company page indicates an activity, not a verified buyer,
-- legal entity, production capability, tube user or platform-verified company.
create table if not exists private.network_market_source_evidence(
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.network_core_target_leads(id) on delete cascade,
 market_id uuid not null references public.network_markets(id),
 source_url text not null check (source_url ~ '^https://[^[:space:]<>@]+$' and length(source_url)<=1800),
 summary text not null check (length(summary) between 24 and 300),
 review_status text not null default 'candidate'
  check (review_status in ('candidate','accepted','rejected')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(lead_id,market_id,source_url)
);
alter table private.network_market_source_evidence enable row level security;
revoke all on private.network_market_source_evidence from public,anon,authenticated;
create index if not exists network_market_source_evidence_market_status_idx
 on private.network_market_source_evidence(market_id,review_status,lead_id);
comment on table private.network_market_source_evidence is
'Source-based market assignments; a candidate market NEVER means verified company, approved supplier or RFQ intent.';

-- Candidate staging is service-only. Tenant-facing reads go through separately gated RPC.
create or replace function public.netdata1c_stage_market(
 p_lead_id uuid,p_market text,p_source_url text,p_summary text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_domain text;v_host text;
begin
 if current_setting('role',true) is distinct from 'service_role' then
   raise exception 'Service-only market candidate stage' using errcode='42501';
 end if;
 select lower(t.canonical_domain) into v_domain
 from public.network_core_target_leads t
 where t.id=p_lead_id and t.status in ('needs_review','ready_for_crawler','enqueued_for_crawler');
 if v_domain is null then raise exception 'Ineligible lead' using errcode='22023'; end if;
 if p_source_url is null or p_source_url !~ '^https://[a-zA-Z0-9.-]+(/[^[:space:]<>@]*)?$'
   or length(p_source_url)>1800 or strpos(p_source_url,'@')>0 then
    raise exception 'Unsafe source URL' using errcode='22023';
 end if;
 v_host:=lower(regexp_replace(split_part(p_source_url,'/',3),'^www[.]',''));
 if v_host <> v_domain then
    raise exception 'Source must belong to the exact staged company domain' using errcode='22023';
 end if;
 if length(btrim(coalesce(p_summary,''))) not between 24 and 300
   or p_summary ~ '[[:cntrl:]<>@]' then
   raise exception 'Invalid source summary' using errcode='22023';
 end if;
 if not exists(select 1 from public.network_markets m
   where m.canonical_key=p_market and m.status='active' and m.searchable) then
   raise exception 'Unsupported market key' using errcode='22023';
 end if;
 insert into private.network_market_source_evidence(lead_id,market_id,source_url,summary)
 select p_lead_id,m.id,p_source_url,btrim(p_summary) from public.network_markets m
 where m.canonical_key=p_market and m.status='active' and m.searchable
 on conflict(lead_id,market_id,source_url) do update set
 summary=excluded.summary
 where private.network_market_source_evidence.review_status='candidate'
 returning id into v_id;
 if v_id is null then
   select e.id into v_id from private.network_market_source_evidence e
   join public.network_markets m on m.id=e.market_id
   where e.lead_id=p_lead_id and m.canonical_key=p_market and e.source_url=p_source_url;
 end if;
 return v_id;
end $$;
revoke all on function public.netdata1c_stage_market(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.netdata1c_stage_market(uuid,text,text,text) to service_role;

-- Existing platform permissions, never any workspace-only privilege, gate decisions.
create or replace function public.netdata1c_review_market(p_id uuid,p_accept boolean)
returns text language plpgsql security definer set search_path=''
as $$
declare v_status text;
begin
 perform private.require_platform_permission('discovery.enrich');
 update private.network_market_source_evidence e
 set review_status=case when p_accept then 'accepted' else 'rejected' end,
 reviewed_by=(select auth.uid()),reviewed_at=now()
 where e.id=p_id and e.review_status='candidate'
 returning e.review_status into v_status;
 if v_status is null then raise exception 'Candidate not found or already decided' using errcode='22023'; end if;
 return v_status;
end $$;
revoke all on function public.netdata1c_review_market(uuid,boolean) from public,anon;
grant execute on function public.netdata1c_review_market(uuid,boolean) to authenticated;

-- Tenant-gated review queue, limited data disclosure to existing platform permissions.
create or replace function public.netdata1c_market_review_queue(p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_items jsonb;
begin
 perform private.require_platform_permission('discovery.read');
 if p_limit is null or p_limit<1 or p_limit>50 then raise exception 'Invalid limit' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',e.id,'company_name',t.company_name,'domain',t.canonical_domain,
   'market_key',m.canonical_key,'market_name',m.display_name,
   'source_url',e.source_url,'summary',e.summary,'review_status',e.review_status)
   order by t.company_name,m.display_name),'[]'::jsonb)
 into v_items
 from (select * from private.network_market_source_evidence
       where review_status='candidate' order by created_at,id limit p_limit) e
 join public.network_core_target_leads t on t.id=e.lead_id
 join public.network_markets m on m.id=e.market_id;
 return jsonb_build_object('contract','netdata1c-review-v1','items',v_items);
end $$;
revoke all on function public.netdata1c_market_review_queue(integer) from public,anon;
grant execute on function public.netdata1c_market_review_queue(integer) to authenticated;

-- FREE and PRO read the same guarded discovered records, not arbitrary lead table rows.
-- Both candidate and accepted market facts have source provenance; the UI MUST label
-- candidate as "settore indicativo / da confermare", and never a verified buyer.
create or replace function public.netdata1c_market_discovery_page(
 p_organization_id uuid,p_access text,p_market text,
 p_query text default null,p_role text default null,p_region text default null,
 p_limit integer default 6,p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_items jsonb;v_total integer;v_market_name text;
begin
 if p_access='free' then
    perform private.netux11_require_active_company(p_organization_id);
 elsif p_access='pro' then
    perform private.pa1_3_require_network_access(p_organization_id);
 else raise exception 'Invalid access mode' using errcode='22023';end if;
 if p_limit is null or p_limit<1 or p_limit>18 or
   p_offset is null or p_offset<0 or p_offset>10000 or
   length(coalesce(p_query,''))>120 or length(coalesce(p_region,''))>90 or
   (nullif(p_role,'') is not null and p_role not in
     ('producer','trader_distributor','processor_service_provider','end_user')) then
   raise exception 'Invalid page input' using errcode='22023';
 end if;
 select display_name into v_market_name from public.network_markets
 where canonical_key=p_market and status='active' and searchable=true;
 if v_market_name is null then raise exception 'Unknown market' using errcode='22023';end if;
 with eligible as (
  select distinct on (d.id)
   d.id,d.company_name,d.website_url,d.source_url,d.origin,d.finished_only,d.role_key,
   g.city,g.region,e.source_url as market_source_url,e.review_status as market_status,
   e.created_at
  from private.netfast_discovered_records d
  join private.network_market_source_evidence e on e.lead_id=d.id and e.review_status in ('candidate','accepted')
  join public.network_markets m on m.id=e.market_id and m.canonical_key=p_market and m.status='active'
  left join public.network_neteima2_provisional_geo g on g.target_id=d.id
  where d.origin='official_company_research'
    and (nullif(btrim(coalesce(p_query,'')),'') is null
      or strpos(lower(d.company_name),lower(btrim(p_query)))>0
      or strpos(lower(d.domain),lower(btrim(p_query)))>0)
    and (nullif(p_role,'') is null or d.role_key=p_role)
    and (nullif(btrim(coalesce(p_region,'')),'') is null or lower(g.region)=lower(btrim(p_region)))
  order by d.id,case when e.review_status='accepted' then 0 else 1 end,e.created_at desc
 ), chosen as (
  select * from eligible order by lower(company_name),id
  limit p_limit offset p_offset
 )
 select (select count(*)::int from eligible),
 coalesce((select jsonb_agg(jsonb_build_object(
   'id',d.id,'legal_name',d.company_name,'trading_name',null,
   'country_code','IT','website_url',d.website_url,
   'claimed_status','unclaimed','verification_status','unverified',
   'discovery_status','unconfirmed','source_url',d.source_url,
   'origin',d.origin,'finished_only',d.finished_only,
   'roles',jsonb_build_array(jsonb_build_object('key',d.role_key,
      'name',coalesce((select r.display_name from public.network_company_roles r
        where r.canonical_key=d.role_key and r.status='active' limit 1),'Categoria indicativa'),
      'is_primary',true)),
   'products','[]'::jsonb,
   'location',case when d.region is null then null
     else jsonb_build_object('region',d.region,'city',d.city) end,
   'geography_status',case when d.region is null then 'unknown' else 'sourced_unverified' end,
   'market_name',v_market_name,'market_source_url',d.market_source_url,
   'market_evidence_status',d.market_status)
  order by lower(d.company_name),d.id) from chosen d),'[]'::jsonb)
 into v_total,v_items;
 return jsonb_build_object('contract','netdata1c-market-discovery-v1',
   'total',v_total,'items',v_items,'market_key',p_market,
   'candidate_not_verified',true,'limit',p_limit,'offset',p_offset);
end $$;
revoke all on function public.netdata1c_market_discovery_page(uuid,text,text,text,text,text,integer,integer) from public,anon;
grant execute on function public.netdata1c_market_discovery_page(uuid,text,text,text,text,text,integer,integer) to authenticated;


-- Editorial source pilot, all seven remain *candidate*, not reviewed/verified.
-- Short original summaries, not copied website paragraphs.
with pilot(domain,market_key,source_url,summary) as (values
 ('fincantieri.com','marine',
  'https://www.fincantieri.com/it/gruppo/chi-siamo',
  'Il sito del Gruppo descrive progettazione e realizzazione di navi e attività cantieristiche.'),
 ('ansaldoenergia.com','energy',
  'https://www.ansaldoenergia.com/',
  'Il sito ufficiale descrive impianti e componenti per generazione di energia elettrica.'),
 ('cimolai.com','construction_infrastructure',
  'https://www.cimolai.com/it/aree-di-business/ponti-e-viadotti/',
  'La pagina aziendale descrive ponti e viadotti in carpenteria metallica.'),
 ('webuildgroup.com','construction_infrastructure',
  'https://www.webuildgroup.com/',
  'Il sito corporate illustra attività di costruzione e grandi infrastrutture.'),
 ('sacmi.com','mechanical_engineering_market',
  'https://sacmi.com/it-IT/packaging/about-us',
  'La pagina aziendale descrive macchine e impianti industriali per più settori.'),
 ('global.aermec.com','hvac',
  'https://global.aermec.com/it/',
  'La pagina ufficiale descrive sistemi e soluzioni per climatizzazione.'),
 ('corporate.carel.com','hvac',
  'https://corporate.carel.com/',
  'Il sito corporate descrive soluzioni di controllo per condizionamento e refrigerazione.')
)
insert into private.network_market_source_evidence(lead_id,market_id,source_url,summary,review_status)
select t.id,m.id,p.source_url,p.summary,'candidate'
from pilot p
join public.network_core_target_leads t on t.canonical_domain=p.domain
  and t.status in ('needs_review','ready_for_crawler','enqueued_for_crawler')
join public.network_markets m on m.canonical_key=p.market_key and m.status='active'
where lower(regexp_replace(split_part(p.source_url,'/',3),'^www[.]',''))=p.domain
on conflict(lead_id,market_id,source_url) do nothing;
