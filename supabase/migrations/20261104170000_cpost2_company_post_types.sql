-- =====================================================================
-- CPOST2 — Tipi di post delle aziende
-- Founder decision (4 Nov 2026): typed posts useful to the steel/tube trade.
--   * capacity  "Capacità disponibile" (first type)
--   * stock     "Materiale disponibile"
--   * news      "Novità aziendale" (existing posts become news)
--   * event     "Evento e fiera"
--   * capacity and stock expire after 30 days (capacity earlier when its
--     period ends sooner); events expire the day after they end; news never.
--   * "Chiedi un'offerta" on capacity/stock opens the RFQ page (no messaging
--     from the post: requests still leave only from the RFQ page).
-- The cpost1_* functions keep working and delegate to the cpost2_* ones.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------
alter table public.company_posts
  add column post_type text not null default 'news'
    check (post_type in ('capacity','stock','news','event')),
  add column details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 4096),
  add column expires_at timestamptz;

-- News must have text; typed posts may rely on their structured details.
alter table public.company_posts drop constraint company_posts_body_not_blank;
alter table public.company_posts add constraint company_posts_body_length check (
  char_length(body) <= 10000
  and (post_type <> 'news' or char_length(btrim(body)) >= 1)
);

create index company_posts_type_feed_idx
  on public.company_posts (post_type, created_at desc, id desc) where status = 'published';

-- ---------------------------------------------------------------------
-- 2. Details validation (one place, used by create and edit)
-- ---------------------------------------------------------------------
create function private.cpost2_text(p_details jsonb, p_key text, p_max integer, p_required boolean)
returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_raw   jsonb := p_details -> p_key;
  v_value text;
begin
  if v_raw is not null and jsonb_typeof(v_raw) not in ('string','null') then
    raise exception 'invalid post detail: %', p_key using errcode = '22023';
  end if;
  v_value := nullif(btrim(coalesce(p_details ->> p_key, '')), '');
  if v_value is null and p_required then
    raise exception 'missing post detail: %', p_key using errcode = '22023';
  end if;
  if v_value is not null and char_length(v_value) > p_max then
    raise exception 'post detail too long: %', p_key using errcode = '22023';
  end if;
  return v_value;
end;
$$;

create function private.cpost2_date(p_details jsonb, p_key text, p_required boolean)
returns date
language plpgsql immutable set search_path = '' as $$
declare
  v_value text := nullif(btrim(coalesce(p_details ->> p_key, '')), '');
begin
  if v_value is null then
    if p_required then
      raise exception 'missing post detail: %', p_key using errcode = '22023';
    end if;
    return null;
  end if;
  if v_value !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'invalid post date: %', p_key using errcode = '22023';
  end if;
  return v_value::date;
exception when datetime_field_overflow or invalid_datetime_format then
  raise exception 'invalid post date: %', p_key using errcode = '22023';
end;
$$;

-- Returns the normalized details (only known keys) for a post type.
create function private.cpost2_normalize_details(p_post_type text, p_details jsonb)
returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_in    jsonb := coalesce(p_details, '{}'::jsonb);
  v_from  date;
  v_to    date;
  v_today date := (now() at time zone 'Europe/Rome')::date;
begin
  if jsonb_typeof(v_in) <> 'object' then
    raise exception 'post details must be an object' using errcode = '22023';
  end if;

  if p_post_type = 'news' then
    return '{}'::jsonb;

  elsif p_post_type = 'capacity' then
    if coalesce(v_in ->> 'process', '') not in
       ('taglio','curvatura','saldatura','laser','foratura','filettatura','zincatura',
        'verniciatura','trattamento_termico','lavorazione_meccanica','altro') then
      raise exception 'invalid capacity process' using errcode = '22023';
    end if;
    v_from := private.cpost2_date(v_in, 'available_from', false);
    v_to   := private.cpost2_date(v_in, 'available_to', false);
    if v_to is not null and v_to < v_today then
      raise exception 'capacity period already ended' using errcode = '22023';
    end if;
    if v_from is not null and v_to is not null and v_to < v_from then
      raise exception 'capacity period ends before it starts' using errcode = '22023';
    end if;
    return jsonb_strip_nulls(jsonb_build_object(
      'process',        v_in ->> 'process',
      'process_detail', private.cpost2_text(v_in, 'process_detail', 120, v_in ->> 'process' = 'altro'),
      'available_from', v_from,
      'available_to',   v_to,
      'quantity',       private.cpost2_text(v_in, 'quantity', 80, false),
      'location',       private.cpost2_text(v_in, 'location', 120, false)
    ));

  elsif p_post_type = 'stock' then
    if v_in ? 'certificate_31' and jsonb_typeof(v_in -> 'certificate_31') <> 'boolean' then
      raise exception 'invalid post detail: certificate_31' using errcode = '22023';
    end if;
    return jsonb_strip_nulls(jsonb_build_object(
      'product',        private.cpost2_text(v_in, 'product', 120, true),
      'standard',       private.cpost2_text(v_in, 'standard', 60, false),
      'grade',          private.cpost2_text(v_in, 'grade', 60, false),
      'dimensions',     private.cpost2_text(v_in, 'dimensions', 80, false),
      'quantity',       private.cpost2_text(v_in, 'quantity', 80, false),
      'location',       private.cpost2_text(v_in, 'location', 120, false),
      'certificate_31', case when (v_in -> 'certificate_31') = 'true'::jsonb then true end
    ));

  elsif p_post_type = 'event' then
    v_from := private.cpost2_date(v_in, 'date_from', true);
    v_to   := private.cpost2_date(v_in, 'date_to', false);
    if coalesce(v_to, v_from) < v_today then
      raise exception 'event already ended' using errcode = '22023';
    end if;
    if v_to is not null and v_to < v_from then
      raise exception 'event ends before it starts' using errcode = '22023';
    end if;
    return jsonb_strip_nulls(jsonb_build_object(
      'name',      private.cpost2_text(v_in, 'name', 120, true),
      'date_from', v_from,
      'date_to',   v_to,
      'location',  private.cpost2_text(v_in, 'location', 120, true),
      'stand',     private.cpost2_text(v_in, 'stand', 40, false)
    ));
  end if;

  raise exception 'invalid post type' using errcode = '22023';
end;
$$;

-- When a post leaves the feed on its own.
create function private.cpost2_expires_at(p_post_type text, p_details jsonb, p_created_at timestamptz)
returns timestamptz
language sql stable set search_path = '' as $$
  select case p_post_type
    when 'stock' then p_created_at + interval '30 days'
    when 'capacity' then least(
      p_created_at + interval '30 days',
      coalesce(((p_details ->> 'available_to')::date + 1)::timestamp at time zone 'Europe/Rome', 'infinity'::timestamptz))
    when 'event' then
      ((coalesce(p_details ->> 'date_to', p_details ->> 'date_from'))::date + 1)::timestamp at time zone 'Europe/Rome'
    else null
  end;
$$;

revoke all on function private.cpost2_text(jsonb, text, integer, boolean) from public, anon, authenticated;
revoke all on function private.cpost2_date(jsonb, text, boolean) from public, anon, authenticated;
revoke all on function private.cpost2_normalize_details(text, jsonb) from public, anon, authenticated;
revoke all on function private.cpost2_expires_at(text, jsonb, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Create (typed) — cpost1_create_post becomes a "news" shortcut
-- ---------------------------------------------------------------------
create function private.cpost2_create_post_impl(
  p_organization_id uuid, p_post_type text, p_body text, p_details jsonb default '{}'::jsonb,
  p_language_code text default 'it')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_ctx     jsonb;
  v_set     private.cpost1_settings%rowtype;
  v_body    text := btrim(coalesce(p_body, ''));
  v_details jsonb;
  v_count   integer;
  v_id      uuid;
  v_now     timestamptz := now();
begin
  v_ctx := private.cpost1_publish_context(p_organization_id);
  if not (v_ctx->>'can_publish')::boolean then
    raise exception 'cannot publish: %', v_ctx->>'reason' using errcode = '42501';
  end if;

  select * into v_set from private.cpost1_settings where singleton;

  if p_post_type is null or p_post_type not in ('capacity','stock','news','event') then
    raise exception 'invalid post type' using errcode = '22023';
  end if;
  if p_post_type = 'news' and char_length(v_body) = 0 then
    raise exception 'post body is empty' using errcode = '22023';
  end if;
  if char_length(v_body) > v_set.max_body_chars then
    raise exception 'post body exceeds % characters', v_set.max_body_chars using errcode = '22023';
  end if;
  if coalesce(p_language_code, 'it') !~ '^[a-z]{2}$' then
    raise exception 'invalid language code' using errcode = '22023';
  end if;
  v_details := private.cpost2_normalize_details(p_post_type, p_details);

  -- Daily cap per organization, shared by every post type.
  perform pg_advisory_xact_lock(hashtextextended('cpost1:' || p_organization_id::text, 0));
  select count(*) into v_count
  from public.company_posts p
  where p.organization_id = p_organization_id
    and p.created_at >= v_now - interval '24 hours';
  if v_count >= v_set.max_posts_per_org_per_day then
    raise exception 'daily post limit reached' using errcode = '54000';
  end if;

  insert into public.company_posts (
    organization_id, network_company_id, author_user_id, body, language_code,
    post_type, details, expires_at, created_at, updated_at)
  values (
    p_organization_id, (v_ctx->>'network_company_id')::uuid, (v_ctx->>'user_id')::uuid,
    v_body, coalesce(p_language_code, 'it'),
    p_post_type, v_details, private.cpost2_expires_at(p_post_type, v_details, v_now), v_now, v_now)
  returning id into v_id;

  insert into public.company_post_events (post_id, event_type, actor_user_id, actor_organization_id, metadata)
  values (v_id, 'published', (v_ctx->>'user_id')::uuid, p_organization_id,
          jsonb_build_object('post_type', p_post_type));

  return jsonb_build_object('post_id', v_id, 'status', 'published', 'post_type', p_post_type);
end;
$$;

create or replace function private.cpost1_create_post_impl(
  p_organization_id uuid, p_body text, p_language_code text default 'it')
returns jsonb
language sql security definer set search_path = '' as $$
  select private.cpost2_create_post_impl(p_organization_id, 'news', p_body, '{}'::jsonb, p_language_code);
$$;

-- ---------------------------------------------------------------------
-- 4. Edit (author only): text and details; the type and the expiry stay
-- ---------------------------------------------------------------------
create function private.cpost2_edit_post_impl(p_post_id uuid, p_body text, p_details jsonb default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user    uuid := (select auth.uid());
  v_post    public.company_posts%rowtype;
  v_ctx     jsonb;
  v_max     integer;
  v_body    text := btrim(coalesce(p_body, ''));
  v_details jsonb;
begin
  select * into v_post from public.company_posts where id = p_post_id for update;
  if not found then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  if v_post.author_user_id is distinct from v_user then
    raise exception 'only the author can edit this post' using errcode = '42501';
  end if;
  if v_post.status <> 'published' or (v_post.expires_at is not null and v_post.expires_at <= now()) then
    raise exception 'only published posts can be edited' using errcode = '22023';
  end if;

  v_ctx := private.cpost1_publish_context(v_post.organization_id);
  if not (v_ctx->>'can_publish')::boolean then
    raise exception 'cannot edit: %', v_ctx->>'reason' using errcode = '42501';
  end if;

  select s.max_body_chars into v_max from private.cpost1_settings s where s.singleton;
  if char_length(v_body) > v_max or (v_post.post_type = 'news' and char_length(v_body) = 0) then
    raise exception 'invalid post body length' using errcode = '22023';
  end if;
  v_details := case when p_details is null then v_post.details
                    else private.cpost2_normalize_details(v_post.post_type, p_details) end;

  if v_body = v_post.body and v_details = v_post.details then
    return jsonb_build_object('post_id', v_post.id, 'status', v_post.status, 'changed', false);
  end if;

  update public.company_posts
  set body = v_body, details = v_details, edited_at = now(), updated_at = now()
  where id = v_post.id;

  insert into public.company_post_events (post_id, event_type, actor_user_id, actor_organization_id, metadata)
  values (v_post.id, 'edited', v_user, v_post.organization_id,
          jsonb_build_object('previous_body', v_post.body, 'previous_details', v_post.details));

  return jsonb_build_object('post_id', v_post.id, 'status', 'published', 'changed', true);
end;
$$;

create or replace function private.cpost1_edit_post_impl(p_post_id uuid, p_body text)
returns jsonb
language sql security definer set search_path = '' as $$
  select private.cpost2_edit_post_impl(p_post_id, p_body, null);
$$;

-- ---------------------------------------------------------------------
-- 5. Feed: type filter, typed fields, expired posts leave the feed
-- ---------------------------------------------------------------------
create function private.cpost2_feed_impl(
  p_limit integer default 20,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_network_company_id uuid default null,
  p_post_type text default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user  uuid := (select auth.uid());
  v_org   uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_items jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  v_org := private.cpost1_viewer_organization();
  if v_org is null then
    raise exception 'active organization membership required' using errcode = '42501';
  end if;
  if not exists (select 1 from private.cpost1_settings s where s.singleton and s.enabled) then
    return jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null);
  end if;
  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception 'cursor requires both created_at and id' using errcode = '22023';
  end if;
  if p_post_type is not null and p_post_type not in ('capacity','stock','news','event') then
    raise exception 'invalid post type' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(to_jsonb(z) order by z.created_at desc, z.id desc), '[]'::jsonb)
  into v_items
  from (
    select
      p.id,
      p.post_type,
      p.body,
      p.details,
      p.language_code,
      p.created_at,
      p.edited_at,
      p.expires_at,
      nc.id                                    as network_company_id,
      coalesce(nc.trading_name, nc.legal_name) as company_name,
      nc.logo_path                             as company_logo_path,
      true                                     as company_verified,
      (p.organization_id = v_org)              as is_own_company,
      (p.author_user_id = v_user)              as is_mine,
      exists (select 1 from public.company_post_reports r
              where r.post_id = p.id and r.reporter_user_id = v_user) as reported_by_me
    from public.company_posts p
    join public.network_companies nc on nc.id = p.network_company_id
    where p.status = 'published'
      and (p.expires_at is null or p.expires_at > now())
      and nc.verification_status = 'verified'
      and nc.archived_at is null
      and (p_post_type is null or p.post_type = p_post_type)
      and (p_network_company_id is null or p.network_company_id = p_network_company_id)
      and (p_before_created_at is null
           or (p.created_at, p.id) < (p_before_created_at, p_before_id))
    order by p.created_at desc, p.id desc
    limit v_limit
  ) z;

  return jsonb_build_object(
    'items', v_items,
    'next_cursor', case
      when jsonb_array_length(v_items) = v_limit then jsonb_build_object(
        'before_created_at', v_items -> (v_limit - 1) ->> 'created_at',
        'before_id',         v_items -> (v_limit - 1) ->> 'id')
      else null end
  );
end;
$$;

create or replace function private.cpost1_feed_impl(
  p_limit integer default 20,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_network_company_id uuid default null)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.cpost2_feed_impl(p_limit, p_before_created_at, p_before_id, p_network_company_id, null);
$$;

-- Reports only on posts still in the feed.
create or replace function private.cpost1_report_post_impl(
  p_post_id uuid, p_reason text, p_details text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user      uuid := (select auth.uid());
  v_org       uuid;
  v_post      public.company_posts%rowtype;
  v_details   text := nullif(btrim(coalesce(p_details, '')), '');
  v_threshold integer;
  v_orgs      integer;
  v_report    uuid;
  v_hidden    boolean := false;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  v_org := private.cpost1_viewer_organization();
  if v_org is null then
    raise exception 'active organization membership required' using errcode = '42501';
  end if;
  if p_reason not in ('spam','inappropriate','fraud_suspicious','other') then
    raise exception 'invalid report reason' using errcode = '22023';
  end if;
  if v_details is not null and char_length(v_details) > 2000 then
    raise exception 'report details exceed 2000 characters' using errcode = '22023';
  end if;

  select * into v_post from public.company_posts where id = p_post_id for update;
  if not found or v_post.status <> 'published' or (v_post.expires_at is not null and v_post.expires_at <= now()) then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  if v_post.organization_id = v_org then
    raise exception 'cannot report a post of your own company' using errcode = '22023';
  end if;

  insert into public.company_post_reports (post_id, reporter_organization_id, reporter_user_id, reason, details)
  values (v_post.id, v_org, v_user, p_reason, v_details)
  on conflict (post_id, reporter_user_id) do nothing
  returning id into v_report;

  if v_report is null then
    return jsonb_build_object('post_id', v_post.id, 'reported', true, 'duplicate', true);
  end if;

  insert into public.company_post_events (post_id, event_type, actor_user_id, actor_organization_id, metadata)
  values (v_post.id, 'reported', v_user, v_org,
          jsonb_build_object('report_id', v_report, 'reason', p_reason));

  select s.auto_hide_report_threshold into v_threshold from private.cpost1_settings s where s.singleton;
  select count(distinct r.reporter_organization_id) into v_orgs
  from public.company_post_reports r
  where r.post_id = v_post.id and r.status = 'open';

  update public.company_posts
  set report_count = report_count + 1,
      status = case when v_orgs >= v_threshold then 'hidden' else status end,
      updated_at = now()
  where id = v_post.id;

  if v_orgs >= v_threshold then
    v_hidden := true;
    insert into public.company_post_events (post_id, event_type, metadata)
    values (v_post.id, 'auto_hidden',
            jsonb_build_object('open_reporting_organizations', v_orgs, 'threshold', v_threshold));
  end if;

  return jsonb_build_object('post_id', v_post.id, 'reported', true, 'duplicate', false,
                            'auto_hidden', v_hidden);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Public wrappers (security invoker) and grants
-- ---------------------------------------------------------------------
create function public.cpost2_create_post(
  p_organization_id uuid, p_post_type text, p_body text,
  p_details jsonb default '{}'::jsonb, p_language_code text default 'it')
returns jsonb language sql set search_path = '' as
$$ select private.cpost2_create_post_impl(p_organization_id, p_post_type, p_body, p_details, p_language_code); $$;

create function public.cpost2_edit_post(p_post_id uuid, p_body text, p_details jsonb default null)
returns jsonb language sql set search_path = '' as
$$ select private.cpost2_edit_post_impl(p_post_id, p_body, p_details); $$;

create function public.cpost2_feed(
  p_limit integer default 20, p_before_created_at timestamptz default null,
  p_before_id uuid default null, p_network_company_id uuid default null, p_post_type text default null)
returns jsonb language sql stable set search_path = '' as
$$ select private.cpost2_feed_impl(p_limit, p_before_created_at, p_before_id, p_network_company_id, p_post_type); $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'private.cpost2_create_post_impl(uuid, text, text, jsonb, text)',
    'private.cpost2_edit_post_impl(uuid, text, jsonb)',
    'private.cpost2_feed_impl(integer, timestamptz, uuid, uuid, text)',
    'private.cpost1_create_post_impl(uuid, text, text)',
    'private.cpost1_edit_post_impl(uuid, text)',
    'private.cpost1_feed_impl(integer, timestamptz, uuid, uuid)',
    'private.cpost1_report_post_impl(uuid, text, text)',
    'public.cpost2_create_post(uuid, text, text, jsonb, text)',
    'public.cpost2_edit_post(uuid, text, jsonb)',
    'public.cpost2_feed(integer, timestamptz, uuid, uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
