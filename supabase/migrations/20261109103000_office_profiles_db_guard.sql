-- OFFICE-PROFILES1 — Blocco lato database: un membro con profilo "Ufficio commerciale"
-- (business_role = 'salesperson') non scrive negli acquisti, e viceversa.
--
-- Meccanismo: trigger BEFORE INSERT/UPDATE sulle tabelle di invio, negoziazione,
-- aggiudicazione e ordine di acquisto. Non riscrive nessuna RPC e non cambia la RLS.
-- Vale solo per sessioni utente (auth.uid() valorizzato): worker, webhook e fornitori
-- via token (senza auth.uid) non sono toccati. Amministratori, Direzione commerciale
-- (sales_director), membri senza profilo, "operations" e viewer non cambiano comportamento.

create or replace function private.office_write_denied(
  p_organization_id uuid,
  p_area text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = 'member'
      and (
        (p_area = 'purchasing' and m.business_role = 'salesperson')
        or (p_area = 'commercial' and m.business_role = 'purchasing')
      )
  );
$$;

revoke all on function private.office_write_denied(uuid, text) from public, anon;
grant execute on function private.office_write_denied(uuid, text) to authenticated, service_role;

create or replace function private.enforce_purchasing_office_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if private.office_write_denied(new.organization_id, 'purchasing') then
    raise exception 'office_profile_read_only: serve il profilo Ufficio acquisti'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_purchasing_office_write() from public, anon;

do $$
declare
  t text;
begin
  foreach t in array array[
    'buyer_rfq_dispatches',
    'buyer_rfq_negotiation_messages',
    'buyer_rfq_awards',
    'buyer_purchase_order_drafts',
    'buyer_purchase_order_versions'
  ] loop
    execute format('drop trigger if exists office_profile_write_guard on public.%I', t);
    execute format(
      'create trigger office_profile_write_guard before insert or update on public.%I '
      'for each row execute function private.enforce_purchasing_office_write()', t);
  end loop;
end $$;
