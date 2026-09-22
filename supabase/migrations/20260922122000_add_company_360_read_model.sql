-- PA2.11 — Customer / Company 360 read model.
-- Deterministic normalized links only. No domain/text inference.

create or replace function public.p1_company_directory(
  p_organization_id uuid,
  p_query text default null,
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
companies_base as (
  select
    c.id,
    c.name,
    c.company_type,
    c.country,
    c.vat_number_normalized,
    c.website,
    c.created_at,
    exists (
      select 1
      from public.commercial_company_identity_verifications v
      where v.organization_id=c.organization_id
        and v.company_id=c.id
    ) as verified,
    (select count(*)::int from public.contacts ct
      where ct.organization_id=c.organization_id and ct.company_id=c.id) as contact_count,
    (select count(*)::int from public.messages m
      where m.organization_id=c.organization_id and m.sender_company_id=c.id) as message_count,
    (select count(*)::int from public.rfqs r
      where r.organization_id=c.organization_id and r.company_id=c.id) as rfq_count,
    (select count(*)::int from public.offers o
      where o.organization_id=c.organization_id and o.company_id=c.id) as offer_count,
    (select count(*)::int from public.orders o
      where o.organization_id=c.organization_id and o.company_id=c.id) as order_count,
    greatest(
      coalesce((select max(m.sent_at) from public.messages m
        where m.organization_id=c.organization_id and m.sender_company_id=c.id),'-infinity'::timestamptz),
      coalesce((select max(r.requested_at) from public.rfqs r
        where r.organization_id=c.organization_id and r.company_id=c.id),'-infinity'::timestamptz),
      coalesce((select max(o.offered_at) from public.offers o
        where o.organization_id=c.organization_id and o.company_id=c.id),'-infinity'::timestamptz),
      coalesce((select max(o.ordered_at) from public.orders o
        where o.organization_id=c.organization_id and o.company_id=c.id),'-infinity'::timestamptz),
      c.created_at
    ) as last_activity_at
  from public.companies c
  where c.organization_id=p_organization_id
    and (select allowed from access_check)
    and (
      nullif(btrim(coalesce(p_query,'')),'') is null
      or c.name ilike '%'||btrim(p_query)||'%'
      or coalesce(c.vat_number_normalized,'') ilike '%'||replace(upper(btrim(p_query)),' ','')||'%'
      or coalesce(c.country,'') ilike '%'||btrim(p_query)||'%'
    )
),
rows as (
  select jsonb_build_object(
    'company_id',id,
    'name',name,
    'company_type',company_type,
    'country',country,
    'vat_number',vat_number_normalized,
    'website',website,
    'verified',verified,
    'contact_count',contact_count,
    'message_count',message_count,
    'rfq_count',rfq_count,
    'offer_count',offer_count,
    'order_count',order_count,
    'last_activity_at',case when last_activity_at='-infinity'::timestamptz then null else last_activity_at end
  ) as value
  from companies_base
  order by last_activity_at desc,name
  limit greatest(1,least(coalesce(p_limit,100),500))
)
select jsonb_build_object(
  'total',(select count(*) from companies_base),
  'companies',coalesce((select jsonb_agg(value) from rows),'[]'::jsonb)
);
$$;

revoke execute on function public.p1_company_directory(uuid,text,integer)
from public,anon;
grant execute on function public.p1_company_directory(uuid,text,integer)
to authenticated,service_role;

create or replace function public.p1_company_360(
  p_company_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
with target as (
  select c.*
  from public.companies c
  where c.id=p_company_id
    and public.is_organization_member(c.organization_id,false)
),
verifications as (
  select jsonb_agg(
    jsonb_build_object(
      'verification_id',v.id,
      'identity_type',v.identity_type,
      'identity_value',v.identity_value,
      'verification_basis',v.verification_basis,
      'verified_at',v.created_at,
      'metadata',v.metadata
    )
    order by v.created_at
  ) as value
  from public.commercial_company_identity_verifications v
  join target t on t.organization_id=v.organization_id and t.id=v.company_id
),
contacts as (
  select jsonb_agg(
    jsonb_build_object(
      'contact_id',c.id,
      'full_name',c.full_name,
      'email',c.email_normalized,
      'phone',c.phone,
      'role',c.role,
      'created_at',c.created_at,
      'message_count',(select count(*) from public.messages m
        where m.organization_id=c.organization_id and m.sender_contact_id=c.id),
      'rfq_count',(select count(*) from public.rfqs r
        where r.organization_id=c.organization_id and r.contact_id=c.id)
    )
    order by c.full_name,c.id
  ) as value
  from public.contacts c
  join target t on t.organization_id=c.organization_id and t.id=c.company_id
),
conversations_base as (
  select distinct c.*
  from public.conversations c
  join target t on t.organization_id=c.organization_id
  where c.company_id=t.id
     or exists (
       select 1 from public.messages m
       where m.organization_id=c.organization_id
         and m.conversation_id=c.id
         and m.sender_company_id=t.id
     )
     or exists (
       select 1 from public.rfqs r
       where r.organization_id=c.organization_id
         and r.conversation_id=c.id
         and r.company_id=t.id
     )
     or exists (
       select 1 from public.offers o
       where o.organization_id=c.organization_id
         and o.conversation_id=c.id
         and o.company_id=t.id
     )
     or exists (
       select 1 from public.orders o
       where o.organization_id=c.organization_id
         and o.conversation_id=c.id
         and o.company_id=t.id
     )
),
conversations as (
  select jsonb_agg(
    jsonb_build_object(
      'conversation_id',c.id,
      'subject',c.subject,
      'status',c.status,
      'external_thread_id',c.external_thread_id,
      'started_at',c.started_at,
      'last_activity_at',c.last_activity_at,
      'message_count',(select count(*) from public.messages m
        where m.organization_id=c.organization_id and m.conversation_id=c.id)
    )
    order by c.last_activity_at desc nulls last,c.id
  ) as value
  from conversations_base c
),
messages as (
  select jsonb_agg(
    jsonb_build_object(
      'message_id',m.id,
      'conversation_id',m.conversation_id,
      'external_message_id',m.external_message_id,
      'direction',m.direction,
      'sender_email',m.sender_email,
      'recipient_emails',coalesce(to_jsonb(m.recipient_emails),'[]'::jsonb),
      'sent_at',m.sent_at,
      'subject',m.subject,
      'classification',m.classification,
      'sender_contact_id',m.sender_contact_id,
      'sender_company_id',m.sender_company_id,
      'provenance',jsonb_build_object(
        'source','normalized_message',
        'external_message_id',m.external_message_id,
        'source_thread_id',m.source_thread_id
      )
    )
    order by m.sent_at desc nulls last,m.id
  ) as value
  from public.messages m
  join target t on t.organization_id=m.organization_id
  where m.sender_company_id=t.id
),
rfq_rows as (
  select
    r.*,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'rfq_line_id',rl.id,
          'quantity',rl.requested_quantity,
          'quantity_unit',rl.quantity_unit,
          'grade',rl.requested_grade,
          'standard',rl.requested_standard,
          'length_mm',rl.min_length_mm,
          'canonical_product_id',rl.canonical_product_id,
          'canonical_product_key',rl.canonical_product_key,
          'raw_spec_text',rl.raw_spec_text,
          'source_observation_id',rl.source_observation_id
        )
        order by rl.created_at,rl.id
      )
      from public.rfq_lines rl
      where rl.organization_id=r.organization_id
        and rl.rfq_id=r.id
    ),'[]'::jsonb) as lines
  from public.rfqs r
  join target t on t.organization_id=r.organization_id and t.id=r.company_id
),
rfqs as (
  select jsonb_agg(
    jsonb_build_object(
      'rfq_id',r.id,
      'status',r.status,
      'priority',r.priority,
      'requested_at',r.requested_at,
      'due_at',r.due_at,
      'contact_id',r.contact_id,
      'conversation_id',r.conversation_id,
      'source_message_id',r.source_message_id,
      'assigned_to_user_id',r.assigned_to_user_id,
      'lines',r.lines,
      'provenance',jsonb_build_object(
        'source','normalized_rfq',
        'source_message_id',r.source_message_id
      )
    )
    order by r.requested_at desc nulls last,r.id
  ) as value
  from rfq_rows r
),
offer_rows as (
  select
    o.*,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'offer_line_id',ol.id,
          'rfq_line_id',ol.rfq_line_id,
          'quantity',ol.quantity,
          'quantity_unit',ol.quantity_unit,
          'price_value',ol.price_value,
          'price_unit',ol.price_unit,
          'canonical_product_id',ol.canonical_product_id,
          'canonical_product_key',ol.canonical_product_key,
          'raw_spec_text',ol.raw_spec_text,
          'source_observation_id',ol.source_observation_id
        )
        order by ol.created_at,ol.id
      )
      from public.offer_lines ol
      where ol.organization_id=o.organization_id
        and ol.offer_id=o.id
    ),'[]'::jsonb) as lines
  from public.offers o
  join target t on t.organization_id=o.organization_id and t.id=o.company_id
),
offers as (
  select jsonb_agg(
    jsonb_build_object(
      'offer_id',o.id,
      'rfq_id',o.rfq_id,
      'status',o.status,
      'offered_at',o.offered_at,
      'valid_until',o.valid_until,
      'currency',o.currency,
      'delivery_term',o.delivery_term,
      'payment_terms',o.payment_terms,
      'conversation_id',o.conversation_id,
      'source_message_id',o.source_message_id,
      'lines',o.lines,
      'provenance',jsonb_build_object(
        'source','normalized_offer',
        'source_message_id',o.source_message_id
      )
    )
    order by o.offered_at desc nulls last,o.id
  ) as value
  from offer_rows o
),
order_rows as (
  select
    o.*,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'order_line_id',ol.id,
          'offer_line_id',ol.offer_line_id,
          'quantity',ol.quantity,
          'quantity_unit',ol.quantity_unit,
          'unit_price',ol.unit_price,
          'price_unit',ol.price_unit,
          'promised_date',ol.promised_date,
          'canonical_product_id',ol.canonical_product_id,
          'canonical_product_key',ol.canonical_product_key,
          'raw_spec_text',ol.raw_spec_text,
          'source_observation_id',ol.source_observation_id
        )
        order by ol.created_at,ol.id
      )
      from public.order_lines ol
      where ol.organization_id=o.organization_id
        and ol.order_id=o.id
    ),'[]'::jsonb) as lines
  from public.orders o
  join target t on t.organization_id=o.organization_id and t.id=o.company_id
),
orders as (
  select jsonb_agg(
    jsonb_build_object(
      'order_id',o.id,
      'rfq_id',o.rfq_id,
      'offer_id',o.offer_id,
      'status',o.status,
      'ordered_at',o.ordered_at,
      'customer_order_ref',o.customer_order_ref,
      'conversation_id',o.conversation_id,
      'source_message_id',o.source_message_id,
      'lines',o.lines,
      'provenance',jsonb_build_object(
        'source','normalized_order',
        'source_message_id',o.source_message_id
      )
    )
    order by o.ordered_at desc nulls last,o.id
  ) as value
  from order_rows o
),
line_activity as (
  select
    'rfq'::text as activity_type,
    r.id as business_id,
    r.requested_at as event_at,
    rl.canonical_product_id,
    rl.canonical_product_key,
    rl.requested_grade as grade,
    rl.requested_standard as standard,
    rl.raw_spec_text,
    rl.requested_quantity as quantity,
    rl.quantity_unit,
    null::numeric as price_value,
    null::text as price_unit,
    null::text as currency,
    rl.source_observation_id
  from public.rfqs r
  join target t on t.organization_id=r.organization_id and t.id=r.company_id
  join public.rfq_lines rl on rl.organization_id=r.organization_id and rl.rfq_id=r.id

  union all

  select
    'offer',o.id,o.offered_at,
    ol.canonical_product_id,ol.canonical_product_key,
    null,null,ol.raw_spec_text,
    ol.quantity,ol.quantity_unit,
    ol.price_value,ol.price_unit,o.currency,
    ol.source_observation_id
  from public.offers o
  join target t on t.organization_id=o.organization_id and t.id=o.company_id
  join public.offer_lines ol on ol.organization_id=o.organization_id and ol.offer_id=o.id

  union all

  select
    'order',o.id,o.ordered_at,
    ol.canonical_product_id,ol.canonical_product_key,
    null,null,ol.raw_spec_text,
    ol.quantity,ol.quantity_unit,
    ol.unit_price,ol.price_unit,null,
    ol.source_observation_id
  from public.orders o
  join target t on t.organization_id=o.organization_id and t.id=o.company_id
  join public.order_lines ol on ol.organization_id=o.organization_id and ol.order_id=o.id
),
product_activity as (
  select jsonb_agg(
    jsonb_build_object(
      'canonical_product_id',canonical_product_id,
      'canonical_product_key',canonical_product_key,
      'activity_count',activity_count,
      'rfq_count',rfq_count,
      'offer_count',offer_count,
      'order_count',order_count,
      'last_activity_at',last_activity_at,
      'last_grade',last_grade,
      'last_standard',last_standard,
      'last_raw_spec_text',last_raw_spec_text
    )
    order by last_activity_at desc nulls last
  ) as value
  from (
    select
      canonical_product_id,
      canonical_product_key,
      count(*)::int as activity_count,
      count(*) filter(where activity_type='rfq')::int as rfq_count,
      count(*) filter(where activity_type='offer')::int as offer_count,
      count(*) filter(where activity_type='order')::int as order_count,
      max(event_at) as last_activity_at,
      (array_agg(grade order by event_at desc nulls last) filter(where grade is not null))[1] as last_grade,
      (array_agg(standard order by event_at desc nulls last) filter(where standard is not null))[1] as last_standard,
      (array_agg(raw_spec_text order by event_at desc nulls last) filter(where raw_spec_text is not null))[1] as last_raw_spec_text
    from line_activity
    where canonical_product_id is not null or canonical_product_key is not null
    group by canonical_product_id,canonical_product_key
  ) x
),
price_activity as (
  select jsonb_agg(
    jsonb_build_object(
      'activity_type',activity_type,
      'business_id',business_id,
      'event_at',event_at,
      'canonical_product_id',canonical_product_id,
      'canonical_product_key',canonical_product_key,
      'quantity',quantity,
      'quantity_unit',quantity_unit,
      'price_value',price_value,
      'price_unit',price_unit,
      'currency',currency,
      'source_observation_id',source_observation_id
    )
    order by event_at desc nulls last
  ) as value
  from line_activity
  where price_value is not null
),
timeline as (
  select jsonb_agg(event order by sort_at desc nulls last) as value
  from (
    select m.sent_at as sort_at,
      jsonb_build_object(
        'event_type','message',
        'event_id',m.id,
        'event_at',m.sent_at,
        'title',coalesce(m.subject,'Messaggio'),
        'status',m.classification,
        'contact_id',m.sender_contact_id,
        'source_message_id',m.id,
        'provenance',jsonb_build_object(
          'external_message_id',m.external_message_id,
          'source_thread_id',m.source_thread_id
        )
      ) as event
    from public.messages m
    join target t on t.organization_id=m.organization_id and t.id=m.sender_company_id

    union all

    select r.requested_at,
      jsonb_build_object(
        'event_type','rfq',
        'event_id',r.id,
        'event_at',r.requested_at,
        'title','RFQ',
        'status',r.status,
        'contact_id',r.contact_id,
        'source_message_id',r.source_message_id,
        'provenance',jsonb_build_object(
          'conversation_id',r.conversation_id,
          'source_message_id',r.source_message_id
        )
      )
    from public.rfqs r
    join target t on t.organization_id=r.organization_id and t.id=r.company_id

    union all

    select o.offered_at,
      jsonb_build_object(
        'event_type','offer',
        'event_id',o.id,
        'event_at',o.offered_at,
        'title','Offerta',
        'status',o.status,
        'contact_id',null,
        'source_message_id',o.source_message_id,
        'provenance',jsonb_build_object(
          'rfq_id',o.rfq_id,
          'source_message_id',o.source_message_id
        )
      )
    from public.offers o
    join target t on t.organization_id=o.organization_id and t.id=o.company_id

    union all

    select o.ordered_at,
      jsonb_build_object(
        'event_type','order',
        'event_id',o.id,
        'event_at',o.ordered_at,
        'title','Ordine',
        'status',o.status,
        'contact_id',null,
        'source_message_id',o.source_message_id,
        'provenance',jsonb_build_object(
          'rfq_id',o.rfq_id,
          'offer_id',o.offer_id,
          'source_message_id',o.source_message_id
        )
      )
    from public.orders o
    join target t on t.organization_id=o.organization_id and t.id=o.company_id
  ) events
),
summary as (
  select jsonb_build_object(
    'contacts',(select count(*) from public.contacts c join target t on t.organization_id=c.organization_id and t.id=c.company_id),
    'conversations',(select count(*) from conversations_base),
    'messages',(select count(*) from public.messages m join target t on t.organization_id=m.organization_id and t.id=m.sender_company_id),
    'rfqs',(select count(*) from public.rfqs r join target t on t.organization_id=r.organization_id and t.id=r.company_id),
    'offers',(select count(*) from public.offers o join target t on t.organization_id=o.organization_id and t.id=o.company_id),
    'orders',(select count(*) from public.orders o join target t on t.organization_id=o.organization_id and t.id=o.company_id),
    'priced_lines',(select count(*) from line_activity where price_value is not null),
    'products',(select count(*) from (
      select canonical_product_id,canonical_product_key
      from line_activity
      where canonical_product_id is not null or canonical_product_key is not null
      group by canonical_product_id,canonical_product_key
    ) p)
  ) as value
)
select case
  when not exists(select 1 from target) then null
  else jsonb_build_object(
    'company',(
      select jsonb_build_object(
        'company_id',t.id,
        'name',t.name,
        'company_type',t.company_type,
        'country',t.country,
        'vat_number',t.vat_number_normalized,
        'website',t.website,
        'notes',t.notes,
        'created_at',t.created_at,
        'updated_at',t.updated_at,
        'verified',exists(
          select 1 from public.commercial_company_identity_verifications v
          where v.organization_id=t.organization_id and v.company_id=t.id
        )
      )
      from target t
    ),
    'summary',(select value from summary),
    'verifications',coalesce((select value from verifications),'[]'::jsonb),
    'contacts',coalesce((select value from contacts),'[]'::jsonb),
    'conversations',coalesce((select value from conversations),'[]'::jsonb),
    'messages',coalesce((select value from messages),'[]'::jsonb),
    'rfqs',coalesce((select value from rfqs),'[]'::jsonb),
    'offers',coalesce((select value from offers),'[]'::jsonb),
    'orders',coalesce((select value from orders),'[]'::jsonb),
    'product_activity',coalesce((select value from product_activity),'[]'::jsonb),
    'price_activity',coalesce((select value from price_activity),'[]'::jsonb),
    'timeline',coalesce((select value from timeline),'[]'::jsonb),
    'read_model','normalized_company_360'
  )
end;
$$;

revoke execute on function public.p1_company_360(uuid)
from public,anon;
grant execute on function public.p1_company_360(uuid)
to authenticated,service_role;

comment on function public.p1_company_360(uuid) is
  'PA2.11 deterministic Customer/Company 360 over normalized private business entities with provenance; no domain/text inference.';
