-- DASH-FEED4: optional, user-owned product/territory feed signals.
-- Ranking hints are NOT permissions, geocoded company evidence or publication rights.
alter table steel_pulse_private.user_feed_preferences
  add column product_interests text[] not null default '{}'::text[],
  add column territory_interests text[] not null default '{}'::text[];

alter table steel_pulse_private.user_feed_preferences
  add constraint dash_feed4_products_allowed check (
    cardinality(product_interests) <= 6
    and array_position(product_interests,null) is null
    and product_interests <@ array[
      'round_tubes','hollow_sections','seamless_tubes',
      'welded_tubes','stainless_steel','steel_processing'
    ]::text[]
  ),
  add constraint dash_feed4_territories_allowed check (
    cardinality(territory_interests) <= 8
    and array_position(territory_interests,null) is null
    and territory_interests <@ array[
      'italy','north_west','north_east','center',
      'south','islands','europe','usa'
    ]::text[]
  );
-- Keep the SP5 RLS boundary: the private table has no direct browser grants.

-- One validated transaction updates old and new preferences together, owned by auth.uid().
create function public.sp8_save_feed_preferences(
  p_topics text[], p_role_interest text, p_language_code text,
  p_product_interests text[], p_territory_interests text[]
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_topics text[];
  v_products text[];
  v_territories text[];
begin
  if (select auth.role()) is distinct from 'authenticated' or v_user is null then
    raise exception 'DASH-FEED4 authenticated user required' using errcode='42501';
  end if;
  if p_topics is null or cardinality(p_topics)>6
    or array_position(p_topics,null) is not null
    or cardinality(p_topics)<>(select count(distinct x) from unnest(p_topics) as x)
    or not (p_topics <@ array['market','trade','regulation','raw_materials','technology','companies']::text[])
    or p_role_interest is null or p_role_interest not in ('all','producer','trader','processor','end_user')
    or p_language_code is null or p_language_code not in ('it','en')
    or p_product_interests is null or cardinality(p_product_interests)>6
    or array_position(p_product_interests,null) is not null
    or cardinality(p_product_interests)<>(select count(distinct x) from unnest(p_product_interests) as x)
    or not (p_product_interests <@ array[
      'round_tubes','hollow_sections','seamless_tubes','welded_tubes','stainless_steel','steel_processing'
    ]::text[])
    or p_territory_interests is null or cardinality(p_territory_interests)>8
    or array_position(p_territory_interests,null) is not null
    or cardinality(p_territory_interests)<>(select count(distinct x) from unnest(p_territory_interests) as x)
    or not (p_territory_interests <@ array[
      'italy','north_west','north_east','center','south','islands','europe','usa'
    ]::text[]) then
    raise exception 'DASH-FEED4 invalid interests' using errcode='22023';
  end if;
  v_topics := array(select x from unnest(p_topics) as x order by x);
  v_products := array(select x from unnest(p_product_interests) as x order by x);
  v_territories := array(select x from unnest(p_territory_interests) as x order by x);
  insert into steel_pulse_private.user_feed_preferences (
    user_id,topics,role_interest,language_code,product_interests,territory_interests,updated_at
  ) values (
    v_user,v_topics,p_role_interest,p_language_code,v_products,v_territories,now()
  )
  on conflict (user_id) do update set
    topics=excluded.topics,
    role_interest=excluded.role_interest,
    language_code=excluded.language_code,
    product_interests=excluded.product_interests,
    territory_interests=excluded.territory_interests,
    updated_at=now();
  return jsonb_build_object(
    'topics',to_jsonb(v_topics),
    'role_interest',p_role_interest,
    'language_code',p_language_code,
    'product_interests',to_jsonb(v_products),
    'territory_interests',to_jsonb(v_territories)
  );
end;
$$;
revoke all on function public.sp8_save_feed_preferences(text[],text,text,text[],text[])
  from public,anon,authenticated;
grant execute on function public.sp8_save_feed_preferences(text[],text,text,text[],text[])
  to authenticated;

-- Separate personal-preference read; SP5 still enforces news rights on every read.
-- Works even while news publication is disabled, for onboarding/configuration.
create function public.sp8_my_feed_interests()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_products text[] := '{}'::text[];
  v_territories text[] := '{}'::text[];
begin
  if (select auth.role()) is distinct from 'authenticated' or v_user is null then
    raise exception 'DASH-FEED4 authenticated user required' using errcode='42501';
  end if;
  select p.product_interests,p.territory_interests
    into v_products,v_territories
    from steel_pulse_private.user_feed_preferences p
    where p.user_id=v_user;
  return jsonb_build_object(
    'product_interests',to_jsonb(coalesce(v_products,'{}'::text[])),
    'territory_interests',to_jsonb(coalesce(v_territories,'{}'::text[]))
  );
end;
$$;
revoke all on function public.sp8_my_feed_interests()
  from public,anon,authenticated;
grant execute on function public.sp8_my_feed_interests()
  to authenticated;

comment on function public.sp8_my_feed_interests() is
'Own feed personalization hints only; neither authorization nor publishability evidence.';
