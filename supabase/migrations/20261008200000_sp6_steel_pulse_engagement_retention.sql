-- SP6 — explicit individual engagement only. No passive tracking or notifications.
create table steel_pulse_private.user_article_engagement (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references steel_pulse_private.editorial_cards(id) on delete cascade,
  saved_at timestamptz,
  read_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id),
  check (saved_at is not null or read_at is not null)
);
create index sp6_user_saved_lookup_idx
  on steel_pulse_private.user_article_engagement(user_id,saved_at desc)
  where saved_at is not null;
alter table steel_pulse_private.user_article_engagement enable row level security;
revoke all on steel_pulse_private.user_article_engagement
  from public,anon,authenticated;
grant select,insert,update,delete on steel_pulse_private.user_article_engagement to service_role;

-- Mutations are ALWAYS performed for auth.uid(), never an input user or tenant.
-- Rights and the global SP4 publication switch are rechecked at write time.
create function public.sp6_set_article_engagement(
  p_source_url text,p_action text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_card uuid;
  v_saved boolean;
  v_read boolean;
begin
  if (select auth.role()) is distinct from 'authenticated' or v_user is null then
    raise exception 'SP6 authenticated user required' using errcode='42501';
  end if;
  if p_source_url is null or char_length(p_source_url) not between 12 and 2048
    or p_source_url !~ '^https://[^[:space:]?#]+$'
    or p_action is null or p_action not in ('save','unsave','read','unread') then
    raise exception 'SP6 invalid engagement request' using errcode='22023';
  end if;
  if not exists (
    select 1 from steel_pulse_private.publication_settings p
    where p.singleton=true and p.enabled=true
  ) then
    raise exception 'SP6 feed disabled' using errcode='42501';
  end if;
  select f.id into v_card
  from steel_pulse_private.sp3_currently_eligible_cards f
  where f.canonical_url=p_source_url
  limit 1;
  if v_card is null then
    raise exception 'SP6 article not available' using errcode='42501';
  end if;

  if p_action in ('save','read') then
    insert into steel_pulse_private.user_article_engagement
      (user_id,card_id,saved_at,read_at,updated_at)
    values(
      v_user,v_card,
      case when p_action='save' then now() else null end,
      case when p_action='read' then now() else null end,
      now()
    )
    on conflict(user_id,card_id) do update set
      saved_at=case when p_action='save' then
        coalesce(steel_pulse_private.user_article_engagement.saved_at,now())
        else steel_pulse_private.user_article_engagement.saved_at end,
      read_at=case when p_action='read' then
        coalesce(steel_pulse_private.user_article_engagement.read_at,now())
        else steel_pulse_private.user_article_engagement.read_at end,
      updated_at=now();
  else
    update steel_pulse_private.user_article_engagement as e set
      saved_at=case when p_action='unsave' then null else saved_at end,
      read_at=case when p_action='unread' then null else read_at end,
      updated_at=now()
    where e.user_id=v_user and e.card_id=v_card;
    delete from steel_pulse_private.user_article_engagement e
      where e.user_id=v_user and e.card_id=v_card
        and e.saved_at is null and e.read_at is null;
  end if;

  select e.saved_at is not null,e.read_at is not null
    into v_saved,v_read
  from steel_pulse_private.user_article_engagement e
  where e.user_id=v_user and e.card_id=v_card;
  return jsonb_build_object(
    'saved',coalesce(v_saved,false),
    'read',coalesce(v_read,false)
  );
end;
$$;
revoke all on function public.sp6_set_article_engagement(text,text)
  from public,anon,authenticated;
grant execute on function public.sp6_set_article_engagement(text,text) to authenticated;

-- Visibility and rights are re-evaluated on every request. Even previously
-- saved articles are unavailable after revocation, expiration or withdrawal.
create function public.sp6_my_article_engagement(p_limit integer default 12)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_result jsonb := '[]'::jsonb;
  v_saved_urls jsonb := '[]'::jsonb;
  v_read_urls jsonb := '[]'::jsonb;
begin
  if (select auth.role()) is distinct from 'authenticated' or v_user is null then
    raise exception 'SP6 authenticated user required' using errcode='42501';
  end if;
  if p_limit is null or p_limit not between 1 and 12 then
    raise exception 'SP6 invalid limit' using errcode='22023';
  end if;
  if not exists(
    select 1 from steel_pulse_private.publication_settings p
    where p.singleton=true and p.enabled=true
  ) then
    return jsonb_build_object('saved_items',v_result,'saved_urls',v_saved_urls,'read_urls',v_read_urls);
  end if;

  -- Scope all engagement signals to currently publishable cards, only the
  -- current user's state, never to a company id or another user's preference.
  select
    coalesce(jsonb_agg(f.canonical_url) filter(where e.saved_at is not null),'[]'::jsonb),
    coalesce(jsonb_agg(f.canonical_url) filter(where e.read_at is not null),'[]'::jsonb)
    into v_saved_urls,v_read_urls
  from steel_pulse_private.user_article_engagement e
  join steel_pulse_private.sp3_currently_eligible_cards f on f.id=e.card_id
  where e.user_id=v_user;

  select coalesce(jsonb_agg(to_jsonb(z) order by z.saved_at desc,z.source_url),'[]'::jsonb)
  into v_result
  from (
    select f.headline,f.summary,f.relevance,f.topic,f.language_code,
      f.source_name,f.canonical_url as source_url,
      f.source_published_at,e.saved_at
    from steel_pulse_private.user_article_engagement e
    join steel_pulse_private.sp3_currently_eligible_cards f on f.id=e.card_id
    where e.user_id=v_user and e.saved_at is not null
    order by e.saved_at desc,f.canonical_url
    limit p_limit
  ) z;

  -- saved_at is never returned publicly or to other users; remove it from
  -- card output but preserve sort order above.
  select coalesce(jsonb_agg(x.obj - 'saved_at' order by x.ord),'[]'::jsonb)
  into v_result
  from jsonb_array_elements(v_result) with ordinality as x(obj,ord);
  return jsonb_build_object(
    'saved_items',v_result,'saved_urls',v_saved_urls,'read_urls',v_read_urls
  );
end;
$$;
revoke all on function public.sp6_my_article_engagement(integer)
  from public,anon,authenticated;
grant execute on function public.sp6_my_article_engagement(integer) to authenticated;

-- Aggregate pilot KPI only: owner role and k-anonymity threshold. No user ids,
-- article URLs, individual timestamps, organizations or raw event exports.
create function public.sp6_platform_retention_summary()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_users integer := 0;
  v_savers integer := 0;
  v_readers integer := 0;
begin
  if (select auth.role()) is distinct from 'authenticated'
    or (select auth.uid()) is null
    or not private.is_platform_superadmin() then
    raise exception 'SP6 platform owner required' using errcode='42501';
  end if;
  select
    count(distinct e.user_id)::int,
    count(distinct e.user_id) filter(where e.saved_at is not null)::int,
    count(distinct e.user_id) filter(where e.read_at is not null)::int
  into v_users,v_savers,v_readers
  from steel_pulse_private.user_article_engagement e
  join steel_pulse_private.sp3_currently_eligible_cards f on f.id=e.card_id
  where e.updated_at >= now()-interval '30 days'
    and exists(
      select 1 from steel_pulse_private.publication_settings p
      where p.singleton=true and p.enabled=true
    );
  return jsonb_build_object(
    'window','30d','aggregation','distinct_accounts',
    'suppressed',v_users<5,
    'active_accounts',case when v_users>=5 then v_users else null end,
    'saved_accounts',case when v_users>=5 then v_savers else null end,
    'read_accounts',case when v_users>=5 then v_readers else null end
  );
end;
$$;
revoke all on function public.sp6_platform_retention_summary()
  from public,anon,authenticated;
grant execute on function public.sp6_platform_retention_summary()
  to authenticated;
