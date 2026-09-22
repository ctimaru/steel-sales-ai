-- PA2.12 — Company 360 activation + deterministic search links.
-- 1) Identity queue summary counts the full unresolved backlog independently of row limit.
-- 2) Only normalized RFQ/Offer/Order parents may expose company_id to Global Search.
-- Legacy observation fallback remains without customer attribution.

create or replace function public.p1_identity_confirmation_queue(
  p_organization_id uuid,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
with access_check as (
  select public.is_organization_member(p_organization_id,false) as allowed
),
unresolved_contacts_base as (
  select
    c.id,
    c.full_name,
    c.email_normalized,
    c.created_at,
    count(distinct m.id)::int as message_count,
    count(distinct r.id)::int as rfq_count
  from public.contacts c
  left join public.messages m
    on m.organization_id=c.organization_id
   and (
     m.sender_contact_id=c.id
     or (
       m.sender_contact_id is null
       and lower(btrim(coalesce(m.sender_email,'')))=c.email_normalized
     )
   )
  left join public.rfqs r
    on r.organization_id=c.organization_id
   and r.contact_id=c.id
  where c.organization_id=p_organization_id
    and c.company_id is null
    and c.email_normalized is not null
    and c.email_normalized<>''
    and (select allowed from access_check)
  group by c.id,c.full_name,c.email_normalized,c.created_at
  having count(distinct m.id)>0 or count(distinct r.id)>0
),
unresolved_contacts as (
  select *
  from unresolved_contacts_base
  order by created_at desc
  limit greatest(1,least(coalesce(p_limit,100),500))
),
verified_companies as (
  select
    c.id,
    c.name,
    c.company_type,
    c.country,
    c.vat_number_normalized,
    min(v.created_at) as verified_at,
    jsonb_agg(
      distinct jsonb_build_object(
        'identity_type',v.identity_type,
        'identity_value',v.identity_value,
        'verification_basis',v.verification_basis
      )
    ) as identities
  from public.companies c
  join public.commercial_company_identity_verifications v
    on v.organization_id=c.organization_id
   and v.company_id=c.id
  where c.organization_id=p_organization_id
    and (select allowed from access_check)
  group by c.id,c.name,c.company_type,c.country,c.vat_number_normalized
  order by c.name
)
select jsonb_build_object(
  'summary',jsonb_build_object(
    'unresolved_contacts',(select count(*) from unresolved_contacts_base),
    'verified_companies',(select count(*) from verified_companies)
  ),
  'contacts',coalesce((
    select jsonb_agg(jsonb_build_object(
      'contact_id',id,
      'full_name',full_name,
      'email',email_normalized,
      'message_count',message_count,
      'rfq_count',rfq_count
    ))
    from unresolved_contacts
  ),'[]'::jsonb),
  'verified_companies',coalesce((
    select jsonb_agg(jsonb_build_object(
      'company_id',id,
      'name',name,
      'company_type',company_type,
      'country',country,
      'vat_number',vat_number_normalized,
      'verified_at',verified_at,
      'identities',identities
    ))
    from verified_companies
  ),'[]'::jsonb),
  'policy',jsonb_build_object(
    'requires_explicit_user_confirmation',true,
    'requires_verified_company',true,
    'domain_inference',false
  )
);
$$;

revoke execute on function public.p1_identity_confirmation_queue(uuid,integer)
from public,anon;
grant execute on function public.p1_identity_confirmation_queue(uuid,integer)
to authenticated,service_role;

comment on function public.p1_identity_confirmation_queue(uuid,integer) is
  'PA2.12 controlled identity queue: exact unresolved summary count with a separately limited review row set; no domain inference.';

create or replace function public.p1_global_structured_search_bridge(
  p_organization_id uuid,
  p_query text default null,
  p_types text[] default null,
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 50
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with params as (
  select greatest(1, least(coalesce(p_limit, 50), 100)) as limit_value
),
legacy_payload as (
  select public.p1_global_structured_search(
    p_organization_id,
    p_query,
    p_types,
    p_filters,
    100
  ) as payload
),
legacy_rows as (
  select value as row
  from legacy_payload,
       jsonb_array_elements(coalesce(payload -> 'results', '[]'::jsonb))
),
promoted_observation_ids as (
  select distinct p.observation_id
  from public.current_commercial_entity_promotions p
  where p.organization_id = p_organization_id
    and p.entity_type in ('rfq_line','offer_line','order_line')
),
fallback_rows as (
  select row
  from legacy_rows
  where not (
    row ->> 'result_type' in ('rfq','offer','order')
    and coalesce(row #>> '{metadata,observation_id}', '') ~ '^[0-9]+$'
    and (row #>> '{metadata,observation_id}')::bigint in (
      select observation_id from promoted_observation_ids
    )
  )
),
normalized_rows as (
  select jsonb_build_object(
    'result_type', case p.entity_type
      when 'rfq_line' then 'rfq'
      when 'offer_line' then 'offer'
      when 'order_line' then 'order'
    end,
    'result_id', concat(p.entity_type, ':', p.entity_id),
    'title', coalesce(nullif(t.subject,''), nullif(o.source_filename,''), case p.entity_type
      when 'rfq_line' then 'RFQ'
      when 'offer_line' then 'Offerta'
      when 'order_line' then 'Ordine'
    end),
    'subtitle', concat_ws(' · ', nullif(o.grade,''), nullif(o.standard,''),
      case
        when o.product_type='round_tube' then concat('Ø ',o.outer_diameter_mm,' × ',o.thickness_mm,' mm')
        when o.product_type in ('square_tube','rectangular_tube') then concat(o.width_mm,' × ',o.height_mm,' × ',o.thickness_mm,' mm')
        else nullif(o.product_type,'')
      end
    ),
    'snippet', left(coalesce(nullif(o.source_text,''),nullif(o.source_filename,''),''),500),
    'event_at', coalesce(t.last_activity_at,p.promoted_at),
    'role', o.item_role,
    'grade', o.grade,
    'standard', o.standard,
    'product_type', o.product_type,
    'outer_diameter_mm', o.outer_diameter_mm,
    'width_mm', o.width_mm,
    'height_mm', o.height_mm,
    'thickness_mm', o.thickness_mm,
    'length_mm', o.length_mm,
    'quantity', case p.entity_type
      when 'rfq_line' then rl.requested_quantity
      when 'offer_line' then ol.quantity
      when 'order_line' then odl.quantity
    end,
    'quantity_unit', case p.entity_type
      when 'rfq_line' then rl.quantity_unit
      when 'offer_line' then ol.quantity_unit
      when 'order_line' then odl.quantity_unit
    end,
    'price_value', case p.entity_type
      when 'offer_line' then ol.price_value
      when 'order_line' then odl.unit_price
      else null
    end,
    'price_unit', case p.entity_type
      when 'offer_line' then ol.price_unit
      when 'order_line' then odl.price_unit
      else null
    end,
    'currency', coalesce(
      case when p.entity_type='offer_line' then off.currency end,
      o.currency
    ),
    'source_filename', o.source_filename,
    'thread_id', o.thread_id,
    'score', 0.95::double precision,
    'metadata', jsonb_build_object(
      'observation_id', o.id,
      'promotion_id', p.id,
      'normalized_entity_type', p.entity_type,
      'normalized_entity_id', p.entity_id,
      'canonical_product_key', coalesce(
        rl.canonical_product_key,
        ol.canonical_product_key,
        odl.canonical_product_key,
        o.canonical_product_key
      ),
      'confidence', coalesce(p.confidence,o.confidence),
      'source_model', 'normalized_promoted',
      'company_id', case p.entity_type
        when 'rfq_line' then rfq.company_id
        when 'offer_line' then off.company_id
        when 'order_line' then ord.company_id
      end,
      'company_link_source', case
        when case p.entity_type
          when 'rfq_line' then rfq.company_id
          when 'offer_line' then off.company_id
          when 'order_line' then ord.company_id
        end is not null then 'normalized_business_entity'
        else null
      end
    )
  ) as row
  from public.current_commercial_entity_promotions p
  join public.commercial_observations o
    on o.id=p.observation_id and o.organization_id=p.organization_id
  left join public.commercial_threads t
    on t.id=o.thread_id and t.organization_id=o.organization_id
  left join public.rfq_lines rl
    on p.entity_type='rfq_line' and rl.id=p.entity_id and rl.organization_id=p.organization_id
  left join public.rfqs rfq
    on p.entity_type='rfq_line' and rfq.id=rl.rfq_id and rfq.organization_id=p.organization_id
  left join public.offer_lines ol
    on p.entity_type='offer_line' and ol.id=p.entity_id and ol.organization_id=p.organization_id
  left join public.offers off
    on p.entity_type='offer_line' and off.id=ol.offer_id and off.organization_id=p.organization_id
  left join public.order_lines odl
    on p.entity_type='order_line' and odl.id=p.entity_id and odl.organization_id=p.organization_id
  left join public.orders ord
    on p.entity_type='order_line' and ord.id=odl.order_id and ord.organization_id=p.organization_id
  where p.organization_id=p_organization_id
    and p.entity_type in ('rfq_line','offer_line','order_line')
    and (
      cardinality(coalesce(p_types,array[]::text[]))=0
      or (p.entity_type='rfq_line' and 'rfq'=any(p_types))
      or (p.entity_type='offer_line' and 'offer'=any(p_types))
      or (p.entity_type='order_line' and 'order'=any(p_types))
    )
    and (
      nullif(btrim(coalesce(p_query,'')),'') is null
      or not exists (
        select 1
        from regexp_split_to_table(p_query,'[[:space:]]+') token(value)
        where btrim(token.value)<>''
          and position(lower(token.value) in lower(concat_ws(' ',
            coalesce(o.search_text,''),
            coalesce(o.source_text,''),
            coalesce(o.source_filename,''),
            coalesce(t.subject,''),
            coalesce(o.grade,''),
            coalesce(o.standard,''),
            coalesce(o.canonical_product_key,'')
          )))=0
      )
    )
    and (not (p_filters ? 'item_role') or lower(coalesce(o.item_role,''))=lower(p_filters->>'item_role'))
    and (not (p_filters ? 'grade') or upper(coalesce(o.grade,''))=upper(p_filters->>'grade'))
    and (not (p_filters ? 'standard') or replace(upper(coalesce(o.standard,'')),' ','')=replace(upper(p_filters->>'standard'),' ',''))
    and (not (p_filters ? 'outer_diameter_mm') or o.outer_diameter_mm=(p_filters->>'outer_diameter_mm')::numeric)
    and (not (p_filters ? 'width_mm') or o.width_mm=(p_filters->>'width_mm')::numeric)
    and (not (p_filters ? 'height_mm') or o.height_mm=(p_filters->>'height_mm')::numeric)
    and (not (p_filters ? 'thickness_mm') or o.thickness_mm=(p_filters->>'thickness_mm')::numeric)
    and (not (p_filters ? 'length_mm') or o.length_mm=(p_filters->>'length_mm')::numeric)
    and (not (p_filters ? 'price_min') or case p.entity_type when 'offer_line' then ol.price_value when 'order_line' then odl.unit_price else o.price_value end >= (p_filters->>'price_min')::numeric)
    and (not (p_filters ? 'price_max') or case p.entity_type when 'offer_line' then ol.price_value when 'order_line' then odl.unit_price else o.price_value end <= (p_filters->>'price_max')::numeric)
    and (not (p_filters ? 'currency') or upper(coalesce(off.currency,o.currency,''))=upper(p_filters->>'currency'))
    and (not (p_filters ? 'source') or coalesce(o.source_filename,'') ilike '%'||(p_filters->>'source')||'%')
),
all_rows as (
  select row from fallback_rows
  union all
  select row from normalized_rows
),
counts as (
  select row->>'result_type' as result_type,count(*)::int as count
  from all_rows
  group by 1
),
limited as (
  select row
  from all_rows
  order by (row->>'score')::double precision desc,
           nullif(row->>'event_at','')::timestamptz desc nulls last,
           row->>'result_id'
  limit (select limit_value from params)
)
select jsonb_build_object(
  'counts',coalesce((select jsonb_object_agg(result_type,count) from counts),'{}'::jsonb),
  'results',coalesce((select jsonb_agg(row) from limited),'[]'::jsonb),
  'total',(select count(*) from all_rows),
  'read_model','normalized_with_observation_fallback'
);
$$;

revoke all on function public.p1_global_structured_search_bridge(uuid,text,text[],jsonb,integer)
  from public,anon,authenticated;
grant execute on function public.p1_global_structured_search_bridge(uuid,text,text[],jsonb,integer)
  to service_role;

comment on function public.p1_global_structured_search_bridge(uuid,text,text[],jsonb,integer) is
  'PA2.12 controlled read bridge: normalized promoted business events expose deterministic Company 360 links from their normalized parent entities; unpromoted observation fallback remains unlinked.';
