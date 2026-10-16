create policy netcov2b_explicit_deny_client_access on public.network_netcov2b_domain_permissions as restrictive for all to anon,authenticated using(false) with check(false);
