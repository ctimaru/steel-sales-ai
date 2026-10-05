-- PL1.11 — allow lifecycle cascades while keeping pricing snapshots immutable to app users.

begin;

drop trigger if exists pricing_sessions_immutable on public.pricing_sessions;
create trigger pricing_sessions_immutable
before update on public.pricing_sessions
for each row execute function private.pl1_pricing_snapshot_immutable();

drop trigger if exists pricing_session_lines_immutable on public.pricing_session_lines;
create trigger pricing_session_lines_immutable
before update on public.pricing_session_lines
for each row execute function private.pl1_pricing_snapshot_immutable();

commit;
