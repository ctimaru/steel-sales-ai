-- COMM-CYCLE2.C — email-only quote delivery (no PDF).
-- Production migration requires specific founder authorization. User action
-- remains the only send trigger; mail provider acceptance drives "sent".
create table public.comm_offer_email_dispatches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  offer_id uuid not null,
  rfq_id uuid not null,
  revision_no integer not null check (revision_no >= 1),
  draft_edit_version integer not null check (draft_edit_version >= 0),
  attempt_no integer not null check (attempt_no between 1 and 20),
  recipient_email text not null check (char_length(recipient_email) between 6 and 254),
  subject text not null check (char_length(subject) between 1 and 180),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'reserved'
    check (status in ('reserved','accepted','failed','unknown')),
  provider_message_id text,
  actor_user_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  constraint comm_cycle2c_offer_same_org foreign key (organization_id,offer_id)
    references public.offers(organization_id,id),
  constraint comm_cycle2c_offer_attempt_unique unique (organization_id,offer_id,attempt_no),
  constraint comm_cycle2c_provider_only_when_accepted check (
    status <> 'accepted' or provider_message_id is not null
  )
);
create index comm_cycle2c_email_deal_idx
  on public.comm_offer_email_dispatches(organization_id,rfq_id,created_at desc);
create unique index comm_cycle2c_provider_id_unique
  on public.comm_offer_email_dispatches(provider_message_id)
  where provider_message_id is not null;
alter table public.comm_offer_email_dispatches enable row level security;
create policy comm_cycle2c_email_select on public.comm_offer_email_dispatches
  for select to authenticated
  using (public.is_organization_member(organization_id,false));
revoke all on public.comm_offer_email_dispatches from public,anon,authenticated;
grant select on public.comm_offer_email_dispatches to authenticated;
grant all on public.comm_offer_email_dispatches to service_role;
comment on table public.comm_offer_email_dispatches is
  'COMM-CYCLE2.C: customer-only quote email send attempts, immutable destination/snapshot digest; no PDF, no bulk sending.';

-- Freeze the complete customer offer while its snapshot is being sent or while
-- the delivery outcome is ambiguous. Failed attempts may be edited and retried
-- explicitly by the human operator; acceptance freezes the existing revision.
create or replace function private.comm_cycle2c_freeze_offer_during_dispatch()
returns trigger language plpgsql security invoker set search_path=''
as $body$
begin
  if old.revision_managed and old.status='draft' and exists (
    select 1 from public.comm_offer_email_dispatches d
    where d.organization_id=old.organization_id and d.offer_id=old.id
      and d.status in ('reserved','unknown','accepted')
  ) then
    if ((to_jsonb(new)-'status'-'offered_at')
          is distinct from (to_jsonb(old)-'status'-'offered_at'))
      or (new.status is distinct from old.status
        and not (
          new.status='sent' and current_user='postgres'
          and exists (
            select 1 from public.comm_offer_email_dispatches verified
            where verified.organization_id=old.organization_id
              and verified.offer_id=old.id and verified.status='accepted'
          )
        )) then
      raise exception 'comm_cycle2c: offerta bloccata durante l''invio'
        using errcode='42501';
    end if;
  end if;
  return new;
end;
$body$;
create trigger comm_cycle2c_freeze_offer
before update on public.offers for each row
execute function private.comm_cycle2c_freeze_offer_during_dispatch();

create or replace function private.comm_cycle2c_freeze_lines_during_dispatch()
returns trigger language plpgsql security invoker set search_path=''
as $body$
declare v_offer uuid;
declare v_org uuid;
begin
  if tg_op = 'INSERT' then
    v_offer:=new.offer_id; v_org:=new.organization_id;
  else
    v_offer:=old.offer_id; v_org:=old.organization_id;
  end if;
  if exists (
    select 1 from public.comm_offer_email_dispatches d
    where d.organization_id=v_org and d.offer_id=v_offer
      and d.status in ('reserved','unknown','accepted')
  ) then
    raise exception 'comm_cycle2c: righe bloccate durante l''invio'
      using errcode='42501';
  end if;
  if tg_op='UPDATE' and (new.offer_id is distinct from old.offer_id
      or new.organization_id is distinct from old.organization_id) and exists (
    select 1 from public.comm_offer_email_dispatches d
    where d.organization_id=new.organization_id and d.offer_id=new.offer_id
      and d.status in ('reserved','unknown','accepted')
  ) then
    raise exception 'comm_cycle2c: righe bloccate durante l''invio'
      using errcode='42501';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$body$;
create trigger comm_cycle2c_freeze_lines
before insert or update or delete on public.offer_lines for each row
execute function private.comm_cycle2c_freeze_lines_during_dispatch();

-- One human-confirmed send attempt per call; explicit retry permitted ONLY
-- following an acknowledged failure, never after unknown/accepted/reserved.
-- Locks offer to serialize with saves and all competing attempts.
create or replace function public.comm_cycle2c_reserve_email(
  p_organization_id uuid, p_offer_id uuid, p_expected_version integer,
  p_recipient text, p_subject text, p_content_sha256 text
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers%rowtype;
  v_attempt integer;
  v_last_status text;
  v_id uuid;
begin
  if v_uid is null or p_organization_id is null
    or not public.is_organization_member(p_organization_id,true) then
    raise exception 'comm_cycle2c: non autorizzato' using errcode='42501';
  end if;
  if private.office_write_denied(p_organization_id,'commercial') then
    raise exception 'office_profile_read_only: serve il profilo Ufficio commerciale'
      using errcode='42501';
  end if;
  if p_expected_version is null or p_expected_version < 0
    or p_recipient is null or char_length(p_recipient) > 254
    or p_recipient !~* '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[a-z]{2,}$'
    or p_subject is null or char_length(btrim(p_subject)) not between 1 and 180
    or p_subject ~ '[\r\n]' or p_content_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'comm_cycle2c: destinatario o oggetto non validi'
      using errcode='22023';
  end if;

  select * into v_offer from public.offers
  where id=p_offer_id and organization_id=p_organization_id for update;
  if not found or v_offer.status <> 'draft' or not v_offer.revision_managed
    or v_offer.rfq_id is null then
    raise exception 'comm_cycle2c: offerta non disponibile' using errcode='22023';
  end if;
  if v_offer.draft_edit_version <> p_expected_version or exists (
    select 1 from public.offers o where o.organization_id=p_organization_id
      and o.rfq_id=v_offer.rfq_id and o.revision_no>v_offer.revision_no
  ) then
    raise exception 'comm_cycle2c: bozza cambiata; aggiorna la pagina'
      using errcode='40001';
  end if;
  if v_offer.valid_until is null or v_offer.valid_until < current_date
    or nullif(btrim(coalesce(v_offer.delivery_term,'')),'') is null
    or nullif(btrim(coalesce(v_offer.payment_terms,'')),'') is null
    or not exists (select 1 from public.offer_lines l
      where l.organization_id=p_organization_id and l.offer_id=p_offer_id)
    or exists (select 1 from public.offer_lines l
      where l.organization_id=p_organization_id and l.offer_id=p_offer_id
        and (l.price_value is null or l.price_value <= 0
          or l.price_unit not in ('EUR/t','EUR/m'))) then
    raise exception 'comm_cycle2c: completa righe, prezzi, validità, resa e pagamento'
      using errcode='22023';
  end if;
  if exists (select 1 from public.rfqs r where r.id=v_offer.rfq_id
    and r.organization_id=p_organization_id
    and r.status in ('closed_won','closed_lost','cancelled')) then
    raise exception 'comm_cycle2c: riapri prima la richiesta'
      using errcode='22023';
  end if;
  select attempt_no,status into v_attempt,v_last_status
    from public.comm_offer_email_dispatches
    where organization_id=p_organization_id and offer_id=p_offer_id
    order by attempt_no desc limit 1;
  if v_attempt is not null and v_last_status <> 'failed' then
    raise exception 'comm_cycle2c: invio già avviato, attendi o verifica lo storico'
      using errcode='23505';
  end if;
  v_attempt:=coalesce(v_attempt,0)+1;
  if v_attempt>5 or (select count(*) from public.comm_offer_email_dispatches
     where organization_id=p_organization_id
       and created_at>clock_timestamp()-interval '1 hour')>=30 then
    raise exception 'comm_cycle2c: limite invii raggiunto'
      using errcode='22023';
  end if;
  insert into public.comm_offer_email_dispatches(
    organization_id,offer_id,rfq_id,revision_no,draft_edit_version,
    attempt_no,recipient_email,subject,content_sha256,actor_user_id
  ) values (
    p_organization_id,p_offer_id,v_offer.rfq_id,v_offer.revision_no,
    v_offer.draft_edit_version,v_attempt,lower(btrim(p_recipient)),btrim(p_subject),
    p_content_sha256,v_uid
  ) returning id into v_id;
  return jsonb_build_object('dispatch_id',v_id,'attempt',v_attempt);
end;
$body$;

-- Provider acceptance is NOT an authenticated/client-callable statement.
-- This API is service-role only and invoked exclusively by the server action
-- after an actual Resend HTTP response. Users cannot forge provider acceptance.
-- It does not bypass human permissions for the offer status transition.
create or replace function public.comm_cycle2c_complete_email(
  p_organization_id uuid,p_dispatch_id uuid,p_result text,
  p_provider_message_id text default null
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare
  v_email public.comm_offer_email_dispatches%rowtype;
  v_offer public.offers%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'comm_cycle2c: server-only provider outcome' using errcode='42501';
  end if;
  if p_organization_id is null or p_dispatch_id is null
    or p_result is null or p_result not in ('accepted','failed','unknown')
    or (p_result='accepted' and (p_provider_message_id is null
      or char_length(p_provider_message_id) not between 8 and 128))
    or (p_result<>'accepted' and p_provider_message_id is not null) then
    raise exception 'comm_cycle2c: esito provider non valido' using errcode='22023';
  end if;

  select * into v_email from public.comm_offer_email_dispatches
    where id=p_dispatch_id and organization_id=p_organization_id for update;
  if not found then
    raise exception 'comm_cycle2c: invio non trovato' using errcode='P0002';
  end if;
  if v_email.status <> 'reserved' then
    raise exception 'comm_cycle2c: esito già registrato' using errcode='23505';
  end if;
  if p_result='accepted' then
    select * into v_offer from public.offers
      where id=v_email.offer_id and organization_id=p_organization_id for update;
    if not found or v_offer.status <> 'draft'
      or v_offer.draft_edit_version<>v_email.draft_edit_version then
      raise exception 'comm_cycle2c: revisione modificata durante l''invio'
        using errcode='40001';
    end if;
  end if;
  update public.comm_offer_email_dispatches set status=p_result,
    provider_message_id=case when p_result='accepted' then p_provider_message_id else null end,
    resolved_at=clock_timestamp()
  where id=p_dispatch_id;
  return jsonb_build_object('dispatch_id',p_dispatch_id,'status',p_result);
end;
$body$;

-- Separate authenticated human status transition, after the server-only
-- provider result is durably stored. No supplied provider id can fool this RPC.
-- The existing COMM-CYCLE1 workflow remains authoritative for real changes.
create or replace function public.comm_cycle2c_confirm_sent(
  p_organization_id uuid,p_dispatch_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare
  v_uid uuid:=auth.uid();
  v_email public.comm_offer_email_dispatches%rowtype;
  v_offer public.offers%rowtype;
begin
  if v_uid is null or p_organization_id is null
    or not public.is_organization_member(p_organization_id,true) then
    raise exception 'comm_cycle2c: non autorizzato' using errcode='42501';
  end if;
  if private.office_write_denied(p_organization_id,'commercial') then
    raise exception 'office_profile_read_only: serve il profilo Ufficio commerciale'
      using errcode='42501';
  end if;
  select * into v_email from public.comm_offer_email_dispatches
    where id=p_dispatch_id and organization_id=p_organization_id
      and actor_user_id=v_uid for update;
  if not found then
    raise exception 'comm_cycle2c: invio non trovato' using errcode='P0002';
  end if;
  if v_email.status <> 'accepted' or v_email.provider_message_id is null then
    raise exception 'comm_cycle2c: provider non ha confermato l''invio'
      using errcode='22023';
  end if;
  select * into v_offer from public.offers
    where id=v_email.offer_id and organization_id=p_organization_id for update;
  if not found or v_offer.draft_edit_version<>v_email.draft_edit_version then
    raise exception 'comm_cycle2c: revisione modificata durante l''invio'
      using errcode='40001';
  end if;
  if v_offer.status='sent' then
    return jsonb_build_object('dispatch_id',p_dispatch_id,'status','sent','already_done',true);
  end if;
  if v_offer.status <> 'draft' then
    raise exception 'comm_cycle2c: offerta non in bozza' using errcode='22023';
  end if;
  perform public.comm_cycle1_apply(p_organization_id,'offer',v_email.offer_id,'offer_sent');
  return jsonb_build_object('dispatch_id',p_dispatch_id,'status','sent','already_done',false);
end;
$body$;

revoke all on function public.comm_cycle2c_reserve_email(uuid,uuid,integer,text,text,text)
  from public,anon,authenticated;
grant execute on function public.comm_cycle2c_reserve_email(uuid,uuid,integer,text,text,text)
  to authenticated,service_role;
revoke all on function public.comm_cycle2c_complete_email(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.comm_cycle2c_complete_email(uuid,uuid,text,text)
  to service_role;
revoke all on function public.comm_cycle2c_confirm_sent(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.comm_cycle2c_confirm_sent(uuid,uuid)
  to authenticated,service_role;
revoke all on function private.comm_cycle2c_freeze_offer_during_dispatch()
  from public,anon,authenticated;
revoke all on function private.comm_cycle2c_freeze_lines_during_dispatch()
  from public,anon,authenticated;
