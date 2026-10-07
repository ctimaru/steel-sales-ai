-- MKT1 — Marketing investor scope
-- Reuses the existing isolated investor invite/session model. No new public tables.

alter table public.investor_business_plan_invites
  drop constraint if exists investor_business_plan_invites_scopes_check;

alter table public.investor_business_plan_invites
  add constraint investor_business_plan_invites_scopes_check
  check (
    cardinality(scopes) >= 1
    and scopes <@ array['business_plan','marketing','kpi']::text[]
  );

create or replace function investor_private.l272d2_create_investor_access_invite_impl(
  p_label text,
  p_investor_email text,
  p_password text,
  p_expires_at timestamptz,
  p_scopes text[]
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
  v_scopes text[];
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

  select coalesce(array_agg(distinct scope order by scope), '{}'::text[])
    into v_scopes
  from unnest(coalesce(p_scopes,'{}'::text[])) as scope_value(scope)
  where scope in ('business_plan','marketing','kpi');

  if cardinality(v_scopes) < 1
     or cardinality(v_scopes) <> cardinality(coalesce(p_scopes,'{}'::text[])) then
    raise exception 'At least one valid investor scope is required' using errcode='22023';
  end if;

  insert into public.investor_business_plan_invites(
    label,investor_email,password_hash,created_by,expires_at,scopes
  ) values (
    v_label,
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf',12)),
    v_actor,
    p_expires_at,
    v_scopes
  )
  returning id,share_token into v_id,v_share_token;

  insert into public.investor_business_plan_access_events(
    invite_id,event_type,actor_user_id,metadata
  ) values (
    v_id,'invite_created',v_actor,
    jsonb_build_object(
      'label',v_label,
      'investor_email',v_email,
      'expires_at',p_expires_at,
      'scopes',v_scopes
    )
  );

  return jsonb_build_object(
    'id',v_id,
    'share_token',v_share_token,
    'label',v_label,
    'investor_email',v_email,
    'expires_at',p_expires_at,
    'scopes',to_jsonb(v_scopes)
  );
end;
$function$;

create or replace function investor_private.l272d2_update_investor_access_scopes_impl(
  p_invite_id uuid,
  p_scopes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_scopes text[];
  v_row public.investor_business_plan_invites;
begin
  if not private.is_platform_superadmin() then
    raise exception 'Platform Owner required' using errcode='42501';
  end if;

  select coalesce(array_agg(distinct scope order by scope), '{}'::text[])
    into v_scopes
  from unnest(coalesce(p_scopes,'{}'::text[])) as scope_value(scope)
  where scope in ('business_plan','marketing','kpi');

  if cardinality(v_scopes) < 1
     or cardinality(v_scopes) <> cardinality(coalesce(p_scopes,'{}'::text[])) then
    raise exception 'At least one valid investor scope is required' using errcode='22023';
  end if;

  update public.investor_business_plan_invites
  set scopes=v_scopes
  where id=p_invite_id
    and status='active'
    and expires_at>now()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Active investor invite not found' using errcode='P0002';
  end if;

  update public.investor_business_plan_sessions
  set revoked_at=coalesce(revoked_at,now())
  where invite_id=p_invite_id
    and revoked_at is null;

  insert into public.investor_business_plan_access_events(
    invite_id,event_type,actor_user_id,metadata
  ) values (
    p_invite_id,'invite_created',v_actor,
    jsonb_build_object('operation','scopes_updated','scopes',v_scopes)
  );

  return jsonb_build_object('id',v_row.id,'scopes',to_jsonb(v_scopes));
end;
$function$;
