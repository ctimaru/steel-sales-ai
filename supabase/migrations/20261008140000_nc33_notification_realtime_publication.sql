-- NC3.3 — limited Postgres Changes invalidation only.
-- Publication contains only per-recipient rows protected by NC2.1 SELECT RLS.
-- No source payloads, workspace events, Platform events, outboxes, or bridge queues.
do $nc33$
begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime' and not puballtables) then
    raise exception using errcode='0A000',message='dedicated Supabase Realtime publication required';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='workspace_notification_recipients'
  ) then
    execute 'alter publication supabase_realtime add table public.workspace_notification_recipients';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='platform_notification_recipients'
  ) then
    execute 'alter publication supabase_realtime add table public.platform_notification_recipients';
  end if;
end
$nc33$;

-- Keep default replica identity (primary-key only for UPDATE/DELETE).
-- The client must treat the change as an invalidation signal, never as data.
