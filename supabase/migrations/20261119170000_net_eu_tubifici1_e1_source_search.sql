-- EU1.E1: cross-country producer INTELLIGENCE grounded in individual
-- source observations, not catalog-SKU compatibility or stock claims.
-- The existing Product/PRO Europe entitlement is the only access gate.
create or replace function private.net_eu_tubifici1_e1_search_impl(
 p_organization_id uuid,
 p_standard text default null,
 p_grade text default null,
 p_shape text default null,
 p_country text default null,
 p_max integer default 12
)
returns jsonb
language plpgsql stable security definer set search_path=''
as $fn$
declare
 v_standard text := upper(btrim(coalesce(p_standard,'')));
 v_grade text := upper(btrim(coalesce(p_grade,'')));
 v_shape text := upper(btrim(coalesce(p_shape,'')));
 v_country text := upper(btrim(coalesce(p_country,'')));
 v_max integer := greatest(1,least(coalesce(p_max,12),12));
 v_criteria integer;
 v_items jsonb;
begin
 if (v_standard='' and v_grade='' and v_shape='')
    or (v_standard<>'' and
        v_standard !~ '^(EN( ISO)? [0-9]{4,5}(-[0-9]{1,2})?|ASTM A[0-9]{2,4}|ISO [0-9]{3,5})$')
    or (v_grade<>'' and
        v_grade !~ '^([SPLE][0-9]{3}[A-Z0-9+]{0,8}|AISI [0-9]{3,4}[A-Z]{0,3})$')
    or (v_shape<>'' and v_shape not in ('CHS','SHS','RHS'))
    or (v_country<>'' and (v_country in ('IT','US')
      or not private.netpro1b_europe_country(v_country)))
 then
   raise exception 'Invalid bounded European technical search'
     using errcode='22023';
 end if;
 -- Cross-country queries MUST have an actual EU-wide producer entitlement.
 -- This existing check verifies auth.uid(), membership and paid access.
 -- An Italy-only producer plan cannot pass with DE.
 if not private.netpro1b_allowed_for(p_organization_id,'producers','DE') then
   raise exception 'Network PRO producers Europe entitlement required'
     using errcode='42501';
 end if;
 v_criteria := (v_standard<>'')::integer+(v_grade<>'')::integer+(v_shape<>'')::integer;

 with observed as (
  select tc.id,tc.company_id,tc.claim_kind,tc.claim_value,
         tc.source_url,tc.source_title,tc.observed_at,
         c.country_code,c.legal_name,c.trading_name,c.website_url
  from private.network_producer_technical_claims tc
  join public.network_companies c on c.id=tc.company_id
  where c.publication_status='published' and c.archived_at is null
    and c.country_code not in ('IT','US') and
        private.netpro1b_europe_country(c.country_code)
    and (v_country='' or c.country_code=v_country)
    and tc.evidence_status='first_party_observed'
    and tc.rights_status='link_only'
    and char_length(tc.source_url)<=1200
    and tc.source_url ~ '^https://[^[:space:]<>]+$'
    and lower(regexp_replace(split_part(tc.source_url,'/',3),'^www[.]',''))
      =lower(regexp_replace(coalesce(c.website_domain,''),'^www[.]',''))
    and exists(
       select 1 from public.network_company_role_assignments ra
       join public.network_company_roles ro on ro.id=ra.role_id
       where ra.company_id=c.id and ro.canonical_key='producer'
         and ro.status='active'
    )
    and exists(
       select 1 from public.network_company_products cp
       join public.network_product_families pf on pf.id=cp.product_family_id
       where cp.company_id=c.id and cp.relationship_type='produces'
         and pf.canonical_key='tubes_pipes' and pf.status='active'
    )
    and exists(
       select 1 from private.net_eu_tubifici1_d5_operator_sources s
       join public.network_data_assertions a
         on a.entity_type='company' and a.entity_id=c.id
         and a.field_path='eu_tube_factory_reconciled_operator'
         and a.source_reference=s.factory_source_url
         and a.review_state='accepted'
       where s.company_id=c.id and s.published_at is not null
         and s.rights_state='not_restricted'
    )
    and (
     (tc.claim_kind='technical_standard' and v_standard<>'' and
       (upper(btrim(tc.claim_value))=v_standard or
        upper(btrim(tc.claim_value)) like v_standard||'-%'))
     or (tc.claim_kind='steel_grade' and v_grade<>'' and
       upper(btrim(tc.claim_value))=v_grade)
     or (tc.claim_kind='section_shape' and v_shape<>'' and
       right(upper(btrim(tc.claim_value)),3)=v_shape)
    )
 ), evidence as (
   select o.*,row_number() over(
     partition by o.company_id,o.claim_kind order by o.claim_value,o.id
   ) rn
   from observed o
 ), ranked as (
   select e.company_id,
     max(e.country_code) country_code,
     max(coalesce(nullif(e.trading_name,''),e.legal_name)) company_name,
     max(e.website_url) website_url,
     count(distinct e.claim_kind)::integer matched_criteria,
     coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'kind',e.claim_kind,'value',e.claim_value,
      'source_url',e.source_url,'source_title',e.source_title,
      'observed_at',e.observed_at
     ) order by e.claim_kind,e.claim_value) filter (where e.rn<=2),'[]'::jsonb) evidence
   from evidence e group by e.company_id
 ), best as (
   select * from ranked
   order by matched_criteria desc, company_name,company_id limit v_max
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'company_id',b.company_id,'name',b.company_name,
   'country_code',b.country_code,'website_url',b.website_url,
   'matched_criteria',b.matched_criteria,
   'requested_criteria',v_criteria,
   'evidence',b.evidence,
   'match_status',case when b.matched_criteria=v_criteria then
       'attributes_observed_separately' else 'partial_observations' end,
   'exact_combination_confirmed',false,
   'manufacturer_confirmed',false
 ) order by b.matched_criteria desc,b.company_name,b.company_id),'[]'::jsonb)
 into v_items from best b;
 return jsonb_build_object(
  'contract','net-eu-producer-intelligence-e1-v1',
  'requested_criteria',v_criteria,
  'total',jsonb_array_length(v_items),
  'items',v_items
 );
end;
$fn$;

revoke all on function private.net_eu_tubifici1_e1_search_impl(uuid,text,text,text,text,integer)
 from public,anon,authenticated,service_role;
grant execute on function private.net_eu_tubifici1_e1_search_impl(uuid,text,text,text,text,integer)
 to authenticated;

create or replace function public.net_eu_tubifici1_e1_search(
 p_organization_id uuid,
 p_standard text default null,
 p_grade text default null,
 p_shape text default null,
 p_country text default null,
 p_max integer default 12
)
returns jsonb
language sql stable security invoker set search_path=''
as $sql$
 select private.net_eu_tubifici1_e1_search_impl(
   p_organization_id,p_standard,p_grade,p_shape,p_country,p_max
 );
$sql$;

revoke all on function public.net_eu_tubifici1_e1_search(uuid,text,text,text,text,integer)
 from public,anon,authenticated,service_role;
grant execute on function public.net_eu_tubifici1_e1_search(uuid,text,text,text,text,integer)
 to authenticated;

comment on function public.net_eu_tubifici1_e1_search(uuid,text,text,text,text,integer)
 is 'PRO Europe source-observed producer finder, attribute matches only; not SKU confirmation or stock availability.';
