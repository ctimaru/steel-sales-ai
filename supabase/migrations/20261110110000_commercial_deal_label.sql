-- COMM-LABEL1 — Nome della trattativa modificabile dall'utente.
--
-- Colonna additiva e facoltativa su richieste, offerte e ordini: serve a dare un nome
-- leggibile alle righe senza cliente. Nessun dato esistente viene toccato; la RLS di
-- aggiornamento esistente (membri con scrittura dell'organizzazione) resta l'unica regola.

alter table public.rfqs add column if not exists deal_label text;
alter table public.offers add column if not exists deal_label text;
alter table public.orders add column if not exists deal_label text;

do $$
declare
  t text;
begin
  foreach t in array array['rfqs', 'offers', 'orders'] loop
    if not exists (
      select 1 from pg_constraint
      where conname = t || '_deal_label_length'
        and conrelid = ('public.' || t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I check (deal_label is null or char_length(btrim(deal_label)) between 1 and 80)',
        t, t || '_deal_label_length');
    end if;
  end loop;
end $$;

comment on column public.rfqs.deal_label is 'Nome della trattativa scelto dall''utente (max 80 caratteri).';
comment on column public.offers.deal_label is 'Nome della trattativa scelto dall''utente (max 80 caratteri).';
comment on column public.orders.deal_label is 'Nome della trattativa scelto dall''utente (max 80 caratteri).';
