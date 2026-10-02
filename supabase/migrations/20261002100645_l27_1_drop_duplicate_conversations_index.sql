-- L27.1 — Release Controls & Database Readiness
-- conversations_org_external_thread_uq is byte-for-byte equivalent to
-- conversations_org_external_thread_uidx. Keep the established _uidx copy
-- and remove only the redundant index.

drop index if exists public.conversations_org_external_thread_uq;
