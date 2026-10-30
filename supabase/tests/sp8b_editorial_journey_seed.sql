-- Local-only SP8.B journey fixture; never run against hosted databases.
\set ON_ERROR_STOP on
begin;
insert into public.user_legal_acceptances(
  user_id,subject_user_ref,privacy_notice_version,privacy_acknowledged_at,
  terms_version,terms_accepted_at,acceptance_source)
values
 (:'editor_user_id'::uuid,:'editor_user_id'::uuid,'2026-10-04-lr5-v1',now(),'2026-10-04-lr5-v1',now(),'account'),
 (:'reviewer_user_id'::uuid,:'reviewer_user_id'::uuid,'2026-10-04-lr5-v1',now(),'2026-10-04-lr5-v1',now(),'account');
insert into public.platform_staff(user_id,status)
values (:'editor_user_id'::uuid,'active'),(:'reviewer_user_id'::uuid,'active');
insert into public.platform_staff_roles(user_id,role_key,status,assigned_by,reason)
values
 (:'editor_user_id'::uuid,'knowledge_editor','active',:'owner_user_id'::uuid,'SP8.B isolated editor journey'),
 (:'reviewer_user_id'::uuid,'knowledge_editor','active',:'owner_user_id'::uuid,'SP8.B isolated reviewer journey');

-- Artificial source approved only inside the disposable DB for draft editing.
-- No publish_news_card operation and no public feed flag enabled.
insert into steel_pulse_private.sources(
  id,display_name,origin_url,allowed_hosts,channel,status,license_basis,
  approved_operations,feed_url,policy_url,approval_evidence_url,approval_reason,
  reviewer_user_id,legal_reviewer_user_id,approved_at,approval_expires_at,terms_reviewed_at
) values (
  'sp8b_local','SP8.B Synthetic Editorial Source','https://example.org/',
  array['example.org'],'press_room','approved','verified_open_license',
  array['discover_metadata'],'https://example.org/local-test.xml',
  'https://example.org/local-policy','https://example.org/local-evidence',
  'Synthetic rights metadata for an isolated SP8.B test only',
  :'owner_user_id'::uuid,:'reviewer_user_id'::uuid,
  now()-interval '1 day',now()+interval '1 day',now()
);
insert into steel_pulse_private.fetch_runs(id,source_id,state,finished_at)
values ('00000000-0000-0000-0000-000000008b10','sp8b_local','succeeded',now());
insert into steel_pulse_private.items(
  id,source_id,canonical_url,first_run_id,rights_evidence_url
) values (
  '00000000-0000-0000-0000-000000008b11','sp8b_local',
  'https://example.org/sp8b-original-test',
  '00000000-0000-0000-0000-000000008b10',
  'https://example.org/local-evidence'
);
do $$
begin
  if exists(select 1 from steel_pulse_private.sources
    where id='sp8b_local' and 'publish_news_card'=any(approved_operations)) then
    raise exception 'SP8.B fixture must never permit publication';
  end if;
  if steel_pulse_private.sp3_source_is_publishable('00000000-0000-0000-0000-000000008b11') then
    raise exception 'SP8.B fixture cannot be publishable';
  end if;
end
$$;
commit;
