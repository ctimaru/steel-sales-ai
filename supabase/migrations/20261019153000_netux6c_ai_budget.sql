-- NET-UX COMPACT6C: cost guard for authenticated Network AI conversations.
-- Hard bounds: 5 AI requests / UTC day / user, 60 / UTC day / project.
-- No content or input text is stored. RLS denies direct read/write access.
create table if not exists private.netux6c_ai_quota_user (
  day_utc date not null,
  user_id uuid not null,
  used integer not null default 0 check (used between 0 and 5),
  primary key(day_utc,user_id)
);
create table if not exists private.netux6c_ai_quota_global (
  day_utc date primary key,
  used integer not null default 0 check (used between 0 and 60)
);
alter table private.netux6c_ai_quota_user enable row level security;
alter table private.netux6c_ai_quota_global enable row level security;
revoke all on private.netux6c_ai_quota_user from public,anon,authenticated;
revoke all on private.netux6c_ai_quota_global from public,anon,authenticated;

create or replace function public.netux6c_claim_ai_budget()
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'UTC')::date;
  v_user_used integer;
  v_global_used integer;
begin
  if v_user is null or current_setting('role',true) <> 'authenticated' then
    return false;
  end if;
  -- Serialize daily accounting, including parallel serverless invocations.
  perform pg_catalog.pg_advisory_xact_lock(16062026);
  select used into v_user_used
    from private.netux6c_ai_quota_user
   where day_utc=v_day and user_id=v_user;
  select used into v_global_used
    from private.netux6c_ai_quota_global
   where day_utc=v_day;
  if coalesce(v_user_used,0)>=5 or coalesce(v_global_used,0)>=60 then
    return false;
  end if;
  insert into private.netux6c_ai_quota_user(day_utc,user_id,used)
  values(v_day,v_user,1)
  on conflict(day_utc,user_id) do update
    set used=private.netux6c_ai_quota_user.used+1;
  insert into private.netux6c_ai_quota_global(day_utc,used)
  values(v_day,1)
  on conflict(day_utc) do update
    set used=private.netux6c_ai_quota_global.used+1;
  return true;
end;
$function$;
revoke all on function public.netux6c_claim_ai_budget() from public,anon;
grant execute on function public.netux6c_claim_ai_budget() to authenticated;
comment on function public.netux6c_claim_ai_budget() is
  'Bounded Network AI request counter; 5/day per auth user, 60/day project. No prompt content persisted.';
