-- PA2.19 — normalized Commercial Explorer union.
-- RFQ / Offer / Order normalized entities are the operational read path.
-- Legacy observations are joined only as provenance/fallback for source attributes.

create or replace function public.p1_normalized_commercial_explorer(
  p_organization_id uuid,
  p_query text default null,
  p_role text default null,
  p_grade text default null,
  p_standard text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
begin
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  if p_role is not null and p_role not in ('requested','offered','ordered') then
    raise exception 'unsupported operational role';
  end if;

  return (
    with normalized as (
      select
        'requested'::text role,
        rl.id entity_line_id,
        r.id entity_id,
        r.requested_at occurred_at,
        r.company_id,
        c.name company_name,
        coalesce(conv.external_thread_id::text,obs.thread_id::text,'') conversation_id,
        rl.raw_spec_text product_text,
        rl.canonical_product_key,
        coalesce(rl.requested_grade,obs.grade) grade,
        coalesce(rl.requested_standard,obs.standard) standard,
        null::numeric price_value,
        null::text price_unit,
        null::text currency,
        'unknown'::text availability_status,
        coalesce(obs.confidence,1::numeric) confidence,
        rl.source_observation_id,
        obs.source_filename,
        obs.source_text
      from public.rfq_lines rl
      join public.rfqs r
        on r.organization_id=rl.organization_id and r.id=rl.rfq_id
      left join public.companies c
        on c.organization_id=r.organization_id and c.id=r.company_id
      left join public.conversations conv
        on conv.organization_id=r.organization_id and conv.id=r.conversation_id
      left join public.commercial_observations obs
        on obs.organization_id=rl.organization_id and obs.id=rl.source_observation_id
      where rl.organization_id=p_organization_id

      union all

      select
        'offered'::text role,
        ol.id entity_line_id,
        o.id entity_id,
        o.offered_at occurred_at,
        o.company_id,
        c.name company_name,
        coalesce(conv.external_thread_id::text,obs.thread_id::text,'') conversation_id,
        coalesce(ol.raw_spec_text,ol.source_text) product_text,
        ol.canonical_product_key,
        obs.grade,
        obs.standard,
        ol.price_value,
        ol.price_unit,
        o.currency,
        coalesce(ol.availability_status,'unknown') availability_status,
        coalesce(ol.confidence,obs.confidence,1::numeric) confidence,
        ol.source_observation_id,
        obs.source_filename,
        obs.source_text
      from public.offer_lines ol
      join public.offers o
        on o.organization_id=ol.organization_id and o.id=ol.offer_id
      left join public.companies c
        on c.organization_id=o.organization_id and c.id=o.company_id
      left join public.conversations conv
        on conv.organization_id=o.organization_id and conv.id=o.conversation_id
      left join public.commercial_observations obs
        on obs.organization_id=ol.organization_id and obs.id=ol.source_observation_id
      where ol.organization_id=p_organization_id

      union all

      select
        'ordered'::text role,
        ol.id entity_line_id,
        o.id entity_id,
        o.ordered_at occurred_at,
        o.company_id,
        c.name company_name,
        coalesce(conv.external_thread_id::text,obs.thread_id::text,'') conversation_id,
        ol.raw_spec_text product_text,
        ol.canonical_product_key,
        obs.grade,
        obs.standard,
        ol.unit_price price_value,
        ol.price_unit,
        obs.currency,
        'unknown'::text availability_status,
        coalesce(obs.confidence,1::numeric) confidence,
        ol.source_observation_id,
        obs.source_filename,
        obs.source_text
      from public.order_lines ol
      join public.orders o
        on o.organization_id=ol.organization_id and o.id=ol.order_id
      left join public.companies c
        on c.organization_id=o.organization_id and c.id=o.company_id
      left join public.conversations conv
        on conv.organization_id=o.organization_id and conv.id=o.conversation_id
      left join public.commercial_observations obs
        on obs.organization_id=ol.organization_id and obs.id=ol.source_observation_id
      where ol.organization_id=p_organization_id
    ),
    filtered as (
      select *
      from normalized n
      where (p_role is null or n.role=p_role)
        and (
          nullif(btrim(coalesce(p_grade,'')),'') is null
          or lower(coalesce(n.grade,''))=lower(btrim(p_grade))
        )
        and (
          nullif(btrim(coalesce(p_standard,'')),'') is null
          or lower(coalesce(n.standard,''))=lower(btrim(p_standard))
        )
        and (
          nullif(btrim(coalesce(p_query,'')),'') is null
          or concat_ws(' ',
            n.product_text,n.canonical_product_key,n.grade,n.standard,
            n.company_name,n.source_filename,n.source_text
          ) ilike '%'||btrim(p_query)||'%'
        )
    ),
    paged as (
      select *
      from filtered
      order by occurred_at desc nulls last,entity_line_id desc
      limit greatest(1,least(coalesce(p_limit,50),200))
      offset greatest(coalesce(p_offset,0),0)
    )
    select jsonb_build_object(
      'total',(select count(*) from filtered),
      'rows',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',entity_line_id,
          'entity_id',entity_id,
          'role',role,
          'occurred_at',occurred_at,
          'company_id',company_id,
          'company_name',coalesce(company_name,'Cliente non attribuito'),
          'conversation_id',conversation_id,
          'product_text',coalesce(product_text,canonical_product_key,'Prodotto steel'),
          'canonical_product_key',canonical_product_key,
          'grade',grade,
          'standard',standard,
          'price_value',price_value,
          'price_unit',price_unit,
          'currency',currency,
          'availability_status',availability_status,
          'confidence',confidence,
          'source_observation_id',source_observation_id,
          'source_filename',source_filename
        ) order by occurred_at desc nulls last,entity_line_id desc)
        from paged
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'operational_source','normalized_entities',
        'included_roles',jsonb_build_array('requested','offered','ordered'),
        'delivery_included',false,
        'legacy_used_as','provenance_fallback',
        'company_inference',false
      )
    )
  );
end;
$$;

revoke all on function public.p1_normalized_commercial_explorer(uuid,text,text,text,text,integer,integer)
from public,anon;
grant execute on function public.p1_normalized_commercial_explorer(uuid,text,text,text,text,integer,integer)
to authenticated,service_role;

comment on function public.p1_normalized_commercial_explorer(uuid,text,text,text,text,integer,integer) is
  'PA2.19 normalized Explorer union over RFQ, Offer and Order lines. Legacy observations supply provenance/fallback only; Delivery is excluded until a normalized delivery entity exists.';
