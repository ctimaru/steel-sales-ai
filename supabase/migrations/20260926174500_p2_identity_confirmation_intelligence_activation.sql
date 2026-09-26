-- P2.4 — Identity Confirmation & Intelligence Activation.
-- Human Contact→Company confirmation remains the only decision point.
-- This migration adds deterministic activation preview, conflict guards,
-- conversation-level Company consensus, and reconciliation of already verified identities.

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
  conversation_linked_count integer := 0;
  contact_consensus boolean := false;
  company_consensus boolean := false;
  conversation_company_conflict boolean := false;
  rfq_company_conflict boolean := false;
  company_activation_safe boolean := false;
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

    if company_consensus then
      select exists(
        select 1
        from public.conversations c
        where c.organization_id=target_message.organization_id
          and c.id=target_message.conversation_id
          and c.company_id is not null
          and c.company_id<>consensus_company_id
      )
      into conversation_company_conflict;

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
      select exists(
        select 1
        from public.rfqs r
        where r.organization_id=target_message.organization_id
          and r.id in (select id from target_rfqs)
          and r.company_id is not null
          and r.company_id<>consensus_company_id
      )
      into rfq_company_conflict;
    end if;

    company_activation_safe :=
      company_consensus
      and not conversation_company_conflict
      and not rfq_company_conflict;

    if company_activation_safe then
      update public.conversations c
      set company_id=consensus_company_id
      where c.organization_id=target_message.organization_id
        and c.id=target_message.conversation_id
        and c.company_id is null;

      get diagnostics conversation_linked_count=row_count;
    end if;

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
        when company_activation_safe then coalesce(r.company_id,consensus_company_id)
        else r.company_id
      end
    where r.organization_id=target_message.organization_id
      and r.id in (select id from target_rfqs)
      and (r.conversation_id is null or r.conversation_id=target_message.conversation_id)
      and (identity_message_count<>1 or r.source_message_id is null or r.source_message_id=target_message.id)
      and (not contact_consensus or r.contact_id is null or r.contact_id=consensus_contact_id)
      and (not company_activation_safe or r.company_id is null or r.company_id=consensus_company_id)
      and (
        r.conversation_id is null
        or (identity_message_count=1 and r.source_message_id is null)
        or (contact_consensus and r.contact_id is null)
        or (company_activation_safe and r.company_id is null)
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
      when company_consensus and (conversation_company_conflict or rfq_company_conflict)
        then 'blocked_existing_business_company_conflict'
      when company_activation_safe and identity_message_count=1 then 'linked_verified_contact_company'
      when company_activation_safe then 'linked_verified_company_consensus'
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
      'conversation_company_conflict',conversation_company_conflict,
      'rfq_company_conflict',rfq_company_conflict,
      'company_activation_safe',company_activation_safe,
      'consensus_contact_id',consensus_contact_id,
      'consensus_company_id',consensus_company_id
    ),
    'conversation_linked_count',conversation_linked_count,
    'rfq_linked_count',rfq_linked_count
  );
end;
$$;

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
    'linked_rfqs',linked_rfqs
  );
end;
$$;

create or replace function public.p2_identity_activation_readiness(
  p_organization_id uuid,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with access_check as (
  select public.is_organization_member(p_organization_id,false) as allowed
),
pending_contacts as (
  select ct.id as contact_id,ct.full_name,ct.email_normalized as email
  from public.contacts ct
  where ct.organization_id=p_organization_id
    and ct.company_id is null
    and ct.email_normalized is not null
    and ct.email_normalized<>''
    and (select allowed from access_check)
    and exists (
      select 1
      from public.messages m
      where m.organization_id=ct.organization_id
        and coalesce(m.direction,'inbound')<>'outbound'
        and (
          m.sender_contact_id=ct.id
          or lower(btrim(coalesce(m.sender_email,'')))=ct.email_normalized
        )
    )
),
affected_messages as (
  select distinct pc.contact_id,m.id as message_id,m.conversation_id
  from pending_contacts pc
  join public.messages m
    on m.organization_id=p_organization_id
   and coalesce(m.direction,'inbound')<>'outbound'
   and (
     m.sender_contact_id=pc.contact_id
     or lower(btrim(coalesce(m.sender_email,'')))=pc.email
   )
),
affected_conversations as (
  select distinct am.contact_id,c.id as conversation_id,c.company_id
  from affected_messages am
  join public.conversations c
    on c.organization_id=p_organization_id
   and c.id=am.conversation_id
  where am.conversation_id is not null
),
affected_rfqs as (
  select distinct pc.contact_id,r.id as rfq_id,r.company_id
  from pending_contacts pc
  join public.rfqs r
    on r.organization_id=p_organization_id
  where r.contact_id=pc.contact_id
     or exists (
       select 1
       from affected_messages am
       where am.contact_id=pc.contact_id
         and (
           r.source_message_id=am.message_id
           or (
             am.conversation_id is not null
             and r.conversation_id=am.conversation_id
           )
         )
     )
),
contact_rollup as (
  select
    pc.contact_id,
    pc.full_name,
    pc.email,
    (select count(*)::int
      from affected_messages am
      where am.contact_id=pc.contact_id) as message_count,
    (select count(distinct ac.conversation_id)::int
      from affected_conversations ac
      where ac.contact_id=pc.contact_id) as conversation_count,
    (select count(*)::int
      from affected_rfqs ar
      where ar.contact_id=pc.contact_id) as rfq_count,
    (select count(*)::int
      from affected_rfqs ar
      where ar.contact_id=pc.contact_id
        and ar.company_id is null) as unattributed_rfq_count,
    (select count(*)::int
      from affected_conversations ac
      where ac.contact_id=pc.contact_id
        and ac.company_id is not null) as assigned_conversation_count,
    coalesce((
      select array_agg(distinct ac.company_id order by ac.company_id)
      from affected_conversations ac
      where ac.contact_id=pc.contact_id
        and ac.company_id is not null
    ),'{}'::uuid[]) as existing_conversation_company_ids,
    coalesce((
      select array_agg(distinct ar.company_id order by ar.company_id)
      from affected_rfqs ar
      where ar.contact_id=pc.contact_id
        and ar.company_id is not null
    ),'{}'::uuid[]) as existing_rfq_company_ids
  from pending_contacts pc
),
rows as (
  select *
  from contact_rollup
  order by unattributed_rfq_count desc,message_count desc,email,contact_id
  limit greatest(1,least(coalesce(p_limit,100),500))
)
select jsonb_build_object(
  'summary',jsonb_build_object(
    'pending_contacts',(select count(*) from pending_contacts),
    'affected_messages',(select count(distinct message_id) from affected_messages),
    'affected_conversations',(select count(distinct conversation_id) from affected_conversations),
    'affected_rfqs',(select count(distinct rfq_id) from affected_rfqs),
    'unattributed_rfqs',(
      select count(distinct rfq_id)
      from affected_rfqs
      where company_id is null
    )
  ),
  'contacts',coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'contact_id',contact_id,
        'full_name',full_name,
        'email',email,
        'message_count',message_count,
        'conversation_count',conversation_count,
        'rfq_count',rfq_count,
        'unattributed_rfq_count',unattributed_rfq_count,
        'assigned_conversation_count',assigned_conversation_count,
        'existing_conversation_company_ids',to_jsonb(existing_conversation_company_ids),
        'existing_rfq_company_ids',to_jsonb(existing_rfq_company_ids)
      )
      order by unattributed_rfq_count desc,message_count desc,email,contact_id
    )
    from rows
  ),'[]'::jsonb),
  'policy',jsonb_build_object(
    'human_confirmation_required',true,
    'verified_company_required',true,
    'exact_email_identity_only',true,
    'email_domain_inference',false,
    'conversation_company_requires_consensus',true,
    'conflicting_existing_company_blocks_confirmation',true,
    'activation_is_synchronous',true
  )
);
$$;

create or replace function private.p2_reconcile_verified_identity_activation_impl(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  message_row record;
  resolution_result jsonb;
  processed_messages integer := 0;
  resolved_messages integer := 0;
  activated_conversations integer := 0;
  linked_rfqs integer := 0;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'Active organization write membership required';
  end if;

  for message_row in
    select m.id
    from public.messages m
    join public.contacts ct
      on ct.organization_id=m.organization_id
     and ct.email_normalized=lower(btrim(coalesce(m.sender_email,'')))
     and ct.company_id is not null
    where m.organization_id=p_organization_id
      and coalesce(m.direction,'inbound')<>'outbound'
      and exists (
        select 1
        from public.commercial_company_identity_verifications v
        where v.organization_id=ct.organization_id
          and v.company_id=ct.company_id
      )
    order by m.sent_at nulls last,m.id
  loop
    processed_messages := processed_messages+1;
    resolution_result := private.resolve_message_business_identity_impl(message_row.id);

    if resolution_result->>'status'='resolved' then
      resolved_messages := resolved_messages+1;
      activated_conversations := activated_conversations+
        coalesce((resolution_result->>'conversation_linked_count')::int,0);
      linked_rfqs := linked_rfqs+
        coalesce((resolution_result->>'rfq_linked_count')::int,0);
    end if;
  end loop;

  return jsonb_build_object(
    'status','reconciled',
    'organization_id',p_organization_id,
    'processed_messages',processed_messages,
    'resolved_messages',resolved_messages,
    'activated_conversations',activated_conversations,
    'linked_rfqs',linked_rfqs
  );
end;
$$;

revoke execute on function private.p2_reconcile_verified_identity_activation_impl(uuid)
  from public,anon;
grant execute on function private.p2_reconcile_verified_identity_activation_impl(uuid)
  to authenticated,service_role;

create or replace function public.p2_reconcile_verified_identity_activation(
  p_organization_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.p2_reconcile_verified_identity_activation_impl(p_organization_id);
$$;

revoke all on function public.p2_identity_activation_readiness(uuid,integer)
  from public,anon;
grant execute on function public.p2_identity_activation_readiness(uuid,integer)
  to authenticated,service_role;

revoke all on function public.p2_reconcile_verified_identity_activation(uuid)
  from public,anon;
grant execute on function public.p2_reconcile_verified_identity_activation(uuid)
  to authenticated,service_role;

comment on function public.p2_identity_activation_readiness(uuid,integer) is
  'P2.4 tenant-safe impact preview for unresolved exact-email Contact identities. It never proposes a Company or uses domain inference.';

comment on function public.p2_reconcile_verified_identity_activation(uuid) is
  'P2.4 deterministic reconciliation of already verified Contact→Company mappings into messages, conversations and RFQs. It creates no new identity decision.';

comment on function public.confirm_contact_company_mapping(uuid,uuid,jsonb) is
  'Human Contact→verified Company confirmation. P2.4 preflights business-entity conflicts and synchronously activates exact-email messages, consensus-safe conversations and RFQs.';
