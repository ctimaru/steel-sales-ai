-- COMM-CYCLE2.B: quote editor, atomic guarded save and optional kg/m quote basis.
-- Stacked on COMM-CYCLE2.A; production migration requires founder approval.
-- No financial target/pricing engine input is ever copied from the buyer side.

alter table public.offers
  add column if not exists draft_edit_version integer not null default 0;
alter table public.offers
  add constraint comm_cycle2b_draft_version_nonnegative check (draft_edit_version >= 0);
alter table public.offer_lines
  add column if not exists weight_kg_m numeric;
alter table public.offer_lines
  add constraint comm_cycle2b_weight_positive check (
    weight_kg_m is null or (weight_kg_m > 0 and weight_kg_m <= 100000)
  );

comment on column public.offers.draft_edit_version is
  'COMM-CYCLE2.B: optimistic concurrency counter for customer-offer draft edits.';
comment on column public.offer_lines.weight_kg_m is
  'COMM-CYCLE2.B: explicitly verified theoretical kg/m, used only to preview €/t versus €/m. Never inferred without source.';

-- Preserve the 2.A revision lineage: the next draft inherits the *customer*
-- weights only, by matching the original request line to the preceding quote.
create or replace function private.comm_cycle2b_inherit_weight()
returns trigger language plpgsql security invoker set search_path = ''
as $inherit_weight$
declare
  v_previous_offer_id uuid;
begin
  if new.weight_kg_m is null and new.rfq_line_id is not null then
    select o.previous_offer_id into v_previous_offer_id
    from public.offers o where o.id = new.offer_id
      and o.organization_id = new.organization_id and o.revision_managed;
    if v_previous_offer_id is not null then
      select l.weight_kg_m into new.weight_kg_m
      from public.offer_lines l
      where l.organization_id = new.organization_id
        and l.offer_id = v_previous_offer_id and l.rfq_line_id = new.rfq_line_id
      order by l.created_at, l.id limit 1;
    end if;
  end if;
  return new;
end;
$inherit_weight$;

drop trigger if exists comm_cycle2b_weight_inheritance on public.offer_lines;
create trigger comm_cycle2b_weight_inheritance
before insert on public.offer_lines
for each row execute function private.comm_cycle2b_inherit_weight();

-- All managed draft edits must go through the reviewed saver, not direct
-- PostgREST table writes; ordinary imported/legacy offers remain unaffected.
-- The reviewed SECURITY DEFINER workflow runs as table owner (postgres).
create or replace function private.comm_cycle2b_draft_header_guard()
returns trigger language plpgsql security invoker set search_path = ''
as $draft_header$
begin
  if old.revision_managed and old.status = 'draft'
    and current_user <> 'postgres' then
    raise exception 'comm_cycle2b: usa Salva bozza per modificare l''offerta'
      using errcode = '42501';
  end if;
  return new;
end;
$draft_header$;

drop trigger if exists comm_cycle2b_draft_header_guard on public.offers;
create trigger comm_cycle2b_draft_header_guard
before update on public.offers
for each row execute function private.comm_cycle2b_draft_header_guard();

create or replace function private.comm_cycle2b_draft_lines_guard()
returns trigger language plpgsql security invoker set search_path = ''
as $draft_lines$
declare
  v_is_managed boolean;
  v_status text;
  v_id uuid;
  v_org uuid;
begin
  if tg_op in ('UPDATE','DELETE') then
    select o.revision_managed, o.status into v_is_managed, v_status
    from public.offers o where o.id = old.offer_id and o.organization_id = old.organization_id;
    if v_is_managed and v_status = 'draft' and current_user <> 'postgres' then
      raise exception 'comm_cycle2b: usa Salva bozza per modificare le righe'
        using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  v_id := new.offer_id; v_org := new.organization_id;
  select o.revision_managed, o.status into v_is_managed, v_status
  from public.offers o where o.id = v_id and o.organization_id = v_org;
  if v_is_managed and v_status = 'draft' and current_user <> 'postgres' then
    raise exception 'comm_cycle2b: usa Salva bozza per modificare le righe'
      using errcode = '42501';
  end if;
  return new;
end;
$draft_lines$;

drop trigger if exists comm_cycle2b_draft_lines_guard on public.offer_lines;
create trigger comm_cycle2b_draft_lines_guard
before insert or update or delete on public.offer_lines
for each row execute function private.comm_cycle2b_draft_lines_guard();

-- The existing COMM-CYCLE1 "Segna inviata" path is still authoritative for
-- status changes; deny sending a half-priced generated draft even from that RPC.
create or replace function private.comm_cycle2b_send_readiness()
returns trigger language plpgsql security invoker set search_path = ''
as $send_readiness$
begin
  if old.revision_managed and old.status = 'draft' and new.status = 'sent' then
    if new.valid_until is null or new.valid_until < current_date
      or nullif(btrim(coalesce(new.delivery_term,'')),'') is null
      or nullif(btrim(coalesce(new.payment_terms,'')),'') is null then
      raise exception 'comm_cycle2b: completa validità, resa e pagamento'
        using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.offer_lines l
      where l.organization_id = old.organization_id and l.offer_id = old.id
    ) or exists (
      select 1 from public.offer_lines l
      where l.organization_id = old.organization_id and l.offer_id = old.id
        and (l.price_value is null or l.price_value <= 0
          or coalesce(l.price_unit,'') not in ('EUR/t','EUR/m'))
    ) then
      raise exception 'comm_cycle2b: completa i prezzi di tutte le righe'
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$send_readiness$;

drop trigger if exists comm_cycle2b_send_readiness on public.offers;
create trigger comm_cycle2b_send_readiness
before update on public.offers
for each row execute function private.comm_cycle2b_send_readiness();

-- Draft saves are events (not status changes): exact changes=[] lets existing
-- close_lost/reopen logic restore only actual statuses.
alter table public.comm_deal_events
  drop constraint if exists comm_deal_events_action_check;
alter table public.comm_deal_events
  add constraint comm_deal_events_action_check check (action in (
    'take_charge','offer_sent','offer_accepted','order_registered',
    'order_confirmed','order_status','close_lost','reopen',
    'offer_prepared','offer_revised','offer_edited'
  ));

create or replace function public.comm_cycle2b_save_offer(
  p_organization_id uuid,
  p_offer_id uuid,
  p_expected_version integer,
  p_valid_until date,
  p_delivery_term text,
  p_payment_terms text,
  p_notes text,
  p_lines jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $save_quote$
declare
  v_uid uuid := (select auth.uid());
  v_offer public.offers%rowtype;
  v_line jsonb;
  v_line_id uuid;
  v_ids uuid[] := array[]::uuid[];
  v_price numeric;
  v_unit text;
  v_weight numeric;
  v_text text;
  v_total integer;
  v_changed integer := 0;
begin
  if v_uid is null or p_organization_id is null
    or not public.is_organization_member(p_organization_id,true) then
    raise exception 'comm_cycle2b: non autorizzato' using errcode = '42501';
  end if;
  if private.office_write_denied(p_organization_id,'commercial') then
    raise exception 'office_profile_read_only: serve il profilo Ufficio commerciale'
      using errcode = '42501';
  end if;

  if p_offer_id is null or p_expected_version is null or p_expected_version < 0 then
    raise exception 'comm_cycle2b: offerta o versione non valida' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'comm_cycle2b: righe dell''offerta non valide' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lines) > 100 then
    raise exception 'comm_cycle2b: massimo 100 righe' using errcode = '22023';
  end if;
  if char_length(coalesce(p_delivery_term,'')) > 200
    or char_length(coalesce(p_payment_terms,'')) > 200
    or char_length(coalesce(p_notes,'')) > 500 then
    raise exception 'comm_cycle2b: condizioni troppo lunghe' using errcode = '22023';
  end if;
  if p_valid_until is not null and p_valid_until < current_date then
    raise exception 'comm_cycle2b: la validità non può essere nel passato' using errcode = '22023';
  end if;

  select * into v_offer from public.offers
  where id = p_offer_id and organization_id = p_organization_id for update;
  if not found then raise exception 'comm_cycle2b: offerta non trovata' using errcode = 'P0002'; end if;
  if not v_offer.revision_managed or v_offer.status <> 'draft'
    or v_offer.rfq_id is null then
    raise exception 'comm_cycle2b: solo l''ultima bozza generata dalla richiesta è modificabile'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.offers newer where newer.organization_id = p_organization_id
      and newer.rfq_id = v_offer.rfq_id and newer.revision_no > v_offer.revision_no
  ) then
    raise exception 'comm_cycle2b: esiste una revisione successiva' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.rfqs r where r.organization_id = p_organization_id
      and r.id = v_offer.rfq_id and r.status in ('closed_won','closed_lost','cancelled')
  ) then
    raise exception 'comm_cycle2b: riapri prima la richiesta' using errcode = '22023';
  end if;
  if p_expected_version <> v_offer.draft_edit_version then
    raise exception 'comm_cycle2b: bozza modificata altrove, aggiorna la pagina'
      using errcode = '40001';
  end if;

  select count(*) into v_total from public.offer_lines
  where organization_id = p_organization_id and offer_id = p_offer_id;
  if v_total <> jsonb_array_length(p_lines) then
    raise exception 'comm_cycle2b: aggiorna la pagina, le righe sono cambiate'
      using errcode = '40001';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_line) <> 'object'
      or coalesce(v_line->>'line_id','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then
      raise exception 'comm_cycle2b: identificativo riga non valido' using errcode = '22023';
    end if;
    v_line_id := (v_line->>'line_id')::uuid;
    if v_line_id = any(v_ids) then
      raise exception 'comm_cycle2b: riga duplicata' using errcode = '22023';
    end if;
    v_ids := array_append(v_ids,v_line_id);

    v_text := nullif(btrim(coalesce(v_line->>'price_value','')),'');
    if v_text is null then v_price := null;
    else
      if v_text !~ '^\d{1,8}(\.\d{1,4})?$' then
        raise exception 'comm_cycle2b: prezzo non valido' using errcode = '22023';
      end if;
      v_price := v_text::numeric;
      if v_price <= 0 or v_price > 100000000 then
        raise exception 'comm_cycle2b: prezzo fuori limite' using errcode = '22023';
      end if;
    end if;
    v_unit := nullif(btrim(coalesce(v_line->>'price_unit','')),'');
    if (v_price is null and v_unit is not null)
      or (v_price is not null and coalesce(v_unit,'') not in ('EUR/t','EUR/m')) then
      raise exception 'comm_cycle2b: unità prezzo non valida' using errcode = '22023';
    end if;

    v_text := nullif(btrim(coalesce(v_line->>'weight_kg_m','')),'');
    if v_text is null then v_weight := null;
    else
      if v_text !~ '^\d{1,6}(\.\d{1,4})?$' then
        raise exception 'comm_cycle2b: peso kg/m non valido' using errcode = '22023';
      end if;
      v_weight := v_text::numeric;
      if v_weight <= 0 or v_weight > 100000 then
        raise exception 'comm_cycle2b: peso kg/m fuori limite' using errcode = '22023';
      end if;
    end if;

    update public.offer_lines set price_value=v_price,price_unit=v_unit,
      price_type='direct', weight_kg_m=v_weight
    where id=v_line_id and organization_id=p_organization_id and offer_id=p_offer_id;
    if not found then
      raise exception 'comm_cycle2b: riga offerta non trovata' using errcode = 'P0002';
    end if;
    v_changed := v_changed+1;
  end loop;

  update public.offers set valid_until=p_valid_until,
    delivery_term=nullif(btrim(coalesce(p_delivery_term,'')),''),
    payment_terms=nullif(btrim(coalesce(p_payment_terms,'')),''),
    notes=nullif(btrim(coalesce(p_notes,'')),''),
    draft_edit_version=draft_edit_version+1
  where id=p_offer_id and organization_id=p_organization_id;

  insert into public.comm_deal_events (
    organization_id,deal_kind,deal_id,record_kind,record_id,
    action,changes,actor_user_id
  ) values (
    p_organization_id,'inbound-rfq',v_offer.rfq_id,'offer',p_offer_id,
    'offer_edited','[]'::jsonb,v_uid
  );

  return jsonb_build_object('offer_id',p_offer_id,'revision_no',v_offer.revision_no,
    'draft_edit_version',v_offer.draft_edit_version+1,'saved_lines',v_changed);
end;
$save_quote$;

revoke all on function public.comm_cycle2b_save_offer(
  uuid,uuid,integer,date,text,text,text,jsonb
) from public,anon,authenticated;
grant execute on function public.comm_cycle2b_save_offer(
  uuid,uuid,integer,date,text,text,text,jsonb
) to authenticated,service_role;
revoke all on function private.comm_cycle2b_inherit_weight() from public,anon,authenticated;
revoke all on function private.comm_cycle2b_draft_header_guard() from public,anon,authenticated;
revoke all on function private.comm_cycle2b_draft_lines_guard() from public,anon,authenticated;

revoke all on function private.comm_cycle2b_send_readiness() from public,anon,authenticated;
