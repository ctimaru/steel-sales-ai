-- NET-UX3B.1 defense in depth: explicit deny-all RLS policies for private
-- provenance ledgers. Direct GRANTs to anon/authenticated are already revoked.
-- Platform private SECURITY DEFINER functions and service role remain scoped.

create policy netux3b1_source_ledger_deny_clients
on public.network_it_geo_source_recheck_ledger
as restrictive for all to anon,authenticated
using (false) with check (false);

create policy netux3b1_reopen_ledger_deny_clients
on public.network_it_geo_conflict_reopen_ledger
as restrictive for all to anon,authenticated
using (false) with check (false);
