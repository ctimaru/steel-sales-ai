-- NET-PRODUCERS-FILTERS2 · passo 1 (founder approval, 23 Nov 2026).
-- 1) A value the producer REMOVED from its panel (structured fact producer_review='removed')
--    or whose source was withdrawn (visibility='withdrawn') no longer counts anywhere:
--    filters, counts, facets and the rows of the producers list.
-- 2) Table rows already read from official PDFs (network_producer_pdf_size_rows, not removed)
--    feed the filters: the table's standard (never «CATALOGUE_UNSPECIFIED») and the section.
-- 3) Section codes and their Italian names are one value: CHS = Tondo, SHS = Quadro,
--    RHS = Rettangolare (a synonym, not a new category).
-- Signatures, grants and contracts are unchanged (create or replace). Read-only.

create or replace function private.netproducers2_norm_value(p_kind text,p_value text)
returns text language sql immutable set search_path=''
as $fn$
  with v as (
    select nullif(lower(regexp_replace(btrim(coalesce(p_value,'')),'\s+',' ','g')),'') as t
  )
  select case p_kind
    when 'technical_standard' then private.netproducers2_norm_standard(p_value)
    when 'steel_grade' then nullif(upper(regexp_replace(coalesce(p_value,''),'\s+','','g')),'')
    else (select case
      when t in ('chs','tondo','tondi','tubo tondo','tubi tondi','round','circolare','circolari') then 'tondo'
      when t in ('shs','quadro','quadri','quadrato','quadrati','tubo quadro','tubi quadri','square') then 'quadro'
      when t in ('rhs','rettangolare','rettangolari','tubo rettangolare','tubi rettangolari','rectangular') then 'rettangolare'
      else t end from v)
  end;
$fn$;

revoke all on function private.netproducers2_norm_value(text,text) from public,anon;

create or replace function private.netproducers2_evidence_impl(p_country text)
returns table(company_id uuid,claim_kind text,norm text,label text,level text)
language sql stable security definer set search_path=''
as $fn$
  with base as (
    select c.id,c.website_url,c.website_domain
    from public.network_companies c
    where c.publication_status='published' and c.archived_at is null
      and c.country_code=p_country and p_country='IT'
      and exists (
        select 1 from public.network_company_role_assignments a
        join public.network_company_roles r on r.id=a.role_id
        where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
      )
  ), documented as (
    select e.company_id,e.claim_kind,
      private.netproducers2_norm_value(e.claim_kind,e.claim_value) as norm,
      e.claim_value as label,'documented'::text as level
    from private.network_producer_technical_claims e
    join base b on b.id=e.company_id
    where e.evidence_status='first_party_observed' and e.rights_status='link_only'
      -- Producer moderation wins: removed or source-withdrawn values never count.
      and not exists (
        select 1 from private.network_producer_structured_facts s
        where s.source_claim_id=e.id
          and (s.producer_review='removed' or s.visibility='withdrawn')
      )
  ), pdf_rows as (
    -- One documented value per (company, standard) and per (company, section) seen in PDF tables.
    select distinct r.company_id,'technical_standard'::text as claim_kind,
      private.netproducers2_norm_value('technical_standard',r.standard) as norm,
      r.standard as label,'documented'::text as level
    from private.network_producer_pdf_size_rows r
    join base b on b.id=r.company_id
    where r.owner_review<>'removed' and r.standard<>'CATALOGUE_UNSPECIFIED'
    union
    select distinct r.company_id,'section_shape'::text,
      private.netproducers2_norm_value('section_shape',
        case r.shape when 'CHS' then 'Tondo' when 'SHS' then 'Quadro' when 'RHS' then 'Rettangolare' end),
      case r.shape when 'CHS' then 'Tondo' when 'SHS' then 'Quadro' when 'RHS' then 'Rettangolare' end,
      'documented'::text
    from private.network_producer_pdf_size_rows r
    join base b on b.id=r.company_id
    where r.owner_review<>'removed'
  ), mentioned as (
    select a.company_id,a.claim_kind,
      private.netproducers2_norm_value(a.claim_kind,a.claim_value) as norm,
      a.claim_value as label,'mention'::text as level
    from private.network_producer_auto1_candidates a
    join base b on b.id=a.company_id
    join private.network_producer_auto1_sources q on q.company_id=a.company_id
    left join private.network_producer_auto1_product_pages pg
      on pg.company_id=a.company_id and pg.source_url=a.source_url
    where a.evidence_status='confirmed'
      and a.evidence_level='source_mention_only'
      and q.source_url=b.website_url and q.canonical_domain=b.website_domain
      and q.last_checked_at>=now()-interval '35 days'
      and (
        (a.verifier_version='netproducers-auto1b-v1'
         and a.source_url=q.source_url and a.source_sha256=q.last_sha256)
        or
        (a.verifier_version='netproducers-auto1a3-v1'
         and pg.id is not null and a.source_url=pg.source_url
         and a.source_sha256=pg.last_sha256
         and pg.status in ('candidate_review','processed','unchanged')
         and pg.last_checked_at>=now()-interval '35 days'
         and pg.root_sha256=q.last_sha256 and pg.root_source_url=q.source_url
         and pg.canonical_domain=q.canonical_domain)
      )
  )
  select company_id,claim_kind,norm,label,level from documented where norm is not null
  union all
  select company_id,claim_kind,norm,label,level from pdf_rows where norm is not null
  union all
  select company_id,claim_kind,norm,label,level from mentioned where norm is not null;
$fn$;

revoke all on function private.netproducers2_evidence_impl(text) from public,anon,authenticated;

-- Rows of the producers list: same body as before plus the producer-moderation rule.
create or replace function private.netproducers1_technical_claims_impl(
  p_organization_id uuid, p_company_ids uuid[]
)
returns jsonb language plpgsql stable security definer set search_path=''
as $body$
declare v_items jsonb;
begin
 if not private.netpro1b_allowed_for(p_organization_id,'producers','IT') then
   raise exception 'Network PRO producer/country entitlement required'
     using errcode='42501';
 end if;
 if p_company_ids is null or cardinality(p_company_ids) not between 1 and 24 then
   raise exception 'Bounded company IDs required' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',v.id,'company_id',v.company_id,'product_scope',v.product_scope,
   'claim_kind',v.claim_kind,'claim_value',v.claim_value,
   'source_url',v.source_url,'source_title',v.source_title,
   'evidence_status',v.evidence_status,'rights_status',v.rights_status,
   'observed_at',v.observed_at
 ) order by v.company_id,v.claim_kind,v.claim_value),'[]'::jsonb)
 into v_items
 from (
   select e.*
   from private.network_producer_technical_claims e
   join public.network_companies c on c.id=e.company_id
   where e.company_id=any(p_company_ids)
     and e.evidence_status='first_party_observed'
     and c.publication_status='published' and c.archived_at is null
     and c.country_code='IT'
     and exists (
       select 1 from public.network_company_role_assignments a
       join public.network_company_roles r on r.id=a.role_id
       where a.company_id=c.id and r.canonical_key='producer'
         and r.status='active'
     )
     -- NET-PRODUCERS-FILTERS2: a value removed by the producer (or whose source was withdrawn) is hidden.
     and not exists (
       select 1 from private.network_producer_structured_facts s
       where s.source_claim_id=e.id
         and (s.producer_review='removed' or s.visibility='withdrawn')
     )
   order by e.company_id,e.claim_kind,e.claim_value
   limit 160
 ) v;
 return jsonb_build_object('contract','netproducers1-technical-claims-v1',
   'items',v_items,'total',jsonb_array_length(v_items));
end;
$body$;
