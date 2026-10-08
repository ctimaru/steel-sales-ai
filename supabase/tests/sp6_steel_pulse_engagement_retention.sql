-- SP6: two distinct users, verified content only, explicit actions and revocation.
-- All users/items/settings changes are rolled back after this test.
begin;
create function pg_temp.sp6_assert(ok boolean, note text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'SP6: %',note; end if;
end $$;
create function pg_temp.sp6_must_deny(stmt text)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when sqlstate '42501' or sqlstate '22023' then
    return;
  end;
  raise exception 'SP6 expected denial: %',stmt;
end $$;

select pg_temp.sp6_assert(
  not has_table_privilege('anon','steel_pulse_private.user_article_engagement','SELECT')
  and not has_table_privilege('authenticated','steel_pulse_private.user_article_engagement','SELECT')
  and not has_table_privilege('authenticated','steel_pulse_private.user_article_engagement','INSERT')
  and not has_schema_privilege('authenticated','steel_pulse_private','USAGE'),
  'private engagement is inaccessible to tenant browsers'
);
select pg_temp.sp6_assert(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='steel_pulse_private' and c.relname='user_article_engagement'),
  'RLS on SP6 engagement table'
);
select pg_temp.sp6_assert(
  not has_function_privilege('anon','public.sp6_set_article_engagement(text,text)','EXECUTE')
  and not has_function_privilege('anon','public.sp6_my_article_engagement(integer)','EXECUTE')
  and not has_function_privilege('anon','public.sp6_platform_retention_summary()','EXECUTE'),
  'anonymous cannot access any SP6 function'
);

insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-00000000f601','sp6-a@example.test'),
  ('00000000-0000-0000-0000-00000000f602','sp6-b@example.test'),
  ('00000000-0000-0000-0000-00000000f603','sp6-author@example.test'),
  ('00000000-0000-0000-0000-00000000f604','sp6-editor@example.test'),
  ('00000000-0000-0000-0000-00000000f605','sp6-legal@example.test'),
  ('00000000-0000-0000-0000-00000000f606','sp6-publisher@example.test')
on conflict(id) do nothing;
insert into steel_pulse_private.sources(
  id,display_name,origin_url,allowed_hosts,channel,status,
  license_basis,approved_operations,feed_url,policy_url,approval_evidence_url,
  approval_reason,reviewer_user_id,legal_reviewer_user_id,
  approved_at,approval_expires_at,terms_reviewed_at
) values (
  'test_sp6_feed','SP6 Approved Synthetic Source','https://news.example.org/',
  array['news.example.org'],'press_room','approved','explicit_written_agreement',
  array['discover_metadata','publish_news_card'],
  'https://news.example.org/rss','https://news.example.org/terms',
  'https://news.example.org/evidence/contract',
  'SP6 strictly synthetic fixture, not a real-world rights approval',
  '00000000-0000-0000-0000-00000000f604',
  '00000000-0000-0000-0000-00000000f605',
  now()-interval '1 day',now()+interval '7 days',now()
);
insert into steel_pulse_private.fetch_runs(id,source_id,state)
values('00000000-0000-0000-0000-00000000f610','test_sp6_feed','succeeded');
insert into steel_pulse_private.items(
 id,source_id,canonical_url,first_run_id,rights_evidence_url
) values (
 '00000000-0000-0000-0000-00000000f611','test_sp6_feed',
 'https://news.example.org/sp6-story',
 '00000000-0000-0000-0000-00000000f610',
 'https://news.example.org/evidence/contract'
);
insert into steel_pulse_private.editorial_cards(
 id,item_id,status,headline,summary,relevance,topic,language_code,
 authored_by,editor_reviewed_by,editor_reviewed_at,fact_evidence_url,
 legal_reviewed_by,legal_reviewed_at,item_rights_evidence_url,legal_attestation,
 published_by,published_at,published_until
) values (
  '00000000-0000-0000-0000-00000000f612',
  '00000000-0000-0000-0000-00000000f611','published',
  'Contenuto sintetico verificato per Steel Pulse SP6',
  'Questa scheda originale serve esclusivamente a verificare la sicurezza delle funzioni salvati e letti.',
  'I commerciali possono testare salvataggio e lettura senza usare dati di clienti o ordini.',
  'market','it',
  '00000000-0000-0000-0000-00000000f603',
  '00000000-0000-0000-0000-00000000f604',now(),
  'https://news.example.org/sp6-story',
  '00000000-0000-0000-0000-00000000f605',now(),
  'https://news.example.org/evidence/item',
  'Synthetic item legal clearance solely for isolated CI regression, not production.',
  '00000000-0000-0000-0000-00000000f606',now(),now()+interval '5 days'
);

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.sp6_must_deny('select public.sp6_my_article_engagement(12)');
select pg_temp.sp6_must_deny(
  'select public.sp6_set_article_engagement(''https://news.example.org/sp6-story'',''save'')'
);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000f601',true);
select pg_temp.sp6_assert(
  (public.sp6_my_article_engagement(12)->'saved_items')='[]'::jsonb,
  'publication switch prevents any saved public-visible output'
);
select pg_temp.sp6_must_deny(
  'select public.sp6_set_article_engagement(''https://news.example.org/sp6-story'',''save'')'
);
reset role;

update steel_pulse_private.publication_settings set enabled=true,changed_at=now()
where singleton=true;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000f601',true);
select pg_temp.sp6_must_deny(
  'select public.sp6_set_article_engagement(''https://news.example.org/unknown'',''save'')'
);
select pg_temp.sp6_must_deny(
  'select public.sp6_set_article_engagement(''https://news.example.org/sp6-story'',''other'')'
);
select public.sp6_set_article_engagement('https://news.example.org/sp6-story','save') as sp6_saved \gset
select pg_temp.sp6_assert((:'sp6_saved'::jsonb->>'saved')::boolean,'explicit saved');
select public.sp6_set_article_engagement('https://news.example.org/sp6-story','read') as sp6_read \gset
select pg_temp.sp6_assert((:'sp6_read'::jsonb->>'read')::boolean,'explicit mark read');
select public.sp6_my_article_engagement(12) as sp6_a \gset
select pg_temp.sp6_assert(
  jsonb_array_length(:'sp6_a'::jsonb->'saved_items')=1
  and jsonb_array_length(:'sp6_a'::jsonb->'read_urls')=1
  and (:'sp6_a'::jsonb->'saved_items'->0->>'source_url')='https://news.example.org/sp6-story'
  and not (:'sp6_a'::jsonb->'saved_items'->0 ? 'saved_at')
  and not (:'sp6_a'::jsonb->'saved_items'->0 ? 'user_id'),
  'private saved and read state only includes curated article display fields'
);
select pg_temp.sp6_must_deny('select public.sp6_platform_retention_summary()');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000f602',true);
select pg_temp.sp6_assert(
  jsonb_array_length(public.sp6_my_article_engagement(12)->'saved_items')=0,
  'other user cannot view someone else saved articles'
);
select public.sp6_set_article_engagement('https://news.example.org/sp6-story','unsave') as sp6_other_unsave \gset
select pg_temp.sp6_assert(
  (:'sp6_other_unsave'::jsonb->>'saved')::boolean=false,
  'other user cannot change first user bookmark'
);
reset role;
select pg_temp.sp6_assert(
  (select count(*)=1 from steel_pulse_private.user_article_engagement),
  'single owner-only engagement row after two distinct users interact'
);
update steel_pulse_private.sources set status='suspended' where id='test_sp6_feed';
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000f601',true);
select pg_temp.sp6_assert(
  (public.sp6_my_article_engagement(12)->'saved_items')='[]'::jsonb
  and (public.sp6_my_article_engagement(12)->'read_urls')='[]'::jsonb,
  'revoked source removes saved content and state from read API'
);
select pg_temp.sp6_must_deny(
  'select public.sp6_set_article_engagement(''https://news.example.org/sp6-story'',''save'')'
);
reset role;
update steel_pulse_private.sources set status='approved' where id='test_sp6_feed';
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000f601',true);
select public.sp6_set_article_engagement('https://news.example.org/sp6-story','unread') as sp6_unread \gset
select public.sp6_set_article_engagement('https://news.example.org/sp6-story','unsave') as sp6_unsave \gset
reset role;
select pg_temp.sp6_assert(
  not exists(select 1 from steel_pulse_private.user_article_engagement
     where user_id='00000000-0000-0000-0000-00000000f601'),
  'removing last engagement signal deletes user row'
);
rollback;
