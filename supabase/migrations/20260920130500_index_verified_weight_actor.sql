-- P1.15 / SK4.5f hardening — cover the verified_by foreign key added by
-- controlled verified-weight promotion.

create index steel_weight_references_verified_by_idx
  on public.steel_weight_references (verified_by)
  where verified_by is not null;

do $$
begin
  if to_regclass('public.steel_weight_references_verified_by_idx') is null then
    raise exception 'SK4.5f verified_by index missing';
  end if;
end
$$;
