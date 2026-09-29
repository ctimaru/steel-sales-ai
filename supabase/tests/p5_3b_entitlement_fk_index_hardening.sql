-- P5.3b — Entitlement FK Index Hardening acceptance.

begin;

create or replace function pg_temp.p53b_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P5.3b assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.p53b_assert(
  to_regclass('public.marketplace_entitlement_events_request_idx') is not null,
  'request FK index must exist'
);

select pg_temp.p53b_assert(
  to_regclass('public.marketplace_entitlement_events_actor_user_idx') is not null,
  'actor user FK index must exist'
);

select pg_temp.p53b_assert(
  to_regclass('public.marketplace_unlocks_entitlement_event_idx') is not null,
  'unlock entitlement event FK index must exist'
);

select pg_temp.p53b_assert(
  to_regclass('public.marketplace_unlocks_unlocked_by_user_idx') is not null,
  'unlock user FK index must exist'
);

rollback;
