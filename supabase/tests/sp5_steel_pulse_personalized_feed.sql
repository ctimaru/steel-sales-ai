-- SP5 isolated preference and personalized-feed acceptance.
-- Disposable test data, entirely rolled back.
begin;
create function pg_temp.sp5_assert(ok boolean,note text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'SP5: %',note; end if;
end $$;
create function pg_temp.sp5_must_deny(statement text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when sqlstate '42501' or sqlstate '22023' then
    return;
  end;
  raise exception 'SP5 expected denial for %',statement;
end $$;

select pg_temp.sp5_assert(
  not has_table_privilege('anon','steel_pulse_private.user_feed_preferences','SELECT')
  and not has_table_privilege('authenticated','steel_pulse_private.user_feed_preferences','SELECT')
  and not has_schema_privilege('authenticated','steel_pulse_private','USAGE'),
  'private preferences table cannot be queried via browser roles'
);
select pg_temp.sp5_assert(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='steel_pulse_private' and c.relname='user_feed_preferences'),
  'preferences require RLS'
);
select pg_temp.sp5_assert(
  not has_function_privilege('anon','public.sp5_save_feed_preferences(text[],text,text)','EXECUTE')
  and not has_function_privilege('anon','public.sp5_my_steel_pulse_feed(integer)','EXECUTE'),
  'anonymous readers cannot access or modify interests'
);
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-00000000e501','sp5-first@example.test'),
 ('00000000-0000-0000-0000-00000000e502','sp5-second@example.test'),
 ('00000000-0000-0000-0000-00000000e503','sp5-author@example.test'),
 ('00000000-0000-0000-0000-00000000e504','sp5-editor@example.test'),
 ('00000000-0000-0000-0000-00000000e505','sp5-legal@example.test'),
 ('00000000-0000-0000-0000-00000000e506','sp5-publisher@example.test')
on conflict (id) do nothing;

-- Unauthorized / cross-account operations denied. No user_id arg exists.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','',true);
select pg_temp.sp5_must_deny('select public.sp5_my_steel_pulse_feed(12)');
select pg_temp.sp5_must_deny(
 'select public.sp5_save_feed_preferences(array[''market''],''trader'',''it'')');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000e501',true);
select public.sp5_my_steel_pulse_feed(12) as sp5_first_before \gset
select pg_temp.sp5_assert(
 (:'sp5_first_before'::jsonb->'preferences'->'topics')='[]'::jsonb,
 'brand-new user has an empty interests set'
);
select public.sp5_save_feed_preferences(
 array['trade','market'],'trader','it') as sp5_saved \gset
select pg_temp.sp5_assert(
 (:'sp5_saved'::jsonb->>'role_interest')='trader',
 'save returns own professional interest'
);
select pg_temp.sp5_must_deny(
 'select public.sp5_save_feed_preferences(array[''market'',''market''],''trader'',''it'')');
select pg_temp.sp5_must_deny(
 'select public.sp5_save_feed_preferences(array[''private_rfq''],''trader'',''it'')');
select pg_temp.sp5_must_deny(
 'select public.sp5_save_feed_preferences(array[''trade''],''owner'',''it'')');
select pg_temp.sp5_must_deny(
 'select public.sp5_save_feed_preferences(array[''market''],''trader'',''de'')');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000e502',true);
select public.sp5_save_feed_preferences(
 array['technology'],'processor','en') as sp5_second_saved \gset
select public.sp5_my_steel_pulse_feed(12) as sp5_second_feed \gset
select pg_temp.sp5_assert(
 (:'sp5_second_feed'::jsonb->'preferences'->'topics')='["technology"]'::jsonb
 and (:'sp5_second_feed'::jsonb->'preferences'->>'role_interest')='processor',
 'second user cannot observe first user preferences'
);
reset role;
select pg_temp.sp5_assert(
 (select count(*)=2 from steel_pulse_private.user_feed_preferences),
 'two separate user-owned rows persist'
);

-- Synthetic approved stories to prove filtering and global switch.
insert into steel_pulse_private.sources(
  id,display_name,origin_url,allowed_hosts,channel,status,
  license_basis,approved_operations,feed_url,policy_url,approval_evidence_url,
  approval_reason,reviewer_user_id,legal_reviewer_user_id,
  approved_at,approval_expires_at,terms_reviewed_at
) values (
  'test_sp5_feed','SP5 Official Test Source','https://news.example.org/',
  array['news.example.org'],'press_room','approved','explicit_written_agreement',
  array['discover_metadata','publish_news_card'],
  'https://news.example.org/rss','https://news.example.org/terms',
  'https://news.example.org/evidence/contract',
  'Test rights only, no actual publication licensed',
  '00000000-0000-0000-0000-00000000e504',
  '00000000-0000-0000-0000-00000000e505',
  now()-interval '1 day',now()+interval '7 days',now()
);
insert into steel_pulse_private.fetch_runs(id,source_id,state)
values('00000000-0000-0000-0000-00000000e510','test_sp5_feed','succeeded');
insert into steel_pulse_private.items(
 id,source_id,canonical_url,first_run_id,rights_evidence_url
) values
 ('00000000-0000-0000-0000-00000000e511','test_sp5_feed',
  'https://news.example.org/market','00000000-0000-0000-0000-00000000e510',
  'https://news.example.org/evidence/contract'),
 ('00000000-0000-0000-0000-00000000e512','test_sp5_feed',
  'https://news.example.org/tech','00000000-0000-0000-0000-00000000e510',
  'https://news.example.org/evidence/contract');

insert into steel_pulse_private.editorial_cards(
 id,item_id,status,headline,summary,relevance,topic,language_code,
 authored_by,editor_reviewed_by,editor_reviewed_at,fact_evidence_url,
 legal_reviewed_by,legal_reviewed_at,item_rights_evidence_url,legal_attestation,
 published_by,published_at,published_until
) values
 ('00000000-0000-0000-0000-00000000e521',
  '00000000-0000-0000-0000-00000000e511','published',
  'SP5 Osservatorio sintetico sul mercato europeo',
  'Scheda di mercato artificiale per verificare la selezione delle categorie editoriali.',
  'Il mercato incide sulla disponibilità dei materiali e sulle attività dei distributori.',
  'market','it',
  '00000000-0000-0000-0000-00000000e503',
  '00000000-0000-0000-0000-00000000e504',now(),
  'https://news.example.org/market',
  '00000000-0000-0000-0000-00000000e505',now(),
  'https://news.example.org/evidence/item',
  'SP5 synthetic item-level rights validation, for this test only.',
  '00000000-0000-0000-0000-00000000e506',now(),now()+interval '5 days'),
 ('00000000-0000-0000-0000-00000000e522',
  '00000000-0000-0000-0000-00000000e512','published',
  'SP5 Innovazioni tecniche nella filiera di produzione',
  'Scheda editoriale artificiale in inglese usata per verificare la separazione delle lingue.',
  'I terzisti possono valutare applicazioni e processi con un maggiore livello di informazione.',
  'technology','en',
  '00000000-0000-0000-0000-00000000e503',
  '00000000-0000-0000-0000-00000000e504',now(),
  'https://news.example.org/tech',
  '00000000-0000-0000-0000-00000000e505',now(),
  'https://news.example.org/evidence/item',
  'SP5 synthetic item-level rights validation, for this test only.',
  '00000000-0000-0000-0000-00000000e506',now(),now()+interval '5 days');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000e501',true);
select pg_temp.sp5_assert(
 (public.sp5_my_steel_pulse_feed(12)->'items')='[]'::jsonb,
 'global SP4 kill switch blocks personalized news'
);
reset role;
update steel_pulse_private.publication_settings
set enabled=true,changed_at=now() where singleton=true;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000e501',true);
select public.sp5_my_steel_pulse_feed(12) as sp5_first_result \gset
select pg_temp.sp5_assert(
 jsonb_array_length(:'sp5_first_result'::jsonb->'items')=1
 and (:'sp5_first_result'::jsonb->'items'->0->>'topic')='market',
 'selected categories and language filter news'
);
select pg_temp.sp5_assert(
 not (:'sp5_first_result'::jsonb->'items'->0 ? 'user_id')
 and not (:'sp5_first_result'::jsonb->'items'->0 ? 'legal_attestation'),
 'no personal identity or rights evidence in public article projection'
);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000e502',true);
select public.sp5_my_steel_pulse_feed(12) as sp5_second_result \gset
select pg_temp.sp5_assert(
 jsonb_array_length(:'sp5_second_result'::jsonb->'items')=1
 and (:'sp5_second_result'::jsonb->'items'->0->>'topic')='technology',
 'a different user receives their own permitted news'
);
reset role;
update steel_pulse_private.sources set status='suspended' where id='test_sp5_feed';
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000e501',true);
select pg_temp.sp5_assert(
 (public.sp5_my_steel_pulse_feed(12)->'items')='[]'::jsonb,
 'revoked source vanishes from personal feed on next request'
);
reset role;
rollback;
