
create table if not exists public.buyer_rfq_negotiation_threads(
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.buyer_rfq_campaigns(id) on delete cascade,
  supplier_id uuid not null references public.buyer_rfq_suppliers(id) on delete cascade,
  dispatch_id uuid not null references public.buyer_rfq_dispatches(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'open'
    check(status in('open','awaiting_supplier','awaiting_buyer','bafo_requested','bafo_received','closed')),
  active_request_type text
    check(active_request_type is null or active_request_type in('clarification','revision','counter_target','bafo')),
  request_due_at timestamptz,
  active_request_at timestamptz,
  round_no integer not null default 0 check(round_no>=0),
  reminder_count integer not null default 0 check(reminder_count between 0 and 2),
  last_reminder_at timestamptz,
  last_message_at timestamptz,
  last_buyer_message_at timestamptz,
  last_supplier_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(dispatch_id)
);

create index if not exists buyer_rfq_negotiation_threads_rfq_idx
  on public.buyer_rfq_negotiation_threads(rfq_id,updated_at desc);
create index if not exists buyer_rfq_negotiation_threads_supplier_idx
  on public.buyer_rfq_negotiation_threads(supplier_id,updated_at desc);
create index if not exists buyer_rfq_negotiation_threads_owner_idx
  on public.buyer_rfq_negotiation_threads(owner_user_id,updated_at desc);
create index if not exists buyer_rfq_negotiation_threads_org_idx
  on public.buyer_rfq_negotiation_threads(organization_id,updated_at desc);

create table if not exists public.buyer_rfq_negotiation_messages(
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.buyer_rfq_negotiation_threads(id) on delete cascade,
  rfq_id uuid not null references public.buyer_rfq_campaigns(id) on delete cascade,
  supplier_id uuid not null references public.buyer_rfq_suppliers(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_role text not null check(sender_role in('buyer','supplier','system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  message_type text not null
    check(message_type in('message','clarification','revision_request','counter_target','bafo_request','reminder','system')),
  round_no integer not null default 0 check(round_no>=0),
  body text not null check(char_length(body) between 1 and 4000),
  request_due_at timestamptz,
  notification_status text not null default 'not_required'
    check(notification_status in('not_required','pending','sent','failed','skipped')),
  notification_provider_message_id text,
  notification_error text check(notification_error is null or char_length(notification_error)<=1000),
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists buyer_rfq_negotiation_messages_thread_idx
  on public.buyer_rfq_negotiation_messages(thread_id,created_at,id);
create index if not exists buyer_rfq_negotiation_messages_rfq_idx
  on public.buyer_rfq_negotiation_messages(rfq_id,created_at desc);
create index if not exists buyer_rfq_negotiation_messages_supplier_idx
  on public.buyer_rfq_negotiation_messages(supplier_id,created_at desc);
create index if not exists buyer_rfq_negotiation_messages_owner_idx
  on public.buyer_rfq_negotiation_messages(owner_user_id,created_at desc);
create index if not exists buyer_rfq_negotiation_messages_org_idx
  on public.buyer_rfq_negotiation_messages(organization_id,created_at desc);
create index if not exists buyer_rfq_negotiation_messages_actor_idx
  on public.buyer_rfq_negotiation_messages(actor_user_id,created_at desc);

create table if not exists public.buyer_rfq_negotiation_targets(
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.buyer_rfq_negotiation_threads(id) on delete cascade,
  message_id uuid not null references public.buyer_rfq_negotiation_messages(id) on delete cascade,
  rfq_line_id uuid not null references public.buyer_distinta_lines(id) on delete restrict,
  target_basis text not null check(target_basis in('eur_t','eur_m')),
  target_value numeric(18,6) not null check(target_value>0),
  normalized_eur_t numeric(18,6) not null check(normalized_eur_t>0),
  normalized_eur_m numeric(18,6) not null check(normalized_eur_m>0),
  created_at timestamptz not null default now(),
  unique(message_id,rfq_line_id)
);

create index if not exists buyer_rfq_negotiation_targets_thread_idx
  on public.buyer_rfq_negotiation_targets(thread_id,message_id);
create index if not exists buyer_rfq_negotiation_targets_line_idx
  on public.buyer_rfq_negotiation_targets(rfq_line_id);

alter table public.buyer_rfq_negotiation_threads enable row level security;
alter table public.buyer_rfq_negotiation_messages enable row level security;
alter table public.buyer_rfq_negotiation_targets enable row level security;

revoke all on public.buyer_rfq_negotiation_threads from anon,authenticated;
revoke all on public.buyer_rfq_negotiation_messages from anon,authenticated;
revoke all on public.buyer_rfq_negotiation_targets from anon,authenticated;

grant select on public.buyer_rfq_negotiation_threads to authenticated;
grant select on public.buyer_rfq_negotiation_messages to authenticated;
grant select on public.buyer_rfq_negotiation_targets to authenticated;

create policy buyer_rfq_negotiation_threads_owner_select
on public.buyer_rfq_negotiation_threads
for select to authenticated
using(owner_user_id=(select auth.uid()));

create policy buyer_rfq_negotiation_messages_owner_select
on public.buyer_rfq_negotiation_messages
for select to authenticated
using(owner_user_id=(select auth.uid()));

create policy buyer_rfq_negotiation_targets_owner_select
on public.buyer_rfq_negotiation_targets
for select to authenticated
using(
  exists(
    select 1
    from public.buyer_rfq_negotiation_threads t
    where t.id=buyer_rfq_negotiation_targets.thread_id
      and t.owner_user_id=(select auth.uid())
  )
);

create or replace function private.rfqh6_buyer_post_impl(
  p_rfq_id uuid,
  p_supplier_id uuid,
  p_message_type text,
  p_body text,
  p_due_at timestamptz default null,
  p_counter_targets jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_supplier public.buyer_rfq_suppliers%rowtype;
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_thread public.buyer_rfq_negotiation_threads%rowtype;
  v_message public.buyer_rfq_negotiation_messages%rowtype;
  v_body text;
  v_target jsonb;
  v_line public.buyer_distinta_lines%rowtype;
  v_basis text;
  v_value numeric;
  v_norm_t numeric;
  v_norm_m numeric;
  v_request_type text;
  v_next_status text;
  v_next_round integer;
  v_target_count integer:=0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if p_message_type not in('message','clarification','revision_request','counter_target','bafo_request') then
    raise exception 'Invalid negotiation message type';
  end if;

  if jsonb_typeof(coalesce(p_counter_targets,'[]'::jsonb))<>'array' then
    raise exception 'Counter targets must be an array';
  end if;

  if jsonb_array_length(coalesce(p_counter_targets,'[]'::jsonb))>200 then
    raise exception 'Too many counter targets';
  end if;

  select * into v_campaign
  from public.buyer_rfq_campaigns r
  where r.id=p_rfq_id
    and r.owner_user_id=v_user_id
  for update;

  if not found then
    raise exception 'RFQ not found or not accessible' using errcode='42501';
  end if;

  if v_campaign.status not in('launched','collecting') then
    raise exception 'RFQ is not open for negotiation';
  end if;

  select * into v_supplier
  from public.buyer_rfq_suppliers s
  where s.id=p_supplier_id
    and s.rfq_id=p_rfq_id
    and s.owner_user_id=v_user_id;

  if not found then
    raise exception 'Supplier not found or not accessible' using errcode='42501';
  end if;

  if v_supplier.status in('declined','cancelled','bounced','complained') then
    raise exception 'Supplier is not available for negotiation';
  end if;

  select * into v_dispatch
  from public.buyer_rfq_dispatches d
  where d.rfq_id=p_rfq_id
    and d.supplier_id=p_supplier_id
    and d.owner_user_id=v_user_id
    and d.status not in('cancelled','failed','bounced','complained')
  order by d.created_at desc
  limit 1;

  if not found then
    raise exception 'Active supplier dispatch not found';
  end if;

  v_body:=left(btrim(coalesce(p_body,'')),4000);
  if v_body='' then
    v_body:=case p_message_type
      when 'clarification' then 'Richiesta di chiarimento.'
      when 'revision_request' then 'Ti chiediamo di inviare una revisione della tua offerta.'
      when 'counter_target' then 'Ti proponiamo i counter target indicati per le righe selezionate.'
      when 'bafo_request' then 'Ti chiediamo la tua Best & Final Offer.'
      else null
    end;
  end if;

  if v_body is null or v_body='' then
    raise exception 'Message body is required';
  end if;

  if p_due_at is not null then
    if p_due_at<=now() then raise exception 'Negotiation deadline must be in the future'; end if;
    if p_due_at>now()+interval '90 days' then raise exception 'Negotiation deadline is too far in the future'; end if;
  end if;

  if p_message_type='bafo_request' and p_due_at is null then
    raise exception 'BAFO deadline is required';
  end if;

  if p_message_type='counter_target' and jsonb_array_length(coalesce(p_counter_targets,'[]'::jsonb))=0 then
    raise exception 'Counter target requires at least one line';
  end if;

  if p_message_type not in('counter_target','bafo_request')
    and jsonb_array_length(coalesce(p_counter_targets,'[]'::jsonb))>0 then
    raise exception 'Counter targets are only allowed for counter-target or BAFO requests';
  end if;

  select * into v_thread
  from public.buyer_rfq_negotiation_threads t
  where t.dispatch_id=v_dispatch.id
  for update;

  if not found then
    insert into public.buyer_rfq_negotiation_threads(
      rfq_id,supplier_id,dispatch_id,owner_user_id,organization_id
    ) values(
      p_rfq_id,p_supplier_id,v_dispatch.id,v_user_id,v_campaign.organization_id
    )
    returning * into v_thread;
  elsif v_thread.status='closed' then
    raise exception 'Negotiation thread is closed';
  end if;

  if (
    select count(*)
    from public.buyer_rfq_negotiation_messages m
    where m.thread_id=v_thread.id
      and m.sender_role='buyer'
      and m.created_at>=now()-interval '24 hours'
  )>=30 then
    raise exception 'Negotiation message daily limit reached';
  end if;

  v_request_type:=case p_message_type
    when 'clarification' then 'clarification'
    when 'revision_request' then 'revision'
    when 'counter_target' then 'counter_target'
    when 'bafo_request' then 'bafo'
    else null
  end;

  v_next_status:=case when p_message_type='bafo_request' then 'bafo_requested' else 'awaiting_supplier' end;
  v_next_round:=v_thread.round_no+case when v_request_type is null then 0 else 1 end;

  insert into public.buyer_rfq_negotiation_messages(
    thread_id,rfq_id,supplier_id,owner_user_id,organization_id,
    sender_role,actor_user_id,message_type,round_no,body,request_due_at,
    notification_status
  ) values(
    v_thread.id,p_rfq_id,p_supplier_id,v_user_id,v_campaign.organization_id,
    'buyer',v_user_id,p_message_type,v_next_round,v_body,p_due_at,'pending'
  )
  returning * into v_message;

  if jsonb_array_length(coalesce(p_counter_targets,'[]'::jsonb))>0 then
    for v_target in select value from jsonb_array_elements(p_counter_targets)
    loop
      select * into v_line
      from public.buyer_distinta_lines l
      where l.id=nullif(v_target->>'line_id','')::uuid
        and l.distinta_id=v_campaign.source_distinta_id;

      if not found then
        raise exception 'Counter target line does not belong to this RFQ';
      end if;

      v_basis:=nullif(v_target->>'basis','');
      v_value:=nullif(v_target->>'value','')::numeric;

      if v_basis not in('eur_t','eur_m') then
        raise exception 'Invalid counter target basis';
      end if;
      if v_value is null or v_value<=0 then
        raise exception 'Counter target must be positive';
      end if;
      if v_line.weight_kg_m<=0 then
        raise exception 'Line weight must be positive';
      end if;

      if v_basis='eur_t' then
        v_norm_t:=v_value;
        v_norm_m:=v_value*v_line.weight_kg_m/1000;
      else
        v_norm_m:=v_value;
        v_norm_t:=v_value*1000/v_line.weight_kg_m;
      end if;

      insert into public.buyer_rfq_negotiation_targets(
        thread_id,message_id,rfq_line_id,target_basis,target_value,
        normalized_eur_t,normalized_eur_m
      ) values(
        v_thread.id,v_message.id,v_line.id,v_basis,v_value,v_norm_t,v_norm_m
      );
      v_target_count:=v_target_count+1;
    end loop;
  end if;

  update public.buyer_rfq_negotiation_threads
  set
    status=v_next_status,
    active_request_type=v_request_type,
    request_due_at=p_due_at,
    active_request_at=case when v_request_type is null then active_request_at else now() end,
    round_no=v_next_round,
    reminder_count=case when v_request_type is null then reminder_count else 0 end,
    last_reminder_at=case when v_request_type is null then last_reminder_at else null end,
    last_message_at=now(),
    last_buyer_message_at=now(),
    updated_at=now()
  where id=v_thread.id
  returning * into v_thread;

  if p_due_at is not null and (v_campaign.due_at is null or p_due_at>v_campaign.due_at) then
    update public.buyer_rfq_campaigns
    set due_at=p_due_at,updated_at=now()
    where id=p_rfq_id;
  end if;

  perform private.rfqh3_log_event(
    p_rfq_id,p_supplier_id,v_user_id,v_campaign.organization_id,
    case p_message_type
      when 'bafo_request' then 'negotiation_bafo_requested'
      when 'counter_target' then 'negotiation_counter_target_sent'
      when 'revision_request' then 'negotiation_revision_requested'
      when 'clarification' then 'negotiation_clarification_requested'
      else 'negotiation_buyer_message'
    end,
    jsonb_build_object(
      'thread_id',v_thread.id,
      'message_id',v_message.id,
      'round_no',v_next_round,
      'due_at',p_due_at,
      'counter_target_count',v_target_count
    ),
    v_user_id
  );

  return jsonb_build_object(
    'thread_id',v_thread.id,
    'message_id',v_message.id,
    'status',v_thread.status,
    'round_no',v_thread.round_no,
    'request_due_at',v_thread.request_due_at
  );
end;
$$;

revoke all on function private.rfqh6_buyer_post_impl(uuid,uuid,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function private.rfqh6_buyer_post_impl(uuid,uuid,text,text,timestamptz,jsonb) to authenticated;

create or replace function public.rfqh6_buyer_post(
  p_rfq_id uuid,
  p_supplier_id uuid,
  p_message_type text,
  p_body text,
  p_due_at timestamptz default null,
  p_counter_targets jsonb default '[]'::jsonb
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.rfqh6_buyer_post_impl(
    p_rfq_id,p_supplier_id,p_message_type,p_body,p_due_at,p_counter_targets
  )
$$;

revoke all on function public.rfqh6_buyer_post(uuid,uuid,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.rfqh6_buyer_post(uuid,uuid,text,text,timestamptz,jsonb) to authenticated;

create or replace function private.rfqh6_prepare_reminder_impl(p_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_thread public.buyer_rfq_negotiation_threads%rowtype;
  v_message public.buyer_rfq_negotiation_messages%rowtype;
  v_body text;
  v_anchor timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into v_thread
  from public.buyer_rfq_negotiation_threads t
  where t.id=p_thread_id
    and t.owner_user_id=v_user_id
  for update;

  if not found then
    raise exception 'Negotiation thread not found or not accessible' using errcode='42501';
  end if;

  if v_thread.status not in('awaiting_supplier','bafo_requested')
    or v_thread.active_request_type is null then
    raise exception 'No supplier action is currently pending';
  end if;

  if v_thread.reminder_count>=2 then
    raise exception 'Negotiation reminder limit reached';
  end if;

  v_anchor:=coalesce(v_thread.last_reminder_at,v_thread.active_request_at,v_thread.last_buyer_message_at,v_thread.created_at);
  if v_anchor>now()-interval '24 hours' then
    raise exception 'Negotiation reminder cooldown not reached';
  end if;

  v_body:=case v_thread.active_request_type
    when 'bafo' then 'Promemoria: attendiamo la tua Best & Final Offer.'
    when 'revision' then 'Promemoria: attendiamo la revisione della tua offerta.'
    when 'counter_target' then 'Promemoria: attendiamo un riscontro sui counter target condivisi.'
    else 'Promemoria: attendiamo un riscontro al chiarimento richiesto.'
  end;

  insert into public.buyer_rfq_negotiation_messages(
    thread_id,rfq_id,supplier_id,owner_user_id,organization_id,
    sender_role,actor_user_id,message_type,round_no,body,request_due_at,
    notification_status
  ) values(
    v_thread.id,v_thread.rfq_id,v_thread.supplier_id,v_thread.owner_user_id,v_thread.organization_id,
    'buyer',v_user_id,'reminder',v_thread.round_no,v_body,v_thread.request_due_at,'pending'
  )
  returning * into v_message;

  update public.buyer_rfq_negotiation_threads
  set reminder_count=reminder_count+1,last_reminder_at=now(),
      last_message_at=now(),last_buyer_message_at=now(),updated_at=now()
  where id=v_thread.id
  returning * into v_thread;

  perform private.rfqh3_log_event(
    v_thread.rfq_id,v_thread.supplier_id,v_thread.owner_user_id,v_thread.organization_id,
    'negotiation_reminder_sent',
    jsonb_build_object(
      'thread_id',v_thread.id,
      'message_id',v_message.id,
      'reminder_count',v_thread.reminder_count,
      'request_type',v_thread.active_request_type
    ),
    v_user_id
  );

  return jsonb_build_object(
    'thread_id',v_thread.id,
    'message_id',v_message.id,
    'rfq_id',v_thread.rfq_id,
    'supplier_id',v_thread.supplier_id,
    'reminder_count',v_thread.reminder_count
  );
end;
$$;

revoke all on function private.rfqh6_prepare_reminder_impl(uuid) from public,anon,authenticated;
grant execute on function private.rfqh6_prepare_reminder_impl(uuid) to authenticated;

create or replace function public.rfqh6_prepare_reminder(p_thread_id uuid)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.rfqh6_prepare_reminder_impl(p_thread_id)
$$;

revoke all on function public.rfqh6_prepare_reminder(uuid) from public,anon,authenticated;
grant execute on function public.rfqh6_prepare_reminder(uuid) to authenticated;

create or replace function private.rfqh6_mark_notification_impl(
  p_message_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_message public.buyer_rfq_negotiation_messages%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if p_status not in('sent','failed','skipped') then
    raise exception 'Invalid notification result';
  end if;

  select * into v_message
  from public.buyer_rfq_negotiation_messages m
  where m.id=p_message_id
    and m.owner_user_id=v_user_id
    and m.sender_role='buyer'
  for update;

  if not found then
    raise exception 'Negotiation message not found or not accessible' using errcode='42501';
  end if;

  update public.buyer_rfq_negotiation_messages
  set notification_status=p_status,
      notification_provider_message_id=case when p_status='sent' then nullif(p_provider_message_id,'') else null end,
      notification_error=case when p_status='failed' then left(coalesce(p_error,'Notification failed'),1000) else null end,
      notified_at=case when p_status in('sent','skipped') then now() else null end
  where id=p_message_id
  returning * into v_message;

  return jsonb_build_object(
    'message_id',v_message.id,
    'notification_status',v_message.notification_status
  );
end;
$$;

revoke all on function private.rfqh6_mark_notification_impl(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.rfqh6_mark_notification_impl(uuid,text,text,text) to authenticated;

create or replace function public.rfqh6_mark_notification(
  p_message_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_error text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.rfqh6_mark_notification_impl(p_message_id,p_status,p_provider_message_id,p_error)
$$;

revoke all on function public.rfqh6_mark_notification(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.rfqh6_mark_notification(uuid,text,text,text) to authenticated;

create or replace function rfqh_secure.rfqh6_supplier_thread_impl(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_thread public.buyer_rfq_negotiation_threads%rowtype;
  v_messages jsonb:='[]'::jsonb;
begin
  select * into v_dispatch
  from public.buyer_rfq_dispatches d
  where d.token_hash=p_token_hash
    and d.status not in('cancelled','failed','bounced','complained')
  limit 1;

  if not found then
    return jsonb_build_object('valid',false);
  end if;

  select * into v_campaign
  from public.buyer_rfq_campaigns r
  where r.id=v_dispatch.rfq_id;

  if not found then
    return jsonb_build_object('valid',false);
  end if;

  select * into v_thread
  from public.buyer_rfq_negotiation_threads t
  where t.dispatch_id=v_dispatch.id
  limit 1;

  if v_thread.id is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',m.id,
          'sender_role',m.sender_role,
          'message_type',m.message_type,
          'round_no',m.round_no,
          'body',m.body,
          'request_due_at',m.request_due_at,
          'created_at',m.created_at,
          'counter_targets',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'line_id',nt.rfq_line_id,
                'position',l.line_position,
                'description',l.description,
                'basis',nt.target_basis,
                'value',nt.target_value,
                'eur_t',nt.normalized_eur_t,
                'eur_m',nt.normalized_eur_m
              )
              order by l.line_position
            )
            from public.buyer_rfq_negotiation_targets nt
            join public.buyer_distinta_lines l on l.id=nt.rfq_line_id
            where nt.message_id=m.id
          ),'[]'::jsonb)
        )
        order by m.created_at,m.id
      ),
      '[]'::jsonb
    )
    into v_messages
    from public.buyer_rfq_negotiation_messages m
    where m.thread_id=v_thread.id;
  end if;

  return jsonb_build_object(
    'valid',true,
    'exists',v_thread.id is not null,
    'thread_id',v_thread.id,
    'status',coalesce(v_thread.status,'open'),
    'active_request_type',v_thread.active_request_type,
    'request_due_at',v_thread.request_due_at,
    'round_no',coalesce(v_thread.round_no,0),
    'reminder_count',coalesce(v_thread.reminder_count,0),
    'can_message',(
      v_campaign.status in('launched','collecting')
      and v_dispatch.status not in('cancelled','failed','bounced','complained','declined')
      and coalesce(v_thread.status,'open')<>'closed'
    ),
    'messages',v_messages
  );
end;
$$;

revoke all on function rfqh_secure.rfqh6_supplier_thread_impl(text) from public;
grant execute on function rfqh_secure.rfqh6_supplier_thread_impl(text) to anon,authenticated;

create or replace function public.rfqh6_supplier_thread(p_token_hash text)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select rfqh_secure.rfqh6_supplier_thread_impl(p_token_hash)
$$;

revoke all on function public.rfqh6_supplier_thread(text) from public,anon,authenticated;
grant execute on function public.rfqh6_supplier_thread(text) to anon,authenticated;

create or replace function rfqh_secure.rfqh6_supplier_post_impl(
  p_token_hash text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_thread public.buyer_rfq_negotiation_threads%rowtype;
  v_message public.buyer_rfq_negotiation_messages%rowtype;
  v_body text;
  v_next_status text;
begin
  v_body:=left(btrim(coalesce(p_body,'')),4000);
  if v_body='' then
    raise exception 'Message body is required';
  end if;

  select * into v_dispatch
  from public.buyer_rfq_dispatches d
  where d.token_hash=p_token_hash
    and d.status not in('cancelled','failed','bounced','complained','declined')
  limit 1;

  if not found then
    raise exception 'RFQ invite is not available' using errcode='42501';
  end if;

  select * into v_campaign
  from public.buyer_rfq_campaigns r
  where r.id=v_dispatch.rfq_id
  for update;

  if not found or v_campaign.status not in('launched','collecting') then
    raise exception 'RFQ is not open for negotiation';
  end if;

  select * into v_thread
  from public.buyer_rfq_negotiation_threads t
  where t.dispatch_id=v_dispatch.id
  for update;

  if not found then
    insert into public.buyer_rfq_negotiation_threads(
      rfq_id,supplier_id,dispatch_id,owner_user_id,organization_id,
      status,last_message_at,last_supplier_message_at
    ) values(
      v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.id,
      v_dispatch.owner_user_id,v_dispatch.organization_id,
      'awaiting_buyer',now(),now()
    )
    returning * into v_thread;
  elsif v_thread.status='closed' then
    raise exception 'Negotiation thread is closed';
  end if;

  if (
    select count(*)
    from public.buyer_rfq_negotiation_messages m
    where m.thread_id=v_thread.id
      and m.sender_role='supplier'
      and m.created_at>=now()-interval '1 hour'
  )>=10 then
    raise exception 'Negotiation message hourly limit reached';
  end if;

  v_next_status:=case
    when v_thread.active_request_type='bafo' then 'bafo_requested'
    when v_thread.active_request_type in('revision','counter_target') then 'awaiting_supplier'
    else 'awaiting_buyer'
  end;

  insert into public.buyer_rfq_negotiation_messages(
    thread_id,rfq_id,supplier_id,owner_user_id,organization_id,
    sender_role,message_type,round_no,body,request_due_at,notification_status
  ) values(
    v_thread.id,v_thread.rfq_id,v_thread.supplier_id,v_thread.owner_user_id,v_thread.organization_id,
    'supplier','message',v_thread.round_no,v_body,v_thread.request_due_at,'not_required'
  )
  returning * into v_message;

  update public.buyer_rfq_negotiation_threads
  set status=v_next_status,last_message_at=now(),last_supplier_message_at=now(),updated_at=now()
  where id=v_thread.id
  returning * into v_thread;

  perform private.rfqh3_log_event(
    v_thread.rfq_id,v_thread.supplier_id,v_thread.owner_user_id,v_thread.organization_id,
    'negotiation_supplier_message',
    jsonb_build_object(
      'thread_id',v_thread.id,
      'message_id',v_message.id,
      'round_no',v_thread.round_no
    ),
    null
  );

  return jsonb_build_object(
    'thread_id',v_thread.id,
    'message_id',v_message.id,
    'status',v_thread.status
  );
end;
$$;

revoke all on function rfqh_secure.rfqh6_supplier_post_impl(text,text) from public;
grant execute on function rfqh_secure.rfqh6_supplier_post_impl(text,text) to anon,authenticated;

create or replace function public.rfqh6_supplier_post(
  p_token_hash text,
  p_body text
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select rfqh_secure.rfqh6_supplier_post_impl(p_token_hash,p_body)
$$;

revoke all on function public.rfqh6_supplier_post(text,text) from public,anon,authenticated;
grant execute on function public.rfqh6_supplier_post(text,text) to anon,authenticated;

create or replace function private.rfqh6_quote_submission_sync()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_thread public.buyer_rfq_negotiation_threads%rowtype;
  v_status text;
  v_body text;
begin
  if new.status<>'submitted' or old.status='submitted' then
    return new;
  end if;

  select * into v_thread
  from public.buyer_rfq_negotiation_threads t
  where t.dispatch_id=new.dispatch_id
    and t.status<>'closed'
  for update;

  if not found or v_thread.active_request_type is null then
    return new;
  end if;

  v_status:=case when v_thread.active_request_type='bafo' then 'bafo_received' else 'awaiting_buyer' end;
  v_body:=case when v_thread.active_request_type='bafo'
    then 'Best & Final Offer ricevuta · revisione '||new.revision_no::text||'.'
    else 'Revisione offerta ricevuta · revisione '||new.revision_no::text||'.'
  end;

  insert into public.buyer_rfq_negotiation_messages(
    thread_id,rfq_id,supplier_id,owner_user_id,organization_id,
    sender_role,message_type,round_no,body,notification_status
  ) values(
    v_thread.id,v_thread.rfq_id,v_thread.supplier_id,v_thread.owner_user_id,v_thread.organization_id,
    'system','system',v_thread.round_no,v_body,'not_required'
  );

  update public.buyer_rfq_negotiation_threads
  set status=v_status,active_request_type=null,request_due_at=null,active_request_at=null,
      reminder_count=0,last_reminder_at=null,last_message_at=now(),
      last_supplier_message_at=now(),updated_at=now()
  where id=v_thread.id;

  perform private.rfqh3_log_event(
    v_thread.rfq_id,v_thread.supplier_id,v_thread.owner_user_id,v_thread.organization_id,
    case when v_status='bafo_received' then 'negotiation_bafo_received' else 'negotiation_revision_received' end,
    jsonb_build_object('thread_id',v_thread.id,'quote_id',new.id,'revision_no',new.revision_no),
    null
  );

  return new;
end;
$$;

drop trigger if exists rfqh6_quote_submission_sync on public.buyer_rfq_quotes;
create trigger rfqh6_quote_submission_sync
after update of status on public.buyer_rfq_quotes
for each row
when (new.status='submitted' and old.status is distinct from new.status)
execute function private.rfqh6_quote_submission_sync();

notify pgrst,'reload schema';
