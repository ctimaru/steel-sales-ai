-- C.3 privilege candidate, for disposable testing only. NOT a production migration.
-- An eventual dedicated database login must be provisioned separately and audited.
-- Keep existing service_role grants until the application is migrated; do not open intake.
begin;
create role mkt9_intake_writer nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema public to mkt9_intake_writer;
grant insert(kind,locale,name,email,organization,notice_version,challenge_digest,email_verified_at)
 on public.mkt9_community_interest to mkt9_intake_writer;
grant select,insert,update(attempts),delete on public.mkt9_community_pending to mkt9_intake_writer;
grant select,insert on public.mkt9_community_rate to mkt9_intake_writer;
create policy mkt9_writer_insert on public.mkt9_community_interest
 for insert to mkt9_intake_writer with check (email_verified_at is not null);
create policy mkt9_writer_pending_select on public.mkt9_community_pending
 for select to mkt9_intake_writer using (true);
create policy mkt9_writer_pending_insert on public.mkt9_community_pending
 for insert to mkt9_intake_writer with check (true);
create policy mkt9_writer_pending_update on public.mkt9_community_pending
 for update to mkt9_intake_writer using (true) with check (true);
create policy mkt9_writer_pending_delete on public.mkt9_community_pending
 for delete to mkt9_intake_writer using (true);
create policy mkt9_writer_rate_select on public.mkt9_community_rate
 for select to mkt9_intake_writer using (true);
create policy mkt9_writer_rate_insert on public.mkt9_community_rate
 for insert to mkt9_intake_writer with check (true);
grant execute on function public.mkt9_reserve_email(uuid,text,text,text,jsonb),
 public.mkt9_confirm_email(uuid,text) to mkt9_intake_writer;
commit;
-- This role intentionally cannot read verified leads or alter their status.
-- It can read pending data (needed by SECURITY INVOKER RPCs).
-- Production PUBLIC grants, inherited privileges, role/login provisioning, connection
-- transport and all other schemas/functions must be audited before use.
-- No credentials, role membership, login, Data API role exposure or live changes here.
