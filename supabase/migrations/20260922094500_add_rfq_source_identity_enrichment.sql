-- PA2.6 — source/business identity enrichment for promoted RFQs.
-- Safely materializes normalized Conversation identity from commercial_threads.
-- Message / Company / Contact identities are never invented.

create unique index if not exists conversations_org_external_thread_uq
  on public.conversations (organization_id, external_thread_id)
  where external_thread_id is not null;

create or replace function public.p1_rfq_identity_readiness(
  p_organization_id uuid,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
with promoted_rfqs as (
  select
    r.id as rfq_id,
    r.organization_id,
    r.conversation_id,
    r.source_message_id,
    r.company_id,
    r.contact_id,
    count(distinct o.thread_id)::int as source_thread_count,
    min(o.thread_id::text)::uuid as source_thread_id
  from public.rfqs r
  join public.rfq_lines rl
    on rl.rfq_id=r.id and rl.organization_id=r.organization_id
  join public.current_commercial_entity_promotions p
    on p.organization_id=rl.organization_id
   and p.entity_type='rfq_line'
   and p.entity_id=rl.id
  join public.commercial_observations o
    on o.organization_id=p.organization_id
   and o.id=p.observation_id
  where r.organization_id=p_organization_id
  group by r.id,r.organization_id,r.conversation_id,r.source_message_id,r.company_id,r.contact_id
),
rows as (
  select jsonb_build_object(
    'rfq_id',pr.rfq_id,
    'source_thread_count',pr.source_thread_count,
    'source_thread_id',pr.source_thread_id,
    'source_conversation_id',t.source_conversation_id,
    'subject',t.subject,
    'conversation_status',case
      when pr.conversation_id is not null then 'linked'
      when pr.source_thread_count=1 and t.source_conversation_id is not null then 'ready'
      when pr.source_thread_count>1 then 'blocked_multiple_source_threads'
      else 'blocked_missing_source_thread'
    end,
    'conversation_id',pr.conversation_id,
    'message_status',case
      when pr.source_message_id is not null then 'linked'
      else 'blocked_missing_message_evidence'
    end,
    'source_message_id',pr.source_message_id,
    'company_status',case
      when pr.company_id is not null then 'linked'
      else 'blocked_missing_company_evidence'
    end,
    'company_id',pr.company_id,
    'contact_status',case
      when pr.contact_id is not null then 'linked'
      else 'blocked_missing_contact_evidence'
    end,
    'contact_id',pr.contact_id
  ) as value
  from promoted_rfqs pr
  left join public.commercial_threads t
    on pr.source_thread_count=1
   and t.organization_id=pr.organization_id
   and t.id=pr.source_thread_id
  order by
    case
      when pr.conversation_id is null and pr.source_thread_count=1 and t.source_conversation_id is not null then 0
      else 1
    end,
    pr.rfq_id
  limit greatest(1,least(coalesce(p_limit,100),500))
),
summary as (
  select jsonb_build_object(
    'promoted_rfqs',count(*),
    'conversation_ready',count(*) filter (
      where conversation_id is null and source_thread_count=1
    ),
    'conversation_linked',count(*) filter (where conversation_id is not null),
    'message_linked',count(*) filter (where source_message_id is not null),
    'company_linked',count(*) filter (where company_id is not null),
    'contact_linked',count(*) filter (where contact_id is not null)
  ) as value
  from promoted_rfqs
)
select jsonb_build_object(
  'summary',(select value from summary),
  'rfqs',coalesce((select jsonb_agg(value) from rows),'[]'::jsonb),
  'policy',jsonb_build_object(
    'conversation_requires_single_source_thread',true,
    'message_requires_structured_message_evidence',true,
    'company_requires_deterministic_business_identity',true,
    'contact_requires_deterministic_contact_identity',true,
    'no_identity_inference_from_subject_or_filename',true
  )
);
$$;

revoke all on function public.p1_rfq_identity_readiness(uuid,integer)
from public,anon,authenticated;
grant execute on function public.p1_rfq_identity_readiness(uuid,integer)
to service_role;

create or replace function private.enrich_promoted_rfq_source_impl(
  p_rfq_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $source_enrichment$
declare
  actor_id uuid := (select auth.uid());
  target_rfq public.rfqs%rowtype;
  source_thread_count integer;
  source_thread public.commercial_threads%rowtype;
  normalized_conversation_id uuid;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_rfq
  from public.rfqs
  where id=p_rfq_id
  for update;

  if not found then
    raise exception 'RFQ not found';
  end if;

  if not public.is_organization_member(target_rfq.organization_id,true) then
    raise exception 'Active organization write membership required';
  end if;

  select count(distinct o.thread_id)::int
  into source_thread_count
  from public.rfq_lines rl
  join public.current_commercial_entity_promotions p
    on p.organization_id=rl.organization_id
   and p.entity_type='rfq_line'
   and p.entity_id=rl.id
  join public.commercial_observations o
    on o.organization_id=p.organization_id
   and o.id=p.observation_id
  where rl.organization_id=target_rfq.organization_id
    and rl.rfq_id=target_rfq.id;

  if source_thread_count=0 then
    raise exception 'RFQ has no promoted source observations';
  end if;

  if source_thread_count<>1 then
    raise exception 'RFQ source observations span multiple commercial threads';
  end if;

  select t.*
  into source_thread
  from public.commercial_threads t
  where t.organization_id=target_rfq.organization_id
    and t.id=(
      select min(o.thread_id::text)::uuid
      from public.rfq_lines rl
      join public.current_commercial_entity_promotions p
        on p.organization_id=rl.organization_id
       and p.entity_type='rfq_line'
       and p.entity_id=rl.id
      join public.commercial_observations o
        on o.organization_id=p.organization_id
       and o.id=p.observation_id
      where rl.organization_id=target_rfq.organization_id
        and rl.rfq_id=target_rfq.id
    );

  if not found or source_thread.source_conversation_id is null then
    raise exception 'Source conversation identity unavailable';
  end if;

  select c.id
  into normalized_conversation_id
  from public.conversations c
  where c.organization_id=target_rfq.organization_id
    and c.external_thread_id=source_thread.source_conversation_id::text
  limit 1;

  if normalized_conversation_id is null then
    insert into public.conversations(
      owner_id,
      organization_id,
      subject,
      external_thread_id,
      status,
      started_at,
      last_activity_at
    )
    values(
      actor_id,
      target_rfq.organization_id,
      source_thread.subject,
      source_thread.source_conversation_id::text,
      'open',
      source_thread.started_at,
      source_thread.last_activity_at
    )
    returning id into normalized_conversation_id;
  end if;

  if target_rfq.conversation_id is not null
     and target_rfq.conversation_id<>normalized_conversation_id then
    raise exception 'RFQ already linked to a different conversation';
  end if;

  update public.rfqs
  set conversation_id=normalized_conversation_id
  where id=target_rfq.id
    and organization_id=target_rfq.organization_id
    and conversation_id is distinct from normalized_conversation_id;

  return jsonb_build_object(
    'status',case when target_rfq.conversation_id is null then 'enriched' else 'already_enriched' end,
    'rfq_id',target_rfq.id,
    'conversation_id',normalized_conversation_id,
    'source_thread_id',source_thread.id,
    'source_conversation_id',source_thread.source_conversation_id,
    'message_status',case when target_rfq.source_message_id is null
      then 'blocked_missing_message_evidence' else 'linked' end,
    'company_status',case when target_rfq.company_id is null
      then 'blocked_missing_company_evidence' else 'linked' end,
    'contact_status',case when target_rfq.contact_id is null
      then 'blocked_missing_contact_evidence' else 'linked' end
  );
end;
$source_enrichment$;

revoke execute on function private.enrich_promoted_rfq_source_impl(uuid)
from public,anon;
grant execute on function private.enrich_promoted_rfq_source_impl(uuid)
to authenticated,service_role;

create or replace function public.enrich_promoted_rfq_source(
  p_rfq_id uuid
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.enrich_promoted_rfq_source_impl(p_rfq_id);
$$;

revoke execute on function public.enrich_promoted_rfq_source(uuid)
from public,anon;
grant execute on function public.enrich_promoted_rfq_source(uuid)
to authenticated,service_role;

comment on function public.enrich_promoted_rfq_source(uuid) is
  'PA2.6 safely materializes Conversation identity from a single supporting commercial thread; Message/Company/Contact are never inferred.';
