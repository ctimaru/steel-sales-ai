-- LR5A — Advisor hardening
-- Cover the auth.users FK used by account-scoped legal evidence lookups.

create index if not exists user_legal_acceptances_user_id_idx
  on public.user_legal_acceptances(user_id,created_at desc)
  where user_id is not null;
