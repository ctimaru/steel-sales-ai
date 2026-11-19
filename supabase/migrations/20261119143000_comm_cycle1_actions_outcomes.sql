-- COMM-CYCLE1 (founder decisions, 19 Nov 2026): actions and outcomes of the
-- commercial cycle. Until now requests, offers and orders were read-only in
-- the app and no deal could be closed as «non conclusa».
--
-- 1. public.comm_deal_events — append-only log of every action, with the
--    closing reason and the exact status changes (so «Riapri» restores them).
-- 2. public.comm_cycle1_apply(...) — the only write path. SECURITY DEFINER with
--    explicit checks: active member with write role, record of the same
--    organization, office profile (Ufficio commerciale for sales, Ufficio
--    acquisti for supplier RFQs, Direzione always — private.office_write_denied),
--    and an allowed transition. Nothing else changes.
--
-- Closing reasons (decided 19 Nov 2026): price, lead_time,
-- material_unavailable, no_response, offer_expired, cancelled_by_customer,
-- awarded_elsewhere, other (note required).
--
-- The priority index (public.comm_deals2_index) is replaced in
-- 20261119143100_comm_cycle1_index.sql: a sent offer past valid_until is «todo».

create table if not exists public.comm_deal_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_kind text not null check (deal_kind in ('inbound-rfq', 'inbound-offer', 'inbound-order', 'campaign')),
  deal_id uuid not null,
  record_kind text not null check (record_kind in ('rfq', 'offer', 'order', 'campaign')),
  record_id uuid not null,
  action text not null check (action in (
    'take_charge', 'offer_sent', 'offer_accepted', 'order_registered', 'order_confirmed',
    'order_status', 'close_lost', 'reopen'
  )),
  reason text check (reason is null or reason in (
    'price', 'lead_time', 'material_unavailable', 'no_response', 'offer_expired',
    'cancelled_by_customer', 'awarded_elsewhere', 'other'
  )),
  note text check (note is null or char_length(note) <= 500),
  -- [{record_kind, record_id, from, to}] — every status this action changed.
  changes jsonb not null default '[]'::jsonb check (jsonb_typeof(changes) = 'array'),
  actor_user_id uuid not null,
  -- clock_timestamp: two actions in one transaction still have a stable order.
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists comm_deal_events_deal_idx
  on public.comm_deal_events (organization_id, deal_kind, deal_id, created_at desc);

alter table public.comm_deal_events enable row level security;

drop policy if exists comm_deal_events_member_select on public.comm_deal_events;
create policy comm_deal_events_member_select on public.comm_deal_events
  for select to authenticated
  using (public.is_organization_member(organization_id, false));

revoke all on public.comm_deal_events from public, anon;
revoke insert, update, delete on public.comm_deal_events from authenticated;
grant select on public.comm_deal_events to authenticated;
grant all on public.comm_deal_events to service_role;

comment on table public.comm_deal_events is
  'COMM-CYCLE1: append-only log of commercial deal actions (who, when, reason, exact status changes). Written only by public.comm_cycle1_apply.';

create or replace function public.comm_cycle1_apply(
  p_organization_id uuid,
  p_record_kind text,
  p_record_id uuid,
  p_action text,
  p_to_status text default null,
  p_reason text default null,
  p_note text default null,
  p_customer_order_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
  v_ref text := nullif(left(btrim(coalesce(p_customer_order_ref, '')), 80), '');
  v_area text := case when p_record_kind = 'campaign' then 'purchasing' else 'commercial' end;
  v_deal_kind text;
  v_deal_id uuid;
  v_changes jsonb := '[]'::jsonb;
  v_rfq public.rfqs%rowtype;
  v_offer public.offers%rowtype;
  v_order public.orders%rowtype;
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_last public.comm_deal_events%rowtype;
  v_new_order uuid;
  v_change jsonb;
  v_row record;
  v_order_steps constant text[] := array['received', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered'];
begin
  if v_uid is null then
    raise exception 'comm_cycle1: autenticazione richiesta' using errcode = '42501';
  end if;
  if p_organization_id is null or not public.is_organization_member(p_organization_id, true) then
    raise exception 'comm_cycle1: non autorizzato' using errcode = '42501';
  end if;
  if p_record_kind not in ('rfq', 'offer', 'order', 'campaign') or p_record_id is null then
    raise exception 'comm_cycle1: documento non valido' using errcode = '22023';
  end if;
  if private.office_write_denied(p_organization_id, v_area) then
    raise exception 'office_profile_read_only: serve il profilo %',
      case v_area when 'purchasing' then 'Ufficio acquisti' else 'Ufficio commerciale' end
      using errcode = '42501';
  end if;
  if p_action = 'close_lost' then
    if p_reason is null then
      raise exception 'comm_cycle1: indica il motivo' using errcode = '22023';
    end if;
    if p_reason = 'other' and v_note is null then
      raise exception 'comm_cycle1: con «Altro» serve una nota' using errcode = '22023';
    end if;
  elsif p_reason is not null then
    raise exception 'comm_cycle1: il motivo vale solo per la chiusura' using errcode = '22023';
  end if;

  -- ── Load and lock the record, resolve the deal it belongs to ─────────────
  if p_record_kind = 'rfq' then
    select * into v_rfq from public.rfqs
      where id = p_record_id and organization_id = p_organization_id for update;
    if not found then raise exception 'comm_cycle1: richiesta non trovata' using errcode = 'P0002'; end if;
    v_deal_kind := 'inbound-rfq'; v_deal_id := v_rfq.id;
  elsif p_record_kind = 'offer' then
    select * into v_offer from public.offers
      where id = p_record_id and organization_id = p_organization_id for update;
    if not found then raise exception 'comm_cycle1: offerta non trovata' using errcode = 'P0002'; end if;
    if v_offer.rfq_id is not null then v_deal_kind := 'inbound-rfq'; v_deal_id := v_offer.rfq_id;
    else v_deal_kind := 'inbound-offer'; v_deal_id := v_offer.id; end if;
  elsif p_record_kind = 'order' then
    select * into v_order from public.orders
      where id = p_record_id and organization_id = p_organization_id for update;
    if not found then raise exception 'comm_cycle1: ordine non trovato' using errcode = 'P0002'; end if;
    if v_order.rfq_id is not null then
      v_deal_kind := 'inbound-rfq'; v_deal_id := v_order.rfq_id;
    elsif v_order.offer_id is not null then
      select case when f.rfq_id is not null then 'inbound-rfq' else 'inbound-offer' end, coalesce(f.rfq_id, f.id)
        into v_deal_kind, v_deal_id
        from public.offers f where f.id = v_order.offer_id and f.organization_id = p_organization_id;
      if v_deal_id is null then v_deal_kind := 'inbound-order'; v_deal_id := v_order.id; end if;
    else
      v_deal_kind := 'inbound-order'; v_deal_id := v_order.id;
    end if;
  else
    select * into v_campaign from public.buyer_rfq_campaigns
      where id = p_record_id and organization_id = p_organization_id for update;
    if not found then raise exception 'comm_cycle1: RFQ non trovata' using errcode = 'P0002'; end if;
    v_deal_kind := 'campaign'; v_deal_id := v_campaign.id;
  end if;

  -- ── Transitions ──────────────────────────────────────────────────────────
  if p_action = 'take_charge' then
    if p_record_kind <> 'rfq' or v_rfq.status not in ('new', 'review_needed', 'qualified') then
      raise exception 'comm_cycle1: la richiesta è già in lavorazione o chiusa' using errcode = '22023';
    end if;
    update public.rfqs set status = 'in_progress', assigned_to_user_id = coalesce(assigned_to_user_id, v_uid)
      where id = v_rfq.id;
    v_changes := jsonb_build_array(jsonb_build_object('record_kind', 'rfq', 'record_id', v_rfq.id, 'from', v_rfq.status, 'to', 'in_progress'));

  elsif p_action = 'offer_sent' then
    if p_record_kind <> 'offer' or v_offer.status <> 'draft' then
      raise exception 'comm_cycle1: solo una bozza d''offerta si segna come inviata' using errcode = '22023';
    end if;
    update public.offers set status = 'sent', offered_at = coalesce(offered_at, now()) where id = v_offer.id;
    v_changes := jsonb_build_array(jsonb_build_object('record_kind', 'offer', 'record_id', v_offer.id, 'from', 'draft', 'to', 'sent'));
    for v_row in select id, status from public.rfqs
      where id = v_offer.rfq_id and organization_id = p_organization_id
        and status in ('new', 'review_needed', 'qualified', 'in_progress') for update loop
      update public.rfqs set status = 'quoted' where id = v_row.id;
      v_changes := v_changes || jsonb_build_object('record_kind', 'rfq', 'record_id', v_row.id, 'from', v_row.status, 'to', 'quoted');
    end loop;

  elsif p_action = 'offer_accepted' then
    if p_record_kind <> 'offer' or v_offer.status not in ('sent', 'expired') then
      raise exception 'comm_cycle1: solo un''offerta inviata può essere accettata' using errcode = '22023';
    end if;
    update public.offers set status = 'accepted' where id = v_offer.id;
    v_changes := jsonb_build_array(jsonb_build_object('record_kind', 'offer', 'record_id', v_offer.id, 'from', v_offer.status, 'to', 'accepted'));

  elsif p_action = 'order_registered' then
    if p_record_kind <> 'offer' or v_offer.status <> 'accepted' then
      raise exception 'comm_cycle1: l''ordine si registra da un''offerta accettata' using errcode = '22023';
    end if;
    if exists (select 1 from public.orders o where o.offer_id = v_offer.id and o.organization_id = p_organization_id and o.status <> 'cancelled') then
      raise exception 'comm_cycle1: questa offerta ha già un ordine' using errcode = '23505';
    end if;
    insert into public.orders (organization_id, owner_id, conversation_id, company_id, ordered_at, customer_order_ref,
      status, rfq_id, offer_id, created_by_user_id, assigned_to_user_id, deal_label)
    values (p_organization_id, v_uid, v_offer.conversation_id, v_offer.company_id, now(), v_ref,
      'received', v_offer.rfq_id, v_offer.id, v_uid, v_offer.assigned_to_user_id, v_offer.deal_label)
    returning id into v_new_order;
    insert into public.order_lines (organization_id, owner_id, order_id, product_id, quantity, quantity_unit,
      unit_price, price_unit, offer_line_id, canonical_product_id, canonical_product_key, raw_spec_text)
    select p_organization_id, v_uid, v_new_order, l.product_id, l.quantity, l.quantity_unit,
      l.price_value, l.price_unit, l.id, l.canonical_product_id, l.canonical_product_key, l.raw_spec_text
    from public.offer_lines l
    where l.offer_id = v_offer.id and l.organization_id = p_organization_id;
    v_changes := jsonb_build_array(jsonb_build_object('record_kind', 'order', 'record_id', v_new_order, 'from', null, 'to', 'received'));

  elsif p_action = 'order_confirmed' then
    if p_record_kind <> 'order' or v_order.status <> 'received' then
      raise exception 'comm_cycle1: solo un ordine ricevuto si conferma' using errcode = '22023';
    end if;
    update public.orders set status = 'confirmed' where id = v_order.id;
    v_changes := jsonb_build_array(jsonb_build_object('record_kind', 'order', 'record_id', v_order.id, 'from', 'received', 'to', 'confirmed'));

  elsif p_action = 'order_status' then
    if p_record_kind <> 'order' or p_to_status is null
      or array_position(v_order_steps, p_to_status) is null
      or array_position(v_order_steps, v_order.status) is null
      or array_position(v_order_steps, p_to_status) <= array_position(v_order_steps, v_order.status)
      or v_order.status = 'received' then
      raise exception 'comm_cycle1: avanzamento dell''ordine non valido' using errcode = '22023';
    end if;
    update public.orders set status = p_to_status where id = v_order.id;
    v_changes := jsonb_build_array(jsonb_build_object('record_kind', 'order', 'record_id', v_order.id, 'from', v_order.status, 'to', p_to_status));
    if p_to_status = 'delivered' then
      for v_row in select id, status from public.rfqs
        where id = v_order.rfq_id and organization_id = p_organization_id
          and status not in ('closed_won', 'closed_lost', 'cancelled') for update loop
        update public.rfqs set status = 'closed_won' where id = v_row.id;
        v_changes := v_changes || jsonb_build_object('record_kind', 'rfq', 'record_id', v_row.id, 'from', v_row.status, 'to', 'closed_won');
      end loop;
    end if;

  elsif p_action = 'close_lost' then
    -- The whole deal closes: anchor + open offers + orders still only «received».
    -- An order already confirmed or in progress cannot be closed as lost.
    if v_deal_kind = 'campaign' then
      if v_campaign.status not in ('draft', 'ready', 'launched', 'collecting') then
        raise exception 'comm_cycle1: una RFQ aggiudicata o già chiusa non si chiude come non conclusa' using errcode = '22023';
      end if;
      update public.buyer_rfq_campaigns set status = 'closed', closed_at = now(), updated_at = now() where id = v_campaign.id;
      v_changes := jsonb_build_array(jsonb_build_object('record_kind', 'campaign', 'record_id', v_campaign.id, 'from', v_campaign.status, 'to', 'closed'));
    else
      if exists (
        select 1 from public.orders o
        where o.organization_id = p_organization_id and o.status not in ('received', 'cancelled')
          and ((v_deal_kind = 'inbound-rfq' and o.rfq_id = v_deal_id)
            or (v_deal_kind = 'inbound-offer' and o.offer_id = v_deal_id)
            or (v_deal_kind = 'inbound-order' and o.id = v_deal_id))
      ) then
        raise exception 'comm_cycle1: c''è un ordine confermato o in corso: non si chiude come non conclusa' using errcode = '22023';
      end if;
      for v_row in select id, status from public.rfqs
        where v_deal_kind = 'inbound-rfq' and id = v_deal_id and organization_id = p_organization_id
          and status not in ('closed_won', 'closed_lost', 'cancelled') for update loop
        update public.rfqs set status = 'closed_lost' where id = v_row.id;
        v_changes := v_changes || jsonb_build_object('record_kind', 'rfq', 'record_id', v_row.id, 'from', v_row.status, 'to', 'closed_lost');
      end loop;
      for v_row in select id, status from public.offers
        where organization_id = p_organization_id and status in ('draft', 'sent', 'expired', 'accepted')
          and ((v_deal_kind = 'inbound-rfq' and rfq_id = v_deal_id) or (v_deal_kind = 'inbound-offer' and id = v_deal_id))
        for update loop
        update public.offers set status = 'rejected' where id = v_row.id;
        v_changes := v_changes || jsonb_build_object('record_kind', 'offer', 'record_id', v_row.id, 'from', v_row.status, 'to', 'rejected');
      end loop;
      for v_row in select id, status from public.orders
        where organization_id = p_organization_id and status = 'received'
          and ((v_deal_kind = 'inbound-rfq' and rfq_id = v_deal_id)
            or (v_deal_kind = 'inbound-offer' and offer_id = v_deal_id)
            or (v_deal_kind = 'inbound-order' and id = v_deal_id))
        for update loop
        update public.orders set status = 'cancelled' where id = v_row.id;
        v_changes := v_changes || jsonb_build_object('record_kind', 'order', 'record_id', v_row.id, 'from', v_row.status, 'to', 'cancelled');
      end loop;
      if jsonb_array_length(v_changes) = 0 then
        raise exception 'comm_cycle1: niente da chiudere' using errcode = '22023';
      end if;
    end if;

  elsif p_action = 'reopen' then
    -- Only the latest closing of this deal is undone, and only records still in the
    -- status the closing left them in (nothing changed by hand since).
    select * into v_last from public.comm_deal_events e
      where e.organization_id = p_organization_id and e.deal_kind = v_deal_kind and e.deal_id = v_deal_id
        and e.action in ('close_lost', 'reopen')
      order by e.created_at desc, e.id desc limit 1;
    if not found or v_last.action <> 'close_lost' then
      raise exception 'comm_cycle1: questa trattativa non è chiusa come non conclusa' using errcode = '22023';
    end if;
    for v_change in select value from jsonb_array_elements(v_last.changes) loop
      if v_change->>'record_kind' = 'rfq' then
        update public.rfqs set status = v_change->>'from'
          where id = (v_change->>'record_id')::uuid and organization_id = p_organization_id and status = v_change->>'to';
      elsif v_change->>'record_kind' = 'offer' then
        update public.offers set status = v_change->>'from'
          where id = (v_change->>'record_id')::uuid and organization_id = p_organization_id and status = v_change->>'to';
      elsif v_change->>'record_kind' = 'order' then
        update public.orders set status = v_change->>'from'
          where id = (v_change->>'record_id')::uuid and organization_id = p_organization_id and status = v_change->>'to';
      elsif v_change->>'record_kind' = 'campaign' then
        update public.buyer_rfq_campaigns set status = v_change->>'from', closed_at = null, updated_at = now()
          where id = (v_change->>'record_id')::uuid and organization_id = p_organization_id and status = v_change->>'to';
      end if;
      if found then
        v_changes := v_changes || jsonb_build_object('record_kind', v_change->>'record_kind', 'record_id', v_change->>'record_id',
          'from', v_change->>'to', 'to', v_change->>'from');
      end if;
    end loop;
  else
    raise exception 'comm_cycle1: azione non valida' using errcode = '22023';
  end if;

  insert into public.comm_deal_events (organization_id, deal_kind, deal_id, record_kind, record_id, action,
    reason, note, changes, actor_user_id)
  values (p_organization_id, v_deal_kind, v_deal_id, p_record_kind, p_record_id, p_action,
    case when p_action = 'close_lost' then p_reason end, v_note, v_changes, v_uid);

  return jsonb_build_object('ok', true, 'deal_kind', v_deal_kind, 'deal_id', v_deal_id, 'changes', v_changes,
    'order_id', v_new_order);
end;
$$;

comment on function public.comm_cycle1_apply(uuid, text, uuid, text, text, text, text, text) is
  'COMM-CYCLE1: the only write path for commercial deal actions (take charge, offer sent/accepted, order registered/confirmed/advanced, close as lost with reason, reopen). Checks membership, office profile and allowed transitions; logs every change in comm_deal_events.';

revoke all on function public.comm_cycle1_apply(uuid, text, uuid, text, text, text, text, text) from public, anon;
grant execute on function public.comm_cycle1_apply(uuid, text, uuid, text, text, text, text, text) to authenticated, service_role;
