-- COMM-CYCLE2.A — customer offer revisions, prepared from the inbound RFQ.
-- No production application without explicit founder authorization.
-- A revision is a separate offer row: the preceding sent revision is never overwritten.
-- Existing offer_lines.rfq_line_id (same-org FK) is deliberately reused.

alter table public.offers
  add column if not exists revision_no integer,
  add column if not exists previous_offer_id uuid,
  add column if not exists revision_managed boolean not null default false;

-- Non-destructive deterministic numbering for existing (including imported) offers.
-- No imported status, price, owner, order or link is changed.
with ordered as (
  select id, row_number() over (
    partition by organization_id, rfq_id
    order by created_at, id
  )::integer as numbered
  from public.offers where rfq_id is not null
)
update public.offers o set revision_no = v.numbered
from ordered v where o.id = v.id and o.revision_no is null;

update public.offers set revision_no = 1
where revision_no is null;
alter table public.offers alter column revision_no set not null;
alter table public.offers alter column revision_no set default 1;
alter table public.offers
  add constraint comm_cycle2a_offer_revision_positive check (revision_no >= 1);
alter table public.offers
  add constraint comm_cycle2a_previous_offer_same_org
  foreign key (organization_id, previous_offer_id)
  references public.offers (organization_id, id);
alter table public.offers
  add constraint comm_cycle2a_previous_not_self
  check (previous_offer_id is null or previous_offer_id <> id);

-- Same request + revision cannot be created twice, including under concurrency.
create unique index if not exists comm_cycle2a_offer_revision_uq
  on public.offers (organization_id, rfq_id, revision_no)
  where rfq_id is not null;
create index if not exists comm_cycle2a_offer_previous_idx
  on public.offers (organization_id, previous_offer_id)
  where previous_offer_id is not null;

comment on column public.offers.revision_no is
  'COMM-CYCLE2.A: chronological revision number within an inbound RFQ; legacy imports numbered deterministically.';
comment on column public.offers.previous_offer_id is
  'COMM-CYCLE2.A: predecessor offer for immutable customer-facing revisions (same organization).';
comment on column public.offers.revision_managed is
  'COMM-CYCLE2.A: true for offers prepared by the guarded cycle RPC. Sent version contents cannot change.';

-- Preserve the existing action audit model and exact changes array.
alter table public.comm_deal_events
  drop constraint if exists comm_deal_events_action_check;
alter table public.comm_deal_events
  add constraint comm_deal_events_action_check check (action in (
    'take_charge', 'offer_sent', 'offer_accepted', 'order_registered',
    'order_confirmed', 'order_status', 'close_lost', 'reopen',
    'offer_prepared', 'offer_revised'
  ));

-- SECURITY INVOKER trigger executes as authenticated for direct browser DML,
-- but as postgres while the reviewed SECURITY DEFINER workflow holds its locks.
-- Only the guarded workflow can initiate a managed revision. Existing imports
-- remain untouched (revision_managed=false). Lifecycle states must still pass
-- through comm_cycle1_apply, whose events are written atomically.
create or replace function private.comm_cycle2a_offer_guard()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.revision_managed and current_user <> 'postgres' then
      raise exception 'comm_cycle2a: usa Prepara offerta' using errcode = '42501';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.revision_managed then
      raise exception 'comm_cycle2a: una revisione non si elimina' using errcode = '42501';
    end if;
    return old;
  end if;

  if old.revision_managed is distinct from new.revision_managed then
    raise exception 'comm_cycle2a: origine della revisione immutabile' using errcode = '42501';
  end if;
  if old.revision_managed then
    if not public.is_organization_member(old.organization_id,true)
      or private.office_write_denied(old.organization_id,'commercial') then
      raise exception 'office_profile_read_only: serve il profilo Ufficio commerciale'
        using errcode = '42501';
    end if;
    if new.revision_no is distinct from old.revision_no
      or new.previous_offer_id is distinct from old.previous_offer_id
      or new.organization_id is distinct from old.organization_id
      or new.rfq_id is distinct from old.rfq_id then
      raise exception 'comm_cycle2a: legame e numero revisione immutabili' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and current_user <> 'postgres' then
      raise exception 'comm_cycle2a: stato modificabile solo dal ciclo' using errcode = '42501';
    end if;
    if old.status is distinct from 'draft'
      and (to_jsonb(new) - 'status')
        is distinct from (to_jsonb(old) - 'status') then
      raise exception 'comm_cycle2a: contenuto di revisione inviata immutabile' using errcode = '42501';
    end if;
  end if;
  -- Also protects a legacy imported predecessor when a new managed revision
  -- exists: it cannot be accepted after the customer received a newer version.
  if new.status = 'accepted' and old.status is distinct from 'accepted'
    and new.rfq_id is not null and exists (
      select 1 from public.offers newer
      where newer.organization_id = new.organization_id
        and newer.rfq_id = new.rfq_id and newer.revision_no > new.revision_no
    ) then
    raise exception 'comm_cycle2a: solo l''ultima revisione può essere accettata' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists comm_cycle2a_offer_guard on public.offers;
create trigger comm_cycle2a_offer_guard
before insert or update or delete on public.offers
for each row execute function private.comm_cycle2a_offer_guard();

-- Protect every line once its managed offer has been sent; never silently
-- attach a request line belonging to a different RFQ in the same company.
create or replace function private.comm_cycle2a_offer_line_guard()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  v_offer public.offers%rowtype;
  v_rfq_line_rfq uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select * into v_offer from public.offers
      where id = old.offer_id and organization_id = old.organization_id;
    if found and v_offer.revision_managed then
      if v_offer.status <> 'draft' then
        raise exception 'comm_cycle2a: righe di revisione inviata immutabili'
          using errcode = '42501';
      end if;
      if not public.is_organization_member(v_offer.organization_id,true)
        or private.office_write_denied(v_offer.organization_id,'commercial') then
        raise exception 'office_profile_read_only: serve il profilo Ufficio commerciale'
          using errcode = '42501';
      end if;
    end if;
    if tg_op = 'DELETE' then return old; end if;
  end if;

  select * into v_offer from public.offers
    where id = new.offer_id and organization_id = new.organization_id;
  if found and v_offer.revision_managed then
    if not public.is_organization_member(v_offer.organization_id,true)
      or private.office_write_denied(v_offer.organization_id,'commercial') then
      raise exception 'office_profile_read_only: serve il profilo Ufficio commerciale'
        using errcode = '42501';
    end if;
    if v_offer.status <> 'draft' then
      raise exception 'comm_cycle2a: righe di revisione inviata immutabili'
        using errcode = '42501';
    end if;
    if new.rfq_line_id is not null then
      select rfq_id into v_rfq_line_rfq from public.rfq_lines
        where id = new.rfq_line_id and organization_id = new.organization_id;
      if v_rfq_line_rfq is distinct from v_offer.rfq_id then
        raise exception 'comm_cycle2a: riga non appartenente alla richiesta'
          using errcode = '23503';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists comm_cycle2a_offer_line_guard on public.offer_lines;
create trigger comm_cycle2a_offer_line_guard
before insert or update or delete on public.offer_lines
for each row execute function private.comm_cycle2a_offer_line_guard();

-- Single transactional entry point for both new drafts and subsequent revisions.
-- Repeated clicks return the existing draft; a new revision requires that the
-- preceding version was sent/expired. Lock the RFQ to serialize all contenders.
create or replace function public.comm_cycle2a_prepare_offer(
  p_organization_id uuid,
  p_rfq_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rfq public.rfqs%rowtype;
  v_prev public.offers%rowtype;
  v_id uuid;
  v_revision integer;
  v_count integer;
  v_action text;
begin
  if v_uid is null or p_organization_id is null
    or not public.is_organization_member(p_organization_id, true) then
    raise exception 'comm_cycle2a: non autorizzato' using errcode = '42501';
  end if;
  if private.office_write_denied(p_organization_id, 'commercial') then
    raise exception 'office_profile_read_only: serve il profilo Ufficio commerciale'
      using errcode = '42501';
  end if;
  if p_rfq_id is null then
    raise exception 'comm_cycle2a: richiesta obbligatoria' using errcode = '22023';
  end if;

  select * into v_rfq from public.rfqs
    where organization_id = p_organization_id and id = p_rfq_id
    for update;
  if not found then
    raise exception 'comm_cycle2a: richiesta non trovata' using errcode = 'P0002';
  end if;
  if v_rfq.status in ('closed_won','closed_lost','cancelled') then
    raise exception 'comm_cycle2a: riapri prima la richiesta' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.orders o
    where o.organization_id = p_organization_id and o.rfq_id = p_rfq_id
      and o.status <> 'cancelled'
  ) then
    raise exception 'comm_cycle2a: esiste già un ordine cliente' using errcode = '22023';
  end if;

  select * into v_prev from public.offers
    where organization_id = p_organization_id and rfq_id = p_rfq_id
    order by revision_no desc, created_at desc, id desc limit 1 for update;
  if found and v_prev.status = 'draft' then
    return jsonb_build_object('offer_id',v_prev.id,
      'revision_no',v_prev.revision_no,'created',false,
      'line_count',(select count(*) from public.offer_lines
        where organization_id = p_organization_id and offer_id = v_prev.id));
  end if;
  if found and v_prev.status not in ('sent','expired') then
    raise exception 'comm_cycle2a: la revisione precedente non è negoziabile'
      using errcode = '22023';
  end if;

  v_revision := case when v_prev.id is null then 1 else v_prev.revision_no+1 end;
  v_action := case when v_prev.id is null then 'offer_prepared' else 'offer_revised' end;

  insert into public.offers (
    organization_id,owner_id,created_by_user_id,assigned_to_user_id,
    rfq_id,conversation_id,company_id,deal_label,status,currency,
    delivery_term,payment_terms,valid_until,notes,
    revision_no,previous_offer_id,revision_managed
  ) values (
    p_organization_id,v_uid,v_uid,coalesce(v_rfq.assigned_to_user_id,v_uid),
    v_rfq.id,v_rfq.conversation_id,v_rfq.company_id,v_rfq.deal_label,
    'draft',coalesce(v_prev.currency,'EUR'),
    v_prev.delivery_term,v_prev.payment_terms,v_prev.valid_until,v_prev.notes,
    v_revision,v_prev.id,true
  ) returning id into v_id;

  if v_prev.id is null then
    -- First draft: copy the requested industrial specifications, never internal
    -- buying prices or target costs. No invented weight, €/t or €/m.
    insert into public.offer_lines (
      organization_id,owner_id,offer_id,rfq_line_id,product_id,
      quantity,quantity_unit,canonical_product_id,canonical_product_key,
      raw_spec_text
    )
    select p_organization_id,v_uid,v_id,l.id,l.product_id,
      l.requested_quantity,l.quantity_unit,l.canonical_product_id,l.canonical_product_key,
      coalesce(nullif(btrim(l.raw_spec_text),''),
        nullif(concat_ws(' · ',nullif(btrim(l.requested_standard),''),
          nullif(btrim(l.requested_grade),'')),''))
    from public.rfq_lines l
    where l.organization_id = p_organization_id and l.rfq_id = p_rfq_id
    order by l.created_at,l.id;
  else
    -- Negotiated revision: start from the last customer offer (not a blank
    -- request). Copy customer-facing prices/conditions so the seller changes
    -- only what is being negotiated. The sent predecessor remains frozen.
    insert into public.offer_lines (
      organization_id,owner_id,offer_id,rfq_line_id,product_id,
      quantity,quantity_unit,price_value,price_unit,price_type,
      discount_percentage,availability_status,available_from,
      canonical_product_id,canonical_product_key,raw_spec_text
    )
    select p_organization_id,v_uid,v_id,l.rfq_line_id,l.product_id,
      l.quantity,l.quantity_unit,l.price_value,l.price_unit,l.price_type,
      l.discount_percentage,l.availability_status,l.available_from,
      l.canonical_product_id,l.canonical_product_key,l.raw_spec_text
    from public.offer_lines l
    where l.organization_id = p_organization_id and l.offer_id = v_prev.id
    order by l.created_at,l.id;
  end if;
  get diagnostics v_count = row_count;

  insert into public.comm_deal_events (
    organization_id,deal_kind,deal_id,record_kind,record_id,action,
    changes,actor_user_id
  ) values (
    p_organization_id,'inbound-rfq',p_rfq_id,'offer',v_id,v_action,
    jsonb_build_array(jsonb_build_object('record_kind','offer',
      'record_id',v_id,'from',null,'to','draft')),
    v_uid
  );

  return jsonb_build_object('offer_id',v_id,'revision_no',v_revision,
    'created',true,'line_count',v_count,'needs_lines',v_count=0,
    'previous_offer_id',v_prev.id);
end;
$$;

-- New public SECURITY DEFINER function reviewed: explicit auth.uid, active
-- member with write role, office profile, row-locked same-tenant RFQ, exact
-- transitions, no buyer target or raw email output, append-only audit event.
revoke all on function public.comm_cycle2a_prepare_offer(uuid,uuid) from public, anon, authenticated;
grant execute on function public.comm_cycle2a_prepare_offer(uuid,uuid) to authenticated, service_role;
revoke all on function private.comm_cycle2a_offer_guard() from public,anon,authenticated;
revoke all on function private.comm_cycle2a_offer_line_guard() from public,anon,authenticated;
