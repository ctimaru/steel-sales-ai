create policy retrieval_golden_query_cases_service_role_all
  on public.retrieval_golden_query_cases
  for all
  to service_role
  using (true)
  with check (true);

create policy retrieval_golden_query_targets_service_role_all
  on public.retrieval_golden_query_targets
  for all
  to service_role
  using (true)
  with check (true);
