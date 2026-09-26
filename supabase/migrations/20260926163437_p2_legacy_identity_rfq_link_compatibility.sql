create or replace function private.resolve_message_business_identity_impl(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_message public.messages%rowtype;
  target_contact public.contacts%rowtype;
  normalized_sender text;
  identity_message_count integer := 0;
  exact_contact_message_count integer := 0;
  mapped_company_message_count integer := 0;
  distinct_contact_count integer := 0;
  distinct_company_count integer := 0;
  consensus_contact_id uuid;
  consensus_company_id uuid;
  rfq_linked_count integer := 0;
  contact_consensus boolean := false;
  company_consensus boolean := false;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_message
  from public.messages
  where id=p_message_id
  for update;

  if not found then
    raise exception 'Message not found';
  end if;

  if not public.is_organization_member(target_message.organization_id,true) then
    raise exception 'Active organization write membership required';
  end if;

  normalized_sender := lower(btrim(coalesce(target_message.sender_email,'')));

  if normalized_sender='' then
    return jsonb_build_object(
      'status','blocked_missing_sender_email',
      'message_id',target_message.id
    );
  end if;

  select *
  into target_contact
  from public.contacts c
  where c.organization_id=target_message.organization_id
    and c.email_normalized=normalized_sender
  limit 1;

  if not found then
    return jsonb_build_object(
      'status','blocked_missing_verified_contact',
      'message_id',target_message.id,
      'sender_email',normalized_sender
    );
  end if;

  update public.messages
  set
    sender_contact_id=target_contact.id,
    sender_company_id=target_contact.company_id
  where id=target_message.id;

  insert into public.commercial_identity_resolutions(
    organization_id,message_id,contact_id,company_id,resolution_type,basis,resolved_by,metadata
  )
  values(
    target_message.organization_id,
    target_message.id,
    target_contact.id,
    null,
    'contact',
    'exact_email',
    actor_id,
    jsonb_build_object('sender_email',normalized_sender)
  )
  on conflict do nothing;

  if target_contact.company_id is not null then
    insert into public.commercial_identity_resolutions(
      organization_id,message_id,contact_id,company_id,resolution_type,basis,resolved_by,metadata
    )
    values(
      target_message.organization_id,
      target_message.id,
      target_contact.id,
      target_contact.company_id,
      'contact_company',
      'verified_contact_company',
      actor_id,
      jsonb_build_object('contact_id',target_contact.id)
    )
    on conflict do nothing;
  end if;

  if target_message.conversation_id is not null then
    select
      count(*)::int,
      count(c.id)::int,
      count(c.company_id)::int,
      count(distinct c.id)::int,
      count(distinct c.company_id)::int,
      min(c.id::text)::uuid,
      min(c.company_id::text)::uuid
    into
      identity_message_count,
      exact_contact_message_count,
      mapped_company_message_count,
      distinct_contact_count,
      distinct_company_count,
      consensus_contact_id,
      consensus_company_id
    from public.messages m
    left join public.contacts c
      on c.organization_id=m.organization_id
     and c.email_normalized=lower(btrim(coalesce(m.sender_email,'')))
    where m.organization_id=target_message.organization_id
      and m.conversation_id=target_message.conversation_id
      and coalesce(m.direction,'inbound')<>'outbound'
      and nullif(lower(btrim(coalesce(m.sender_email,''))),'') is not null;

    contact_consensus :=
      identity_message_count>0
      and exact_contact_message_count=identity_message_count
      and distinct_contact_count=1;

    company_consensus :=
      identity_message_count>0
      and mapped_company_message_count=identity_message_count
      and distinct_company_count=1;

    with target_rfqs as (
      select r.id
      from public.rfqs r
      where r.organization_id=target_message.organization_id
        and r.conversation_id=target_message.conversation_id

      union

      select distinct r.id
      from public.conversations c
      join public.commercial_threads t
        on t.organization_id=c.organization_id
       and t.source_conversation_id::text=c.external_thread_id
      join public.commercial_observations o
        on o.organization_id=t.organization_id
       and o.thread_id=t.id
      join public.current_commercial_entity_promotions p
        on p.organization_id=o.organization_id
       and p.observation_id=o.id
       and p.entity_type='rfq_line'
      join public.rfq_lines rl
        on rl.organization_id=p.organization_id
       and rl.id=p.entity_id
      join public.rfqs r
        on r.organization_id=rl.organization_id
       and r.id=rl.rfq_id
      where c.organization_id=target_message.organization_id
        and c.id=target_message.conversation_id
    )
    update public.rfqs r
    set
      conversation_id=coalesce(r.conversation_id,target_message.conversation_id),
      source_message_id=case
        when identity_message_count=1 then coalesce(r.source_message_id,target_message.id)
        else r.source_message_id
      end,
      contact_id=case
        when contact_consensus then coalesce(r.contact_id,consensus_contact_id)
        else r.contact_id
      end,
      company_id=case
        when company_consensus then coalesce(r.company_id,consensus_company_id)
        else r.company_id
      end
    where r.organization_id=target_message.organization_id
      and r.id in (select id from target_rfqs)
      and (r.conversation_id is null or r.conversation_id=target_message.conversation_id)
      and (identity_message_count<>1 or r.source_message_id is null or r.source_message_id=target_message.id)
      and (not contact_consensus or r.contact_id is null or r.contact_id=consensus_contact_id)
      and (not company_consensus or r.company_id is null or r.company_id=consensus_company_id)
      and (
        r.conversation_id is null
        or (identity_message_count=1 and r.source_message_id is null)
        or (contact_consensus and r.contact_id is null)
        or (company_consensus and r.company_id is null)
      );

    get diagnostics rfq_linked_count=row_count;
  end if;

  return jsonb_build_object(
    'status','resolved',
    'message_id',target_message.id,
    'contact_id',target_contact.id,
    'company_id',target_contact.company_id,
    'company_status',case
      when target_contact.company_id is null then 'blocked_missing_verified_company_mapping'
      when company_consensus and identity_message_count=1 then 'linked_verified_contact_company'
      when company_consensus then 'linked_verified_company_consensus'
      else 'blocked_conversation_company_consensus'
    end,
    'conversation_identity',jsonb_build_object(
      'identity_message_count',identity_message_count,
      'exact_contact_message_count',exact_contact_message_count,
      'mapped_company_message_count',mapped_company_message_count,
      'distinct_contact_count',distinct_contact_count,
      'distinct_company_count',distinct_company_count,
      'contact_consensus',contact_consensus,
      'company_consensus',company_consensus,
      'consensus_contact_id',consensus_contact_id,
      'consensus_company_id',consensus_company_id
    ),
    'rfq_linked_count',rfq_linked_count
  );
end;
$$;

comment on function private.resolve_message_business_identity_impl(uuid) is
  'Exact-email message identity resolver. Preserves PA2.8 single-message RFQ conversation/source/contact/company propagation and requires deterministic Contact/Company consensus for multi-message conversations.';
