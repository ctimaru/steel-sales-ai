-- L27.2A — ICP & Value Proposition / Investor Business Plan Room
-- Owner-only management + isolated external investor access.
-- Passwords are stored only as bcrypt hashes; external sessions use random
-- server-side token hashes and expire automatically.

create table public.investor_business_plan_invites (
  id uuid primary key default gen_random_uuid(),
  share_token uuid not null default gen_random_uuid(),
  label text not null,
  investor_email text null,
  password_hash text not null,
  status text not null default 'active',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_by uuid null references auth.users(id) on delete restrict,
  revoked_at timestamptz null,
  revoke_reason text null,
  failed_attempts integer not null default 0,
  locked_until timestamptz null,
  last_accessed_at timestamptz null,
  access_count bigint not null default 0,
  constraint investor_business_plan_invites_share_token_key unique (share_token),
  constraint investor_business_plan_invites_label_check check (btrim(label) <> ''),
  constraint investor_business_plan_invites_email_check check (
    investor_email is null or investor_email = lower(btrim(investor_email))
  ),
  constraint investor_business_plan_invites_status_check check (status in ('active','revoked')),
  constraint investor_business_plan_invites_expiry_check check (expires_at > created_at),
  constraint investor_business_plan_invites_failed_attempts_check check (failed_attempts >= 0),
  constraint investor_business_plan_invites_revoke_check check (
    (status='active' and revoked_by is null and revoked_at is null)
    or
    (status='revoked' and revoked_by is not null and revoked_at is not null)
  )
);

create index investor_business_plan_invites_status_expiry_idx
  on public.investor_business_plan_invites(status, expires_at);

create table public.investor_business_plan_sessions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.investor_business_plan_invites(id) on delete cascade,
  session_token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz null,
  access_count bigint not null default 0,
  constraint investor_business_plan_sessions_token_key unique(session_token_hash),
  constraint investor_business_plan_sessions_expiry_check check (expires_at > created_at),
  constraint investor_business_plan_sessions_access_count_check check (access_count >= 0)
);

create index investor_business_plan_sessions_invite_active_idx
  on public.investor_business_plan_sessions(invite_id, expires_at)
  where revoked_at is null;

create table public.investor_business_plan_access_events (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.investor_business_plan_invites(id) on delete cascade,
  session_id uuid null references public.investor_business_plan_sessions(id) on delete set null,
  event_type text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint investor_business_plan_access_events_type_check check (
    event_type in ('invite_created','invite_revoked','login_success','login_failure','session_logout')
  )
);

create index investor_business_plan_access_events_invite_idx
  on public.investor_business_plan_access_events(invite_id, occurred_at desc);

alter table public.investor_business_plan_invites enable row level security;
alter table public.investor_business_plan_sessions enable row level security;
alter table public.investor_business_plan_access_events enable row level security;

revoke all on table public.investor_business_plan_invites from public, anon, authenticated;
revoke all on table public.investor_business_plan_sessions from public, anon, authenticated;
revoke all on table public.investor_business_plan_access_events from public, anon, authenticated;

create or replace function public.l272a_investor_business_plan_invite_list()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when not private.is_platform_superadmin() then
      jsonb_build_object('allowed',false,'invites','[]'::jsonb)
    else
      jsonb_build_object(
        'allowed',true,
        'invites',
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id',i.id,
              'share_token',i.share_token,
              'label',i.label,
              'investor_email',i.investor_email,
              'status',
                case
                  when i.status='revoked' then 'revoked'
                  when i.expires_at <= now() then 'expired'
                  else 'active'
                end,
              'created_at',i.created_at,
              'expires_at',i.expires_at,
              'revoked_at',i.revoked_at,
              'revoke_reason',i.revoke_reason,
              'failed_attempts',i.failed_attempts,
              'locked_until',i.locked_until,
              'last_accessed_at',i.last_accessed_at,
              'access_count',i.access_count
            )
            order by i.created_at desc
          ),
          '[]'::jsonb
        )
      )
  end
  from public.investor_business_plan_invites i;
$function$;

revoke execute on function public.l272a_investor_business_plan_invite_list() from public, anon;
grant execute on function public.l272a_investor_business_plan_invite_list() to authenticated;

create or replace function public.l272a_create_investor_business_plan_invite(
  p_label text,
  p_investor_email text,
  p_password text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_id uuid;
  v_share_token uuid;
  v_label text := btrim(coalesce(p_label,''));
  v_email text := nullif(lower(btrim(coalesce(p_investor_email,''))),'');
begin
  if not private.is_platform_superadmin() then
    raise exception 'Platform Owner required' using errcode='42501';
  end if;
  if v_label='' then
    raise exception 'Invite label required' using errcode='22023';
  end if;
  if length(coalesce(p_password,'')) < 12 then
    raise exception 'Investor password must contain at least 12 characters' using errcode='22023';
  end if;
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '180 days' then
    raise exception 'Invite expiry must be between now and 180 days' using errcode='22023';
  end if;
  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Valid investor email required' using errcode='22023';
  end if;

  insert into public.investor_business_plan_invites(
    label,investor_email,password_hash,created_by,expires_at
  ) values (
    v_label,
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf',12)),
    v_actor,
    p_expires_at
  )
  returning id,share_token into v_id,v_share_token;

  insert into public.investor_business_plan_access_events(
    invite_id,event_type,actor_user_id,metadata
  ) values (
    v_id,'invite_created',v_actor,
    jsonb_build_object('label',v_label,'investor_email',v_email,'expires_at',p_expires_at)
  );

  return jsonb_build_object(
    'id',v_id,
    'share_token',v_share_token,
    'label',v_label,
    'investor_email',v_email,
    'expires_at',p_expires_at
  );
end;
$function$;

revoke execute on function public.l272a_create_investor_business_plan_invite(text,text,text,timestamptz) from public, anon;
grant execute on function public.l272a_create_investor_business_plan_invite(text,text,text,timestamptz) to authenticated;

create or replace function public.l272a_revoke_investor_business_plan_invite(
  p_invite_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_row public.investor_business_plan_invites;
begin
  if not private.is_platform_superadmin() then
    raise exception 'Platform Owner required' using errcode='42501';
  end if;

  update public.investor_business_plan_invites i
  set status='revoked',
      revoked_by=v_actor,
      revoked_at=now(),
      revoke_reason=nullif(btrim(coalesce(p_reason,'')),'')
  where i.id=p_invite_id
    and i.status='active'
  returning i.* into v_row;

  if v_row.id is null then
    raise exception 'Active investor invite not found' using errcode='P0002';
  end if;

  update public.investor_business_plan_sessions
  set revoked_at=coalesce(revoked_at,now())
  where invite_id=p_invite_id and revoked_at is null;

  insert into public.investor_business_plan_access_events(
    invite_id,event_type,actor_user_id,metadata
  ) values (
    p_invite_id,'invite_revoked',v_actor,
    jsonb_build_object('reason',nullif(btrim(coalesce(p_reason,'')),''))
  );

  return jsonb_build_object('id',v_row.id,'status','revoked');
end;
$function$;

revoke execute on function public.l272a_revoke_investor_business_plan_invite(uuid,text) from public, anon;
grant execute on function public.l272a_revoke_investor_business_plan_invite(uuid,text) to authenticated;

create or replace function public.l272a_investor_business_plan_login(
  p_share_token uuid,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invite public.investor_business_plan_invites;
  v_session_id uuid;
  v_session_token text;
  v_session_hash text;
  v_session_expires_at timestamptz;
  v_failed integer;
begin
  select * into v_invite
  from public.investor_business_plan_invites i
  where i.share_token=p_share_token
  for update;

  if v_invite.id is null or v_invite.status <> 'active' or v_invite.expires_at <= now() then
    return jsonb_build_object('ok',false,'code','access_denied');
  end if;

  if v_invite.locked_until is not null and v_invite.locked_until > now() then
    return jsonb_build_object('ok',false,'code','locked');
  end if;

  if extensions.crypt(coalesce(p_password,''),v_invite.password_hash) <> v_invite.password_hash then
    v_failed := v_invite.failed_attempts + 1;
    update public.investor_business_plan_invites
    set failed_attempts=v_failed,
        locked_until=case when v_failed >= 5 then now()+interval '15 minutes' else null end
    where id=v_invite.id;

    insert into public.investor_business_plan_access_events(invite_id,event_type,metadata)
    values (
      v_invite.id,'login_failure',
      jsonb_build_object('locked',v_failed >= 5,'failed_attempts',v_failed)
    );

    return jsonb_build_object(
      'ok',false,
      'code',case when v_failed >= 5 then 'locked' else 'access_denied' end
    );
  end if;

  v_session_token := encode(extensions.gen_random_bytes(32),'hex');
  v_session_hash := encode(extensions.digest(v_session_token,'sha256'),'hex');
  v_session_expires_at := least(v_invite.expires_at, now()+interval '12 hours');

  insert into public.investor_business_plan_sessions(
    invite_id,session_token_hash,expires_at
  ) values (v_invite.id,v_session_hash,v_session_expires_at)
  returning id into v_session_id;

  update public.investor_business_plan_invites
  set failed_attempts=0,
      locked_until=null,
      last_accessed_at=now(),
      access_count=access_count+1
  where id=v_invite.id;

  insert into public.investor_business_plan_access_events(
    invite_id,session_id,event_type,metadata
  ) values (
    v_invite.id,v_session_id,'login_success',
    jsonb_build_object('session_expires_at',v_session_expires_at)
  );

  return jsonb_build_object(
    'ok',true,
    'session_token',v_session_token,
    'session_expires_at',v_session_expires_at,
    'label',v_invite.label
  );
end;
$function$;

revoke execute on function public.l272a_investor_business_plan_login(uuid,text) from public;
grant execute on function public.l272a_investor_business_plan_login(uuid,text) to anon, authenticated;

create or replace function public.l272a_investor_business_plan_validate(
  p_share_token uuid,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session public.investor_business_plan_sessions;
  v_invite public.investor_business_plan_invites;
  v_hash text := encode(extensions.digest(coalesce(p_session_token,''),'sha256'),'hex');
begin
  select s.* into v_session
  from public.investor_business_plan_sessions s
  join public.investor_business_plan_invites i on i.id=s.invite_id
  where i.share_token=p_share_token
    and i.status='active'
    and i.expires_at>now()
    and s.session_token_hash=v_hash
    and s.revoked_at is null
    and s.expires_at>now()
  limit 1;

  if v_session.id is null then
    return jsonb_build_object('ok',false);
  end if;

  select * into v_invite
  from public.investor_business_plan_invites
  where id=v_session.invite_id;

  update public.investor_business_plan_sessions
  set last_seen_at=now(), access_count=access_count+1
  where id=v_session.id;

  update public.investor_business_plan_invites
  set last_accessed_at=now()
  where id=v_invite.id;

  return jsonb_build_object(
    'ok',true,
    'label',v_invite.label,
    'session_expires_at',v_session.expires_at
  );
end;
$function$;

revoke execute on function public.l272a_investor_business_plan_validate(uuid,text) from public;
grant execute on function public.l272a_investor_business_plan_validate(uuid,text) to anon, authenticated;

create or replace function public.l272a_investor_business_plan_logout(
  p_share_token uuid,
  p_session_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_hash text := encode(extensions.digest(coalesce(p_session_token,''),'sha256'),'hex');
  v_session_id uuid;
  v_invite_id uuid;
begin
  update public.investor_business_plan_sessions s
  set revoked_at=coalesce(s.revoked_at,now())
  from public.investor_business_plan_invites i
  where i.id=s.invite_id
    and i.share_token=p_share_token
    and s.session_token_hash=v_hash
    and s.revoked_at is null
  returning s.id,s.invite_id into v_session_id,v_invite_id;

  if v_session_id is null then return false; end if;

  insert into public.investor_business_plan_access_events(invite_id,session_id,event_type)
  values(v_invite_id,v_session_id,'session_logout');

  return true;
end;
$function$;

revoke execute on function public.l272a_investor_business_plan_logout(uuid,text) from public;
grant execute on function public.l272a_investor_business_plan_logout(uuid,text) to anon, authenticated;
