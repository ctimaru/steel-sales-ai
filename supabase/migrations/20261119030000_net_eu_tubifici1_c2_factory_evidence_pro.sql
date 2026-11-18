-- NET-EU-TUBIFICI1.C2.B -- Source-bound tube manufacturing process
-- for *authorized* Producer PRO Europe accounts. No private cross-tenant
-- leakage, no exact grade/size or manufacturer attestation inferred.
create or replace function private.net_eu_tubifici1_c2_factory_claims_impl(
 p_organization_id uuid,p_country text,p_company_ids uuid[]
)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
 v_country text := upper(btrim(coalesce(p_country,'')));
 v_items jsonb;
begin
 if v_country='IT' or v_country='US'
   or not private.netpro1b_europe_country(v_country)
   or p_company_ids is null or cardinality(p_company_ids) not between 1 and 24
   or array_position(p_company_ids,null::uuid) is not null
 then
   raise exception 'Invalid bounded EU factory process request' using errcode='22023';
 end if;
 -- Same tenant/module/territory entitlement as the canonical PRO directory.
 -- An Italy-only producer plan cannot read DE, PL or other EU countries.
 if not private.netpro1b_allowed_for(p_organization_id,'producers',v_country)
 then
   raise exception 'Network PRO producers/Europe entitlement required'
    using errcode='42501';
 end if;

 select coalesce(jsonb_agg(jsonb_build_object(
   'id',e.id,'company_id',e.entity_id,'product_scope','tubes_pipes',
   'claim_kind','manufacturing_process','claim_value',e.process_label,
   'source_url',e.source_url,
   'source_title','Processo produttivo osservato sulla fonte ufficiale',
   'observed_at',e.captured_at,
   'evidence_status','first_party_observed','rights_status','link_only'
 ) order by e.entity_id,e.process_label),'[]'::jsonb)
 into v_items
 from (
   select distinct a.id,a.entity_id,a.captured_at,
     a.source_reference source_url,
     case m.process_code
       when 'seamless_hot_rolled' then 'Tubi senza saldatura · laminazione a caldo'
       when 'seamless_hot_rolled_cold_drawn' then 'Tubi senza saldatura · laminazione e trafilatura'
       when 'welded_longitudinal_uoe' then 'Tubi saldati longitudinalmente · UOE'
       when 'welded_stainless_hollow_sections' then 'Tubi e profili inox saldati'
       when 'cold_formed_tubes_profiles' then 'Tubi e profili formati a freddo'
       when 'welded_steel_tubes' then 'Tubi in acciaio saldati'
       else null
     end as process_label
   from public.network_companies c
   join private.net_eu_tubifici1_publication_ledger l
     on l.company_id=c.id
   join private.net_eu_tubifici1_manufacturing_proofs m
     on m.candidate_id=l.candidate_id
       and m.published_company_id=c.id
       and m.published_at is not null
       and m.proof_status='qualified_firstparty'
       and m.source_kind='first_party_html'
       and m.factory_country_code=c.country_code
       and l.source_url=m.source_url
   join public.network_data_assertions a
     on a.entity_type='company' and a.entity_id=c.id
       and a.field_path='eu_tube_factory_firstparty_observation'
       and a.source_type='public_web'
       and a.ownership_type='platform_curated'
       and a.review_state='accepted'
       and a.source_reference=m.source_url
       and a.asserted_value->>'source_level'='first_party_observed'
       and a.asserted_value->>'manufacturer_confirmed'='false'
       and a.asserted_value->>'specific_dimensions_verified'='false'
       and a.asserted_value->>'process'=m.process_code
   where c.id=any(p_company_ids) and c.country_code=v_country
     and c.publication_status='published' and c.archived_at is null
     and c.verification_status='unverified'
     and c.claimed_status='unclaimed'
     and char_length(m.source_url)<=1200
     and m.source_url ~* '^https://'
     and lower(regexp_replace(split_part(split_part(m.source_url,'/',3),':',1),'^www[.]',''))
       =lower(c.website_domain)
     and exists(
       select 1 from public.network_company_role_assignments ra
       join public.network_company_roles ro on ro.id=ra.role_id
       where ra.company_id=c.id and ro.canonical_key='producer' and ro.status='active'
     )
     and exists(
       select 1 from public.network_company_products cp
       join public.network_product_families pf on pf.id=cp.product_family_id
       where cp.company_id=c.id and cp.relationship_type='produces'
         and pf.canonical_key='tubes_pipes' and pf.status='active'
     )
   limit 24
 ) e
 where e.process_label is not null;
 return jsonb_build_object('contract','netproducers1-technical-claims-v1',
    'items',v_items,'total',jsonb_array_length(v_items));
end;
$$;

-- Private implementation is RLS/entitlement gated even if called directly.
revoke all on function private.net_eu_tubifici1_c2_factory_claims_impl(uuid,text,uuid[])
 from public,anon,authenticated,service_role;
grant execute on function private.net_eu_tubifici1_c2_factory_claims_impl(uuid,text,uuid[])
 to authenticated;

create or replace function public.net_eu_tubifici1_c2_factory_claims(
 p_organization_id uuid,p_country text,p_company_ids uuid[]
)
returns jsonb
language sql stable security invoker set search_path=''
as $$
 select private.net_eu_tubifici1_c2_factory_claims_impl(
   p_organization_id,p_country,p_company_ids
 );
$$;
revoke all on function public.net_eu_tubifici1_c2_factory_claims(uuid,text,uuid[])
 from public,anon,authenticated,service_role;
grant execute on function public.net_eu_tubifici1_c2_factory_claims(uuid,text,uuid[])
 to authenticated;
comment on function private.net_eu_tubifici1_c2_factory_claims_impl(uuid,text,uuid[])
 is 'Tenant+EU module checked first-party factory process observations only, never verified size or confirmed product. Deny anonymous and IT-only EU access.';
