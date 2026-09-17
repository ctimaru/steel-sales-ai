-- P1.15 / SK4.5a hardening — Supabase default function grants can include anon.
-- Keep reconciliation authenticated/service-role only.

revoke execute on function public.steel_weight_reconciliation_class(numeric, numeric, numeric) from public, anon;
revoke execute on function public.p1_shared_steel_weight_reconciliation(uuid, uuid, numeric) from public, anon;

grant execute on function public.steel_weight_reconciliation_class(numeric, numeric, numeric) to authenticated, service_role;
grant execute on function public.p1_shared_steel_weight_reconciliation(uuid, uuid, numeric) to authenticated, service_role;

do $$
begin
  if has_function_privilege('anon', 'public.steel_weight_reconciliation_class(numeric,numeric,numeric)', 'EXECUTE') then
    raise exception 'SK4.5a security regression: anon can execute steel_weight_reconciliation_class';
  end if;

  if has_function_privilege('anon', 'public.p1_shared_steel_weight_reconciliation(uuid,uuid,numeric)', 'EXECUTE') then
    raise exception 'SK4.5a security regression: anon can execute p1_shared_steel_weight_reconciliation';
  end if;

  if not has_function_privilege('authenticated', 'public.steel_weight_reconciliation_class(numeric,numeric,numeric)', 'EXECUTE') then
    raise exception 'SK4.5a security regression: authenticated cannot execute steel_weight_reconciliation_class';
  end if;

  if not has_function_privilege('authenticated', 'public.p1_shared_steel_weight_reconciliation(uuid,uuid,numeric)', 'EXECUTE') then
    raise exception 'SK4.5a security regression: authenticated cannot execute p1_shared_steel_weight_reconciliation';
  end if;
end
$$;