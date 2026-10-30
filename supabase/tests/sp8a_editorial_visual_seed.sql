-- SP8.A synthetic local-only fixture, never execute against hosted Supabase.
\set ON_ERROR_STOP on
begin;
insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
values (:'owner_user_id'::uuid,'platform_superadmin','active',null,'SP8.A local visual fixture');
insert into public.user_legal_acceptances(user_id,subject_user_ref,privacy_notice_version,
 privacy_acknowledged_at,terms_version,terms_accepted_at,acceptance_source)
values
 (:'owner_user_id'::uuid,:'owner_user_id'::uuid,'2026-10-04-lr5-v1',now(),'2026-10-04-lr5-v1',now(),'account'),
 (:'ordinary_user_id'::uuid,:'ordinary_user_id'::uuid,'2026-10-04-lr5-v1',now(),'2026-10-04-lr5-v1',now(),'account');
-- Explicitly unapproved source; never a permitted public publication.
insert into steel_pulse_private.sources(id,display_name,origin_url,allowed_hosts,channel,status)
values ('sp8a_local','SP8.A Synthetic Source','https://example.org/',array['example.org'],'press_room','candidate');
insert into steel_pulse_private.fetch_runs(id,source_id,state,finished_at)
values ('00000000-0000-0000-0000-000000008a10','sp8a_local','succeeded',now());
insert into steel_pulse_private.items(id,source_id,canonical_url,first_run_id,rights_evidence_url)
values ('00000000-0000-0000-0000-000000008a11','sp8a_local',
        'https://example.org/sp8a-synthetic', '00000000-0000-0000-0000-000000008a10',
        'https://example.org/sp8a-evidence');
commit;
