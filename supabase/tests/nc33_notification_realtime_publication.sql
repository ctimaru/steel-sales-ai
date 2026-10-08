-- NC3.3 publication safety acceptance, rollback-only.
begin;
create or replace function pg_temp.nc33_assert(ok boolean,description text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'NC33: %',description; end if; end;
$$;
create or replace function pg_temp.nc33_denied(query text)
returns void language plpgsql as $$
begin
  begin execute query;
  exception when others then
    if sqlstate='42501' then return; end if;
    raise exception 'NC33 unexpected error %, %',sqlstate,sqlerrm;
  end;
  raise exception 'NC33 expected denied: %',query;
end;
$$;

select pg_temp.nc33_assert(
 (select count(*)=2 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
    and tablename in ('workspace_notification_recipients','platform_notification_recipients')),
 'both personal recipient tables published for invalidation');

select pg_temp.nc33_assert(
 not exists (
  select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
    and tablename in (
      'workspace_notification_events','workspace_notification_outbox',
      'platform_notification_events','platform_notification_outbox',
      'notification_source_bridge_queue','buyer_rfq_events',
      'platform_registration_events','worker_jobs','operational_alerts'
    )),
 'event, source, outbox and bridge tables must never be broadcast');

select pg_temp.nc33_assert(
 (select count(*)=2 from pg_class c join pg_namespace n on c.relnamespace=n.oid
  where n.nspname='public'
    and c.relname in ('workspace_notification_recipients','platform_notification_recipients')
    and c.relrowsecurity and c.relreplident='d'),
 'both published recipient tables keep RLS and default primary-key replica identity');

select pg_temp.nc33_assert(
 not has_table_privilege('anon','public.workspace_notification_recipients','SELECT')
 and not has_table_privilege('anon','public.platform_notification_recipients','SELECT')
 and has_table_privilege('authenticated','public.workspace_notification_recipients','SELECT')
 and has_table_privilege('authenticated','public.platform_notification_recipients','SELECT')
 and not has_table_privilege('authenticated','public.workspace_notification_recipients','INSERT,UPDATE,DELETE')
 and not has_table_privilege('authenticated','public.platform_notification_recipients','INSERT,UPDATE,DELETE'),
 'Realtime requires no new browser write permissions or anonymous reads');

select pg_temp.nc33_assert(
 (select count(*)=2 from pg_policies
  where schemaname='public' and tablename in
    ('workspace_notification_recipients','platform_notification_recipients')
    and cmd='SELECT'
    and qual like '%recipient_user_id%'
  ),
 'per-user SELECT RLS policies preserved for both Realtime tables');

set local role anon;
select pg_temp.nc33_denied('select count(*) from public.workspace_notification_recipients');
select pg_temp.nc33_denied('select count(*) from public.platform_notification_recipients');
reset role;
rollback;
