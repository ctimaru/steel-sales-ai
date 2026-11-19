-- NET-EU-TUBIFICI1.D5.D: existing PRO Intelligence screen reads source-backed
-- technical facts (not manufactured exact grade×shape×size SKUs).
-- Geographic plan 'eu' includes non-EU European markets, as already does CH/GB;
-- keep US/IT isolated and do not change Italy's technical fact publisher.
create or replace function private.netpro1b_europe_country(p_country text)
returns boolean
language sql immutable set search_path=''
as $sql$
  select upper(coalesce(p_country,'')) = any(array[
    'AT','BE','BG','CY','HR','DK','EE','FI','FR','DE','GR','IE','IT','LV',
    'LT','LU','MT','NL','PL','PT','CZ','RO','SK','SI','ES','SE','HU',
    'CH','GB','RS','TR','UA'
  ]);
$sql$;

create or replace function private.net_eu_tubifici1_d5d_technical_claims_impl(
 p_organization_id uuid, p_country text, p_company_ids uuid[]
)
returns jsonb
language plpgsql stable security definer set search_path=''
as $plpgsql$
declare
  v_country text := upper(btrim(coalesce(p_country,'')));
  v_base jsonb;
  v_extra jsonb;
  v_merged jsonb;
  v_room integer;
begin
  -- A real user session and *country/module/organization* entitlement are
  -- enforced by the existing C2 function, even when the new function is
  -- invoked directly. No service-role or public bypass.
  if v_country in ('IT','US') or not private.netpro1b_europe_country(v_country)
     or p_company_ids is null or cardinality(p_company_ids) not between 1 and 24
     or array_position(p_company_ids,null::uuid) is not null
  then
    raise exception 'Invalid bounded Europe producers technical request'
      using errcode='22023';
  end if;
  v_base := private.net_eu_tubifici1_c2_factory_claims_impl(
    p_organization_id, v_country, p_company_ids
  );
  if v_base->>'contract'<>'netproducers1-technical-claims-v1'
     or jsonb_typeof(v_base->'items')<>'array' then
    raise exception 'Unexpected C2 source evidence contract' using errcode='22023';
  end if;

  v_room := greatest(0,160-jsonb_array_length(v_base->'items'));
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'company_id',t.company_id,'product_scope',t.product_scope,
    'claim_kind',t.claim_kind,'claim_value',t.claim_value,
    'source_url',t.source_url,'source_title',t.source_title,
    'observed_at',t.observed_at,'evidence_status',t.evidence_status,
    'rights_status',t.rights_status
  ) order by t.company_id,t.claim_kind,t.claim_value,t.id),'[]'::jsonb)
  into v_extra
  from (
    select tc.*
    from private.network_producer_technical_claims tc
    join public.network_companies c on c.id=tc.company_id
    where c.id=any(p_company_ids) and c.country_code=v_country
      and c.publication_status='published' and c.archived_at is null
      and tc.evidence_status='first_party_observed'
      and tc.rights_status='link_only'
      and tc.source_url ~ '^https://[^[:space:]<>]+$'
      and char_length(tc.source_url)<=1200
      -- No other company's document or ungrounded third-party link.
      and lower(regexp_replace(split_part(tc.source_url,'/',3),'^www[.]',''))
          = lower(regexp_replace(coalesce(c.website_domain,''),'^www[.]',''))
      and exists (
        select 1 from public.network_company_role_assignments ra
        join public.network_company_roles ro on ro.id=ra.role_id
        where ra.company_id=c.id and ro.status='active'
          and ro.canonical_key='producer'
      )
      and exists (
        select 1 from public.network_company_products cp
        join public.network_product_families pf on pf.id=cp.product_family_id
        where cp.company_id=c.id and cp.relationship_type='produces'
          and pf.status='active' and pf.canonical_key='tubes_pipes'
      )
      and exists (
        select 1
        from private.net_eu_tubifici1_d5_operator_sources s
        join public.network_data_assertions a
          on a.entity_type='company' and a.entity_id=c.id
          and a.review_state='accepted'
          and a.field_path='eu_tube_factory_reconciled_operator'
          and a.source_reference=s.factory_source_url
        where s.company_id=c.id and s.published_at is not null
          and s.rights_state='not_restricted'
      )
    order by tc.company_id,tc.claim_kind,tc.claim_value,tc.id
    limit v_room
  ) t;

  v_merged := (v_base->'items') || v_extra;
  return jsonb_build_object(
    'contract','netproducers1-technical-claims-v1',
    'items',v_merged,'total',jsonb_array_length(v_merged)
  );
end;
$plpgsql$;

revoke all on function private.net_eu_tubifici1_d5d_technical_claims_impl(uuid,text,uuid[])
 from public,anon,authenticated,service_role;
grant execute on function private.net_eu_tubifici1_d5d_technical_claims_impl(uuid,text,uuid[])
 to authenticated;

create or replace function public.net_eu_tubifici1_d5d_technical_claims(
 p_organization_id uuid, p_country text, p_company_ids uuid[]
)
returns jsonb
language sql stable security invoker set search_path=''
as $sql$
 select private.net_eu_tubifici1_d5d_technical_claims_impl(
   p_organization_id,p_country,p_company_ids
 );
$sql$;
revoke all on function public.net_eu_tubifici1_d5d_technical_claims(uuid,text,uuid[])
 from public,anon,authenticated,service_role;
grant execute on function public.net_eu_tubifici1_d5d_technical_claims(uuid,text,uuid[])
 to authenticated;

comment on function public.net_eu_tubifici1_d5d_technical_claims(uuid,text,uuid[])
 is 'Authenticated country+organization-scoped producer PRO facts: C2 firstparty manufacturing plus D5 firstparty observed, never SKU or manufacturer confirmation.';
