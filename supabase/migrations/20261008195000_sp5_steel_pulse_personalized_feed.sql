-- SP5 — user-owned, cross-tenant-independent Steel Pulse topic preferences.
-- None of this creates a publication source or enables news in production.
create table steel_pulse_private.user_feed_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  topics text[] not null default '{}'::text[],
  role_interest text not null default 'all'
    check (role_interest in ('all','producer','trader','processor','end_user')),
  language_code text not null default 'it' check (language_code in ('it','en')),
  updated_at timestamptz not null default now(),
  check (topics <@ array['market','trade','regulation','raw_materials','technology','companies']::text[]),
  check (cardinality(topics) <= 6),
  check (array_position(topics,null) is null)
);
alter table steel_pulse_private.user_feed_preferences enable row level security;
revoke all on steel_pulse_private.user_feed_preferences from public, anon, authenticated;
grant select,insert,update,delete on steel_pulse_private.user_feed_preferences to service_role;

-- One authenticated caller writes only their own interests. No organization id,
-- tenant role inference, commercial activity, email address or RFQ-derived fields.
create function public.sp5_save_feed_preferences(
  p_topics text[], p_role_interest text default 'all',p_language_code text default 'it'
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid := (select auth.uid());
        v_topics text[];
begin
  if (select auth.role()) is distinct from 'authenticated' or v_user is null then
    raise exception 'SP5 authenticated user required' using errcode='42501';
  end if;
  if p_topics is null or cardinality(p_topics)>6
    or array_position(p_topics,null) is not null
    or cardinality(p_topics)<>(
      select count(distinct x) from unnest(p_topics) as x
    )
    or not (p_topics <@ array[
       'market','trade','regulation','raw_materials','technology','companies'
    ]::text[])
    or p_role_interest is null or p_role_interest not in
      ('all','producer','trader','processor','end_user')
    or p_language_code is null or p_language_code not in ('it','en') then
    raise exception 'SP5 invalid preferences' using errcode='22023';
  end if;
  v_topics := array(select x from unnest(p_topics) as x order by x);
  insert into steel_pulse_private.user_feed_preferences(
    user_id,topics,role_interest,language_code,updated_at
  ) values (v_user,v_topics,p_role_interest,p_language_code,now())
  on conflict(user_id) do update set
    topics=excluded.topics,role_interest=excluded.role_interest,
    language_code=excluded.language_code,updated_at=now();
  return jsonb_build_object(
    'topics',to_jsonb(v_topics),
    'role_interest',p_role_interest,'language_code',p_language_code
  );
end;
$$;
revoke all on function public.sp5_save_feed_preferences(text[],text,text)
  from public,anon,authenticated;
grant execute on function public.sp5_save_feed_preferences(text[],text,text)
  to authenticated;

-- User-specific read boundary: published and rights-current rows ONLY. Even
-- if a preference exists, the global SP4 kill switch blocks all news.
-- An empty topics array means "all topics"; explicit choices filter strictly.
-- Selected professional focus only ranks among those licensed items.
create function public.sp5_my_steel_pulse_feed(p_limit integer default 12)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_user uuid := (select auth.uid());
        v_topics text[] := '{}'::text[];
        v_role text := 'all';
        v_lang text := 'it';
        v_items jsonb := '[]'::jsonb;
begin
  if (select auth.role()) is distinct from 'authenticated' or v_user is null then
    raise exception 'SP5 authenticated user required' using errcode='42501';
  end if;
  select p.topics,p.role_interest,p.language_code
    into v_topics,v_role,v_lang
    from steel_pulse_private.user_feed_preferences p
    where p.user_id=v_user;
  if not found then
    v_topics := '{}'::text[];
    v_role := 'all';
    v_lang := 'it';
  end if;
  if p_limit is not null and p_limit between 1 and 12
    and exists(
      select 1 from steel_pulse_private.publication_settings x
      where x.singleton=true and x.enabled=true
    ) then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'headline',z.headline,
        'summary',z.summary,
        'relevance',z.relevance,
        'topic',z.topic,
        'language_code',z.language_code,
        'source_name',z.source_name,
        'source_url',z.canonical_url,
        'source_published_at',z.source_published_at
      ) order by z.professional_rank,z.published_at desc,z.canonical_url
    ),'[]'::jsonb) into v_items
    from (
      select f.headline,f.summary,f.relevance,f.topic,f.language_code,
         f.source_name,f.canonical_url,f.source_published_at,f.published_at,
         case
           when v_role='producer' and f.topic in ('raw_materials','market') then 0
           when v_role='trader' and f.topic in ('market','trade') then 0
           when v_role='processor' and f.topic in ('technology','raw_materials') then 0
           when v_role='end_user' and f.topic in ('market','technology') then 0
           else 1
         end as professional_rank
      from steel_pulse_private.sp3_currently_eligible_cards f
      where f.language_code=v_lang
        and (cardinality(v_topics)=0 or f.topic=any(v_topics))
      order by professional_rank,f.published_at desc,f.canonical_url
      limit p_limit
    ) z;
  end if;
  return jsonb_build_object(
    'preferences',jsonb_build_object(
      'topics',to_jsonb(v_topics),'role_interest',v_role,'language_code',v_lang
    ),
    'items',v_items
  );
end;
$$;
revoke all on function public.sp5_my_steel_pulse_feed(integer)
  from public,anon,authenticated;
grant execute on function public.sp5_my_steel_pulse_feed(integer)
  to authenticated;

comment on table steel_pulse_private.user_feed_preferences is
'User-owned Steel Pulse interests, isolated from organizations and commercial memory; SP5 RPC only.';
