begin;

do $$
declare
  v_org uuid;
  v_user uuid;
  v_result jsonb;
begin
  select organization_id,user_id into v_org,v_user
  from public.organization_memberships
  where status='active'
  order by created_at
  limit 1;

  if v_org is null or v_user is null then
    return;
  end if;

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  execute 'set local role authenticated';

  v_result := public.p1_normalization_coverage(v_org,25);

  if not (v_result ? 'summary' and v_result ? 'backlog' and v_result ? 'policy') then
    raise exception 'coverage contract missing top-level keys';
  end if;

  if coalesce((v_result#>>'{policy,bulk_auto_promotion}')::boolean,true) then
    raise exception 'PA2.15 must never enable bulk auto-promotion';
  end if;

  if coalesce((v_result#>>'{policy,legacy_is_evidence}')::boolean,false) is not true then
    raise exception 'legacy observations must remain evidence';
  end if;

  if coalesce((v_result#>>'{policy,offer_promotion_enabled}')::boolean,true) then
    raise exception 'offer promotion must remain disabled until its controlled service exists';
  end if;

  if coalesce((v_result#>>'{policy,order_promotion_enabled}')::boolean,true) then
    raise exception 'order promotion must remain disabled until its controlled service exists';
  end if;
end $$;

rollback;
