-- LR4A — Advisor hardening for Company Directory privacy governance.
--
-- Add covering FK indexes for LR4 governance evidence and make the
-- client-deny posture explicit at the RLS layer in addition to GRANT revocation.

create index if not exists network_art14_notice_log_company_idx
  on public.network_art14_notice_log(network_company_id);

create index if not exists network_art14_notice_log_recorded_by_idx
  on public.network_art14_notice_log(recorded_by);

create index if not exists network_contacts_privacy_reviewed_by_idx
  on public.network_contacts(privacy_reviewed_by);

drop policy if exists "LR4 clients cannot read or mutate Art14 evidence"
  on public.network_art14_notice_log;

create policy "LR4 clients cannot read or mutate Art14 evidence"
on public.network_art14_notice_log
as restrictive
for all
to anon,authenticated
using (false)
with check (false);

comment on policy "LR4 clients cannot read or mutate Art14 evidence"
on public.network_art14_notice_log is
  'LR4 defense-in-depth: Article 14 evidence is service-role/platform-operations only. Table grants to anon/authenticated are also revoked.';
