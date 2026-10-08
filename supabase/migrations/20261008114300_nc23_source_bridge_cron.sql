-- NC2.3: poll reference queue every five minutes using a backend-only role.
-- No HTTP, email, push, external secrets or RLS-bypassing public RPC.
-- pg_cron runs this command as the DB job owner; SET LOCAL ROLE gives the
-- strictly limited service identity expected by NC2.2 and NC2.3.
select cron.schedule(
 'nc23-notification-source-bridges',
 '*/5 * * * *',
 $job$
 begin;
 set local role service_role;
 select public.nc23_process_source_bridge_batch(50);
 commit;
 $job$
);
