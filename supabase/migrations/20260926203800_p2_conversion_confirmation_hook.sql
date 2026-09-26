-- P2.5 closure — synchronize human identity confirmation with outcome attribution.
create or replace function private.confirm_contact_company_mapping_impl(
  p_contact_id uuid,
  p_company_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_contact public.contacts%rowtype;
  mapping_result jsonb;
  message_row record;
  resolution_result jsonb;
  outcome_result jsonb;
  resolved_messages integer := 0;
  linked_rfqs integer := 0;
  activated_conversations integer := 0;
  affected_messages integer := 0;
  affected_conversations integer := 0;
  affected_rfqs integer := 0;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_contact
  from public.contacts
  where id=p_contact_id
  for update;

  if not found then
    raise exception 'Contact not found';
  end if;

  if not public.is_organization_member(target_contact.organization_id,true) then
    raise exception 'Active organization write membership required';
  end if;

  if not exists (
    select 1
    from public.companies c
    join public.commercial_company_identity_verifications v
      on v.organization_id=c.organization_id
     and v.company_id=c.id
    where c.organization_id=target_contact.organization_id
      and c.id=p_company_id
  ) then
    raise exception 'Company has no verified business identity';
  end if;

  with affected as (
    select distinct m.id,m.conversation_id
    from public.messages m
    where m.organization_id=target_contact.organization_id
      and coalesce(m.direction,'inbound')<>'outbound'
      and (
        m.sender_contact_id=target_contact.id
        or lower(btrim(coalesce(m.sender_email,'')))=target_contact.email_normalized
      )
  )
  select count(*)::int,count(distinct conversation_id)::int
  into affected_messages,affected_conversations
  from affected;

  if exists (
    with affected as (
      select distinct m.conversation_id
      from public.messages m
      where m.organization_id=target_contact.organization_id
        and coalesce(m.direction,'inbound')<>'outbound'
        and m.conversation_id is not null
        and (
          m.sender_contact_id=target_contact.id
          or lower(btrim(coalesce(m.sender_email,'')))=target_contact.email_normalized
        )
    )
    select 1
    from public.conversations c
    join affected a on a.conversation_id=c.id
    where c.organization_id=target_contact.organization_id
      and c.company_id is not null
      and c.company_id<>p_company_id
  ) then
    raise exception 'Identity activation conflicts with an existing Conversation Company';
  end if;

  if exists (
    with affected_messages as (
      select distinct m.id,m.conversation_id
      from public.messages m
      where m.organization_id=target_contact.organization_id
        and coalesce(m.direction,'inbound')<>'outbound'
        and (
          m.sender_contact_id=target_contact.id
          or lower(btrim(coalesce(m.sender_email,'')))=target_contact.email_normalized
        )
    )
    select 1
    from public.rfqs r
    where r.organization_id=target_contact.organization_id
      and (
        r.contact_id=target_contact.id
        or r.source_message_id in (select id from affected_messages)
        or r.conversation_id in (
          select conversation_id
          from affected_messages
          where conversation_id is not null
        )
      )
      and r.company_id is not null
      and r.company_id<>p_company_id
  ) then
    raise exception 'Identity activation conflicts with an existing RFQ Company';
  end if;

  select count(distinct r.id)::int
  into affected_rfqs
  from public.rfqs r
  where r.organization_id=target_contact.organization_id
    and (
      r.contact_id=target_contact.id
      or r.source_message_id in (
        select m.id
        from public.messages m
        where m.organization_id=target_contact.organization_id
          and coalesce(m.direction,'inbound')<>'outbound'
          and (
            m.sender_contact_id=target_contact.id
            or lower(btrim(coalesce(m.sender_email,'')))=target_contact.email_normalized
          )
      )
      or r.conversation_id in (
        select m.conversation_id
        from public.messages m
        where m.organization_id=target_contact.organization_id
          and coalesce(m.direction,'inbound')<>'outbound'
          and m.conversation_id is not null
          and (
            m.sender_contact_id=target_contact.id
            or lower(btrim(coalesce(m.sender_email,'')))=target_contact.email_normalized
          )
      )
    );

  mapping_result := private.link_contact_to_verified_company_impl(
    p_contact_id,
    p_company_id,
    'human_confirmed',
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object(
      'phase','P2.4',
      'outcome_activation_phase','P2.5',
      'confirmed_by',actor_id
    )
  );

  for message_row in
    select m.id
    from public.messages m
    where m.organization_id=target_contact.organization_id
      and coalesce(m.direction,'inbound')<>'outbound'
      and (
        m.sender_contact_id=target_contact.id
        or lower(btrim(coalesce(m.sender_email,'')))=target_contact.email_normalized
      )
    order by m.sent_at nulls last,m.id
  loop
    resolution_result := private.resolve_message_business_identity_impl(message_row.id);

    if resolution_result->>'status'='resolved' then
      resolved_messages := resolved_messages+1;
      linked_rfqs := linked_rfqs+
        coalesce((resolution_result->>'rfq_linked_count')::int,0);
      activated_conversations := activated_conversations+
        coalesce((resolution_result->>'conversation_linked_count')::int,0);
    end if;
  end loop;

  outcome_result := private.p2_reconcile_commercial_outcome_attribution_impl(
    target_contact.organization_id
  );

  return jsonb_build_object(
    'status','confirmed',
    'contact_id',p_contact_id,
    'company_id',p_company_id,
    'mapping_status',mapping_result->>'status',
    'mapping_id',mapping_result->>'mapping_id',
    'affected_messages',affected_messages,
    'affected_conversations',affected_conversations,
    'affected_rfqs',affected_rfqs,
    'resolved_messages',resolved_messages,
    'activated_conversations',activated_conversations,
    'linked_rfqs',linked_rfqs,
    'outcome_offers_attributed',coalesce((outcome_result->>'offers_attributed')::int,0),
    'outcome_orders_attributed',coalesce((outcome_result->>'orders_attributed')::int,0),
    'outcome_offer_source_conflicts',coalesce((outcome_result->>'offer_source_conflicts')::int,0),
    'outcome_order_source_conflicts',coalesce((outcome_result->>'order_source_conflicts')::int,0)
  );
end;
$$;

comment on function private.confirm_contact_company_mapping_impl(uuid,uuid,jsonb) is
  'P2.4 human identity confirmation with P2.5 synchronous deterministic Offer/Order Company reconciliation.';
