-- SP4 — Minimal public Steel Pulse read boundary. Disabled by default.
-- No anon grants to private schema/tables/views and no direct service role key in Next.js.
create table steel_pulse_private.publication_settings (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  changed_at timestamptz not null default now()
);
insert into steel_pulse_private.publication_settings(singleton,enabled) values(true,false);
alter table steel_pulse_private.publication_settings enable row level security;
revoke all on steel_pulse_private.publication_settings from public,anon,authenticated;
grant select,update on steel_pulse_private.publication_settings to service_role;

-- Anonymous read-only SECURITY DEFINER RPC: explicitly whitelisted fields only.
-- SP3 private view checks current source rights, withdrawal and expiry on each read.
-- Volatility STABLE and search_path='' required by HP13 anonymous function audit.
create function public.sp4_public_steel_pulse_feed(p_limit integer default 3)
returns jsonb
language sql stable security definer set search_path=''
as $$
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'headline',r.headline,
          'summary',r.summary,
          'relevance',r.relevance,
          'topic',r.topic,
          'language_code',r.language_code,
          'source_name',r.source_name,
          'source_url',r.canonical_url,
          'source_published_at',r.source_published_at
        ) order by r.published_at desc,r.canonical_url
      )
      from (
        select
          f.headline,f.summary,f.relevance,f.topic,f.language_code,
          f.source_name,f.canonical_url,f.source_published_at,f.published_at
        from steel_pulse_private.sp3_currently_eligible_cards f
        where p_limit between 1 and 3
          and exists(
            select 1 from steel_pulse_private.publication_settings s
            where s.singleton=true and s.enabled=true
          )
        order by f.published_at desc,f.canonical_url
        limit least(greatest(coalesce(p_limit,0),0),3)
      ) r
    ),
    '[]'::jsonb
  );
$$;
revoke all on function public.sp4_public_steel_pulse_feed(integer)
  from public,anon,authenticated;
grant execute on function public.sp4_public_steel_pulse_feed(integer)
  to anon,authenticated;

comment on function public.sp4_public_steel_pulse_feed(integer) is
'SP4 public read-only curated Steel Pulse news, off until explicit publication_settings enable; no tenancy or source rights metadata.';
