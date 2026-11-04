-- =====================================================================
-- CPOST1 — Post delle aziende nel feed della Home (Steel Pulse)
-- Bozza da revisionare. NON applicata. Migrazione in produzione solo
-- con autorizzazione del founder.
--
-- Decisioni del founder (4 nov 2026):
--   * massimo 3 post al giorno per azienda, testo fino a 3000 caratteri
--   * nel post si mostra solo l'azienda, non la persona che lo ha scritto
--   * pubblicano admin e commerciali (sales_director, salesperson)
--   * solo aziende verificate (network_companies.verification_status='verified')
--   * solo testo nella prima versione
--   * pubblicazione immediata, con segnalazioni e moderazione dello staff
--
-- Pattern ripresi dal repository:
--   * tabelle con RLS attiva e nessun accesso diretto per anon/authenticated
--   * logica in private.cpost1_*_impl (security definer, search_path '')
--   * wrapper public.cpost1_* (security invoker) eseguibili solo da authenticated
--   * permessi staff in public.platform_permissions, ruolo network_trust_admin
--   * segnalazioni con lo stesso vocabolario di network_inquiry_reports
--   * interruttore generale spento: la funzione resta inerte finché lo staff
--     non imposta enabled=true
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Impostazioni (singleton, private)
-- ---------------------------------------------------------------------
create table private.cpost1_settings (
  singleton                    boolean primary key default true check (singleton),
  enabled                      boolean not null default false,
  max_body_chars               integer not null default 3000
                                 check (max_body_chars between 200 and 10000),
  max_posts_per_org_per_day    integer not null default 3
                                 check (max_posts_per_org_per_day between 1 and 100),
  auto_hide_report_threshold   integer not null default 3
                                 check (auto_hide_report_threshold between 1 and 50),
  updated_at                   timestamptz not null default now(),
  updated_by                   uuid references auth.users(id)
);
insert into private.cpost1_settings(singleton) values (true);
revoke all on private.cpost1_settings from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Post
-- ---------------------------------------------------------------------
create table public.company_posts (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  network_company_id   uuid not null references public.network_companies(id),
  author_user_id       uuid not null references auth.users(id),
  body                 text not null,
  language_code        text not null default 'it' check (language_code ~ '^[a-z]{2}$'),
  status               text not null default 'published'
                         check (status in ('published','hidden','removed','deleted')),
  -- hidden  = nascosto in attesa di revisione (automatico per segnalazioni o dallo staff)
  -- removed = rimosso dallo staff, definitivo
  -- deleted = cancellato dall'autore o da un admin dell'azienda
  report_count         integer not null default 0 check (report_count >= 0),
  edited_at            timestamptz,
  deleted_at           timestamptz,
  deleted_by           uuid references auth.users(id),
  moderated_at         timestamptz,
  moderated_by         uuid references auth.users(id),
  moderation_note      text check (moderation_note is null or char_length(moderation_note) <= 2000),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint company_posts_body_not_blank check (char_length(btrim(body)) between 1 and 10000),
  constraint company_posts_deleted_consistency check (
    (status = 'deleted') = (deleted_at is not null and deleted_by is not null)
  ),
  constraint company_posts_removed_requires_staff check (
    status <> 'removed' or (moderated_by is not null and moderated_at is not null)
  )
);

create index company_posts_feed_idx
  on public.company_posts (created_at desc, id desc) where status = 'published';
create index company_posts_company_idx
  on public.company_posts (network_company_id, created_at desc, id desc) where status = 'published';
create index company_posts_org_day_idx
  on public.company_posts (organization_id, created_at);
create index company_posts_author_idx       on public.company_posts (author_user_id);
create index company_posts_deleted_by_idx   on public.company_posts (deleted_by)   where deleted_by is not null;
create index company_posts_moderated_by_idx on public.company_posts (moderated_by) where moderated_by is not null;
create index company_posts_moderation_idx
  on public.company_posts (status, report_count desc, created_at desc) where status in ('published','hidden');

alter table public.company_posts enable row level security;
revoke all on public.company_posts from public, anon, authenticated;
create policy company_posts_explicit_deny on public.company_posts
  as restrictive for all to anon, authenticated using (false) with check (false);

-- ---------------------------------------------------------------------
-- 3. Segnalazioni
-- ---------------------------------------------------------------------
create table public.company_post_reports (
  id                        uuid primary key default gen_random_uuid(),
  post_id                   uuid not null references public.company_posts(id) on delete cascade,
  reporter_organization_id  uuid not null references public.organizations(id) on delete cascade,
  reporter_user_id          uuid not null references auth.users(id),
  reason                    text not null
                              check (reason in ('spam','inappropriate','fraud_suspicious','other')),
  details                   text check (details is null or char_length(details) <= 2000),
  status                    text not null default 'open'
                              check (status in ('open','resolved','dismissed')),
  created_at                timestamptz not null default now(),
  reviewed_by               uuid references auth.users(id),
  reviewed_at               timestamptz,
  resolution_note           text check (resolution_note is null or char_length(resolution_note) <= 2000),
  constraint company_post_reports_review_consistency check (
    (status = 'open' and reviewed_by is null and reviewed_at is null)
    or (status in ('resolved','dismissed') and reviewed_by is not null and reviewed_at is not null)
  ),
  constraint company_post_reports_one_per_user unique (post_id, reporter_user_id)
);

create index company_post_reports_open_idx
  on public.company_post_reports (post_id) where status = 'open';
create index company_post_reports_reporter_org_idx  on public.company_post_reports (reporter_organization_id);
create index company_post_reports_reporter_user_idx on public.company_post_reports (reporter_user_id);
create index company_post_reports_reviewed_by_idx   on public.company_post_reports (reviewed_by) where reviewed_by is not null;

alter table public.company_post_reports enable row level security;
revoke all on public.company_post_reports from public, anon, authenticated;
create policy company_post_reports_explicit_deny on public.company_post_reports
  as restrictive for all to anon, authenticated using (false) with check (false);

-- ---------------------------------------------------------------------
-- 4. Registro eventi (append-only)
-- ---------------------------------------------------------------------
create table public.company_post_events (
  id                     uuid primary key default gen_random_uuid(),
  post_id                uuid not null references public.company_posts(id) on delete cascade,
  event_type             text not null check (event_type in (
                           'published','edited','deleted',
                           'reported','auto_hidden',
                           'staff_hidden','staff_restored','staff_removed')),
  actor_user_id          uuid references auth.users(id),
  actor_organization_id  uuid references public.organizations(id) on delete set null,
  metadata               jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now()
);

create index company_post_events_post_idx      on public.company_post_events (post_id, created_at);
create index company_post_events_actor_idx     on public.company_post_events (actor_user_id) where actor_user_id is not null;
create index company_post_events_actor_org_idx on public.company_post_events (actor_organization_id) where actor_organization_id is not null;

alter table public.company_post_events enable row level security;
revoke all on public.company_post_events from public, anon, authenticated;
create policy company_post_events_explicit_deny on public.company_post_events
  as restrictive for all to anon, authenticated using (false) with check (false);

create function private.cpost1_events_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'company_post_events is append-only' using errcode = '42501';
end;
$$;
create trigger company_post_events_append_only
  before update on public.company_post_events
  for each row execute function private.cpost1_events_append_only();
-- Le modifiche sono bloccate a tutti. La cancellazione resta possibile solo
-- a cascata (organizzazione eliminata) o da service_role: i client non hanno
-- alcun privilegio sulla tabella.

-- ---------------------------------------------------------------------
-- 5. Permessi staff
-- ---------------------------------------------------------------------
insert into public.platform_permissions (permission_key, area, action, risk_level, description, is_root_only)
values
  ('network_trust.posts_read', 'network_trust', 'posts_read', 'low',
   'Leggere la coda di moderazione dei post delle aziende e le segnalazioni', false),
  ('network_trust.posts_moderate', 'network_trust', 'posts_moderate', 'high',
   'Nascondere, ripristinare o rimuovere post delle aziende e chiudere le segnalazioni', false);

insert into public.platform_role_permissions (role_key, permission_key)
values
  ('network_trust_admin', 'network_trust.posts_read'),
  ('network_trust_admin', 'network_trust.posts_moderate');

-- ---------------------------------------------------------------------
-- 6. Funzioni di supporto (non eseguibili dai client)
-- ---------------------------------------------------------------------

-- Contesto di pubblicazione: chi può scrivere per quale azienda.
create function private.cpost1_publish_context(p_organization_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user     uuid := (select auth.uid());
  v_role     text;
  v_business text;
  v_company  uuid;
  v_verif    text;
  v_enabled  boolean;
  v_reason   text;
begin
  if v_user is null then
    return jsonb_build_object('can_publish', false, 'reason', 'not_authenticated');
  end if;

  select s.enabled into v_enabled from private.cpost1_settings s where s.singleton;

  select m.role, m.business_role into v_role, v_business
  from public.organization_memberships m
  where m.organization_id = p_organization_id and m.user_id = v_user and m.status = 'active'
  limit 1;

  select l.network_company_id, nc.verification_status into v_company, v_verif
  from public.organization_network_company_links l
  join public.network_companies nc on nc.id = l.network_company_id
  where l.organization_id = p_organization_id and l.link_status = 'active'
  order by l.linked_at desc
  limit 1;

  v_reason := case
    when not coalesce(v_enabled, false)                    then 'feature_disabled'
    when v_role is null                                    then 'not_member'
    when not (v_role = 'admin'
              or v_business in ('sales_director','salesperson')) then 'role_not_allowed'
    when v_company is null                                 then 'no_company_profile'
    when v_verif is distinct from 'verified'               then 'company_not_verified'
    else null
  end;

  return jsonb_build_object(
    'can_publish',        v_reason is null,
    'reason',             v_reason,
    'network_company_id', v_company,
    'user_id',            v_user
  );
end;
$$;

-- Organizzazione attiva dell'utente per chi legge o segnala.
create function private.cpost1_viewer_organization()
returns uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id
  from public.organization_memberships m
  where m.user_id = (select auth.uid()) and m.status = 'active'
  order by m.is_default desc, m.created_at
  limit 1;
$$;

revoke all on function private.cpost1_publish_context(uuid)  from public, anon, authenticated;
revoke all on function private.cpost1_viewer_organization() from public, anon, authenticated;
revoke all on function private.cpost1_events_append_only()  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Funzioni per le aziende
-- ---------------------------------------------------------------------

-- 7.1 Posso pubblicare? (per mostrare o nascondere il compositore e il motivo)
create function private.cpost1_can_publish_impl(p_organization_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.cpost1_publish_context(p_organization_id) - 'user_id';
$$;

-- 7.2 Pubblica
create function private.cpost1_create_post_impl(
  p_organization_id uuid, p_body text, p_language_code text default 'it')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_ctx   jsonb;
  v_set   private.cpost1_settings%rowtype;
  v_body  text := btrim(coalesce(p_body, ''));
  v_count integer;
  v_id    uuid;
begin
  v_ctx := private.cpost1_publish_context(p_organization_id);
  if not (v_ctx->>'can_publish')::boolean then
    raise exception 'cannot publish: %', v_ctx->>'reason' using errcode = '42501';
  end if;

  select * into v_set from private.cpost1_settings where singleton;

  if char_length(v_body) = 0 then
    raise exception 'post body is empty' using errcode = '22023';
  end if;
  if char_length(v_body) > v_set.max_body_chars then
    raise exception 'post body exceeds % characters', v_set.max_body_chars using errcode = '22023';
  end if;
  if coalesce(p_language_code, 'it') !~ '^[a-z]{2}$' then
    raise exception 'invalid language code' using errcode = '22023';
  end if;

  -- Tetto giornaliero per organizzazione (serializzato per organizzazione)
  perform pg_advisory_xact_lock(hashtextextended('cpost1:' || p_organization_id::text, 0));
  select count(*) into v_count
  from public.company_posts p
  where p.organization_id = p_organization_id
    and p.created_at >= now() - interval '24 hours';
  if v_count >= v_set.max_posts_per_org_per_day then
    raise exception 'daily post limit reached' using errcode = '54000';
  end if;

  insert into public.company_posts (organization_id, network_company_id, author_user_id, body, language_code)
  values (p_organization_id, (v_ctx->>'network_company_id')::uuid, (v_ctx->>'user_id')::uuid,
          v_body, coalesce(p_language_code, 'it'))
  returning id into v_id;

  insert into public.company_post_events (post_id, event_type, actor_user_id, actor_organization_id)
  values (v_id, 'published', (v_ctx->>'user_id')::uuid, p_organization_id);

  return jsonb_build_object('post_id', v_id, 'status', 'published');
end;
$$;

-- 7.3 Modifica (solo l'autore, solo se pubblicato; il testo precedente resta nel registro)
create function private.cpost1_edit_post_impl(p_post_id uuid, p_body text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_post public.company_posts%rowtype;
  v_ctx  jsonb;
  v_max  integer;
  v_body text := btrim(coalesce(p_body, ''));
begin
  select * into v_post from public.company_posts where id = p_post_id for update;
  if not found then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  if v_post.author_user_id is distinct from v_user then
    raise exception 'only the author can edit this post' using errcode = '42501';
  end if;
  if v_post.status <> 'published' then
    raise exception 'only published posts can be edited' using errcode = '22023';
  end if;

  -- L'autore deve poter ancora pubblicare (ruolo, azienda verificata, funzione attiva)
  v_ctx := private.cpost1_publish_context(v_post.organization_id);
  if not (v_ctx->>'can_publish')::boolean then
    raise exception 'cannot edit: %', v_ctx->>'reason' using errcode = '42501';
  end if;

  select s.max_body_chars into v_max from private.cpost1_settings s where s.singleton;
  if char_length(v_body) = 0 or char_length(v_body) > v_max then
    raise exception 'invalid post body length' using errcode = '22023';
  end if;
  if v_body = v_post.body then
    return jsonb_build_object('post_id', v_post.id, 'status', v_post.status, 'changed', false);
  end if;

  update public.company_posts
  set body = v_body, edited_at = now(), updated_at = now()
  where id = v_post.id;

  insert into public.company_post_events (post_id, event_type, actor_user_id, actor_organization_id, metadata)
  values (v_post.id, 'edited', v_user, v_post.organization_id,
          jsonb_build_object('previous_body', v_post.body));

  return jsonb_build_object('post_id', v_post.id, 'status', 'published', 'changed', true);
end;
$$;

-- 7.4 Cancella (autore o admin dell'azienda; non annulla una rimozione dello staff)
create function private.cpost1_delete_post_impl(p_post_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_post public.company_posts%rowtype;
  v_is_admin boolean;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into v_post from public.company_posts where id = p_post_id for update;
  if not found then
    raise exception 'post not found' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = v_post.organization_id and m.user_id = v_user
      and m.status = 'active' and m.role = 'admin'
  ) into v_is_admin;

  if v_post.author_user_id is distinct from v_user and not v_is_admin then
    raise exception 'not allowed to delete this post' using errcode = '42501';
  end if;
  if v_post.status in ('deleted','removed') then
    raise exception 'post already %', v_post.status using errcode = '22023';
  end if;

  update public.company_posts
  set status = 'deleted', deleted_at = now(), deleted_by = v_user, updated_at = now()
  where id = v_post.id;

  insert into public.company_post_events (post_id, event_type, actor_user_id, actor_organization_id, metadata)
  values (v_post.id, 'deleted', v_user, v_post.organization_id,
          jsonb_build_object('previous_status', v_post.status));

  return jsonb_build_object('post_id', v_post.id, 'status', 'deleted');
end;
$$;

-- 7.5 Feed a scorrimento (paginazione a cursore created_at + id)
--     Mostra solo post pubblicati di aziende ancora verificate: se la spunta
--     viene revocata o scade, i post spariscono dal feed senza cambiare stato.
create function private.cpost1_feed_impl(
  p_limit integer default 20,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_network_company_id uuid default null)
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

  select coalesce(jsonb_agg(to_jsonb(z) order by z.created_at desc, z.id desc), '[]'::jsonb)
  into v_items
  from (
    select
      p.id,
      p.body,
      p.language_code,
      p.created_at,
      p.edited_at,
      nc.id                                  as network_company_id,
      coalesce(nc.trading_name, nc.legal_name) as company_name,
      nc.logo_path                           as company_logo_path,
      true                                   as company_verified,
      (p.organization_id = v_org)            as is_own_company,
      (p.author_user_id = v_user)            as is_mine,
      exists (select 1 from public.company_post_reports r
              where r.post_id = p.id and r.reporter_user_id = v_user) as reported_by_me
    from public.company_posts p
    join public.network_companies nc on nc.id = p.network_company_id
    where p.status = 'published'
      and nc.verification_status = 'verified'
      and nc.archived_at is null
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

-- 7.6 Segnala (una volta per utente; non sui post della propria azienda).
--     Al raggiungimento della soglia di organizzazioni diverse il post viene
--     nascosto in automatico e passa in revisione.
create function private.cpost1_report_post_impl(
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
  if not found or v_post.status <> 'published' then
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
-- 8. Funzioni per lo staff (console)
-- ---------------------------------------------------------------------

-- 8.1 Coda di moderazione: nascosti e pubblicati con segnalazioni aperte
create function private.cpost1_staff_queue_impl(p_limit integer default 50)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  perform private.require_platform_permission('network_trust.posts_read');

  return coalesce((
    select jsonb_agg(to_jsonb(z) order by z.status_rank, z.open_reports desc, z.created_at desc)
    from (
      select
        p.id, p.status, p.body, p.created_at, p.edited_at, p.report_count,
        p.organization_id, p.network_company_id,
        coalesce(nc.trading_name, nc.legal_name) as company_name,
        nc.verification_status,
        p.author_user_id,
        case p.status when 'hidden' then 0 else 1 end as status_rank,
        (select count(*) from public.company_post_reports r
          where r.post_id = p.id and r.status = 'open') as open_reports,
        (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', r.id, 'reason', r.reason, 'details', r.details,
                   'reporter_organization_id', r.reporter_organization_id,
                   'created_at', r.created_at) order by r.created_at), '[]'::jsonb)
           from public.company_post_reports r
          where r.post_id = p.id and r.status = 'open') as reports
      from public.company_posts p
      join public.network_companies nc on nc.id = p.network_company_id
      where p.status = 'hidden'
         or (p.status = 'published'
             and exists (select 1 from public.company_post_reports r
                         where r.post_id = p.id and r.status = 'open'))
      order by case p.status when 'hidden' then 0 else 1 end, p.created_at desc
      limit v_limit
    ) z
  ), '[]'::jsonb);
end;
$$;

-- 8.2 Decisione: hide | restore | remove. Chiude in blocco le segnalazioni aperte
--     (remove/hide → resolved, restore → dismissed).
create function private.cpost1_staff_moderate_post_impl(
  p_post_id uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user   uuid := (select auth.uid());
  v_post   public.company_posts%rowtype;
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
  v_status text;
  v_event  text;
  v_closed integer;
begin
  perform private.require_platform_permission('network_trust.posts_moderate');

  if p_decision not in ('hide','restore','remove') then
    raise exception 'invalid moderation decision' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'moderation note exceeds 2000 characters' using errcode = '22023';
  end if;

  select * into v_post from public.company_posts where id = p_post_id for update;
  if not found then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  if v_post.status in ('removed','deleted') then
    raise exception 'post is % and cannot be moderated', v_post.status using errcode = '22023';
  end if;

  v_status := case p_decision when 'hide' then 'hidden' when 'restore' then 'published' else 'removed' end;
  v_event  := case p_decision when 'hide' then 'staff_hidden' when 'restore' then 'staff_restored' else 'staff_removed' end;

  if p_decision = 'remove' and v_note is null then
    raise exception 'a note is required to remove a post' using errcode = '22023';
  end if;

  update public.company_posts
  set status = v_status, moderated_by = v_user, moderated_at = now(),
      moderation_note = v_note, updated_at = now()
  where id = v_post.id;

  update public.company_post_reports
  set status = case when p_decision = 'restore' then 'dismissed' else 'resolved' end,
      reviewed_by = v_user, reviewed_at = now(), resolution_note = v_note
  where post_id = v_post.id and status = 'open';
  get diagnostics v_closed = row_count;

  insert into public.company_post_events (post_id, event_type, actor_user_id, metadata)
  values (v_post.id, v_event, v_user,
          jsonb_build_object('previous_status', v_post.status, 'note', v_note,
                             'reports_closed', v_closed));

  return jsonb_build_object('post_id', v_post.id, 'status', v_status, 'reports_closed', v_closed);
end;
$$;

-- 8.3 Interruttore e parametri (solo superadmin)
create function private.cpost1_staff_update_settings_impl(
  p_enabled boolean default null,
  p_max_body_chars integer default null,
  p_max_posts_per_org_per_day integer default null,
  p_auto_hide_report_threshold integer default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_row private.cpost1_settings%rowtype;
begin
  if (select auth.uid()) is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode = '42501';
  end if;

  update private.cpost1_settings
  set enabled                    = coalesce(p_enabled, enabled),
      max_body_chars             = coalesce(p_max_body_chars, max_body_chars),
      max_posts_per_org_per_day  = coalesce(p_max_posts_per_org_per_day, max_posts_per_org_per_day),
      auto_hide_report_threshold = coalesce(p_auto_hide_report_threshold, auto_hide_report_threshold),
      updated_at = now(), updated_by = (select auth.uid())
  where singleton
  returning * into v_row;

  return to_jsonb(v_row) - 'singleton';
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Wrapper pubblici (security invoker) e permessi di esecuzione
-- ---------------------------------------------------------------------
create function public.cpost1_can_publish(p_organization_id uuid)
returns jsonb language sql stable set search_path = '' as
$$ select private.cpost1_can_publish_impl(p_organization_id); $$;

create function public.cpost1_create_post(p_organization_id uuid, p_body text, p_language_code text default 'it')
returns jsonb language sql set search_path = '' as
$$ select private.cpost1_create_post_impl(p_organization_id, p_body, p_language_code); $$;

create function public.cpost1_edit_post(p_post_id uuid, p_body text)
returns jsonb language sql set search_path = '' as
$$ select private.cpost1_edit_post_impl(p_post_id, p_body); $$;

create function public.cpost1_delete_post(p_post_id uuid)
returns jsonb language sql set search_path = '' as
$$ select private.cpost1_delete_post_impl(p_post_id); $$;

create function public.cpost1_feed(
  p_limit integer default 20, p_before_created_at timestamptz default null,
  p_before_id uuid default null, p_network_company_id uuid default null)
returns jsonb language sql stable set search_path = '' as
$$ select private.cpost1_feed_impl(p_limit, p_before_created_at, p_before_id, p_network_company_id); $$;

create function public.cpost1_report_post(p_post_id uuid, p_reason text, p_details text default null)
returns jsonb language sql set search_path = '' as
$$ select private.cpost1_report_post_impl(p_post_id, p_reason, p_details); $$;

create function public.cpost1_staff_queue(p_limit integer default 50)
returns jsonb language sql stable set search_path = '' as
$$ select private.cpost1_staff_queue_impl(p_limit); $$;

create function public.cpost1_staff_moderate_post(p_post_id uuid, p_decision text, p_note text default null)
returns jsonb language sql set search_path = '' as
$$ select private.cpost1_staff_moderate_post_impl(p_post_id, p_decision, p_note); $$;

create function public.cpost1_staff_update_settings(
  p_enabled boolean default null, p_max_body_chars integer default null,
  p_max_posts_per_org_per_day integer default null, p_auto_hide_report_threshold integer default null)
returns jsonb language sql set search_path = '' as
$$ select private.cpost1_staff_update_settings_impl(p_enabled, p_max_body_chars,
          p_max_posts_per_org_per_day, p_auto_hide_report_threshold); $$;

-- Come per selfver1: impl e wrapper eseguibili solo da authenticated;
-- ogni impl applica i propri controlli (membership, ruolo, permesso staff).
do $$
declare
  f text;
begin
  foreach f in array array[
    'private.cpost1_can_publish_impl(uuid)',
    'private.cpost1_create_post_impl(uuid, text, text)',
    'private.cpost1_edit_post_impl(uuid, text)',
    'private.cpost1_delete_post_impl(uuid)',
    'private.cpost1_feed_impl(integer, timestamptz, uuid, uuid)',
    'private.cpost1_report_post_impl(uuid, text, text)',
    'private.cpost1_staff_queue_impl(integer)',
    'private.cpost1_staff_moderate_post_impl(uuid, text, text)',
    'private.cpost1_staff_update_settings_impl(boolean, integer, integer, integer)',
    'public.cpost1_can_publish(uuid)',
    'public.cpost1_create_post(uuid, text, text)',
    'public.cpost1_edit_post(uuid, text)',
    'public.cpost1_delete_post(uuid)',
    'public.cpost1_feed(integer, timestamptz, uuid, uuid)',
    'public.cpost1_report_post(uuid, text, text)',
    'public.cpost1_staff_queue(integer)',
    'public.cpost1_staff_moderate_post(uuid, text, text)',
    'public.cpost1_staff_update_settings(boolean, integer, integer, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
