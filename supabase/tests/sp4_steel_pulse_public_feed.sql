-- SP4 regression: no news leaks while disabled, even if a published card exists.
begin;
create function pg_temp.sp4_assert(p_ok boolean,p_note text)
returns void language plpgsql as $$
begin
 if not coalesce(p_ok,false) then raise exception 'SP4: %',p_note; end if;
end $$;

select pg_temp.sp4_assert(
  (select not enabled from steel_pulse_private.publication_settings where singleton=true),
  'public feed remains disabled after migration'
);
select pg_temp.sp4_assert(
  not has_table_privilege('anon','steel_pulse_private.publication_settings','SELECT')
  and not has_table_privilege('anon','steel_pulse_private.editorial_cards','SELECT')
  and not has_table_privilege('anon','steel_pulse_private.sp3_currently_eligible_cards','SELECT'),
  'anon cannot read private settings or editorial data'
);

set local role anon;
select pg_temp.sp4_assert(
  public.sp4_public_steel_pulse_feed(3)='[]'::jsonb
  and public.sp4_public_steel_pulse_feed(100)='[]'::jsonb
  and public.sp4_public_steel_pulse_feed(-1)='[]'::jsonb,
  'public RPC fails closed when disabled, including invalid limits'
);
reset role;

-- Synthetic fixtures only: source rights and 3 distinct editorial identities.
insert into auth.users(id,email) values
('00000000-0000-0000-0000-00000000d401','sp4-author@example.test'),
('00000000-0000-0000-0000-00000000d402','sp4-editor@example.test'),
('00000000-0000-0000-0000-00000000d403','sp4-legal@example.test'),
('00000000-0000-0000-0000-00000000d404','sp4-publisher@example.test')
on conflict(id) do nothing;
insert into steel_pulse_private.sources(
  id,display_name,origin_url,allowed_hosts,channel,status,
  license_basis,approved_operations,feed_url,policy_url,approval_evidence_url,
  approval_reason,reviewer_user_id,legal_reviewer_user_id,
  approved_at,approval_expires_at,terms_reviewed_at
) values (
  'test_sp4_feed','SP4 Synthetic Source','https://news.example.org/',
  array['news.example.org'],'press_room','approved','explicit_written_agreement',
  array['discover_metadata','publish_news_card'],
  'https://news.example.org/rss','https://news.example.org/terms',
  'https://news.example.org/evidence/contract',
  'Rights verified exclusively for SP4 acceptance fixture',
  '00000000-0000-0000-0000-00000000d402',
  '00000000-0000-0000-0000-00000000d403',
  now()-interval '1 day',now()+interval '7 days',now()
);
insert into steel_pulse_private.fetch_runs(id,source_id,state)
values('00000000-0000-0000-0000-00000000d410','test_sp4_feed','succeeded');
insert into steel_pulse_private.items(
 id,source_id,canonical_url,first_run_id,rights_evidence_url
) values(
 '00000000-0000-0000-0000-00000000d411','test_sp4_feed',
 'https://news.example.org/articles/one',
 '00000000-0000-0000-0000-00000000d410',
 'https://news.example.org/evidence/contract'
);
insert into steel_pulse_private.editorial_cards(
  id,item_id,status,headline,summary,relevance,topic,language_code,
  authored_by,editor_reviewed_by,editor_reviewed_at,fact_evidence_url,
  legal_reviewed_by,legal_reviewed_at,item_rights_evidence_url,legal_attestation,
  published_by,published_at,published_until
) values(
  '00000000-0000-0000-0000-00000000d412',
  '00000000-0000-0000-0000-00000000d411','published',
  'Indagine sintetica sul mercato siderurgico europeo',
  'Scheda redazionale dimostrativa contenente soltanto fatti indipendentemente verificati.',
  'I professionisti del settore possono monitorare domanda e disponibilità del materiale.',
  'market','it','00000000-0000-0000-0000-00000000d401',
  '00000000-0000-0000-0000-00000000d402',now(),
  'https://news.example.org/articles/one',
  '00000000-0000-0000-0000-00000000d403',now(),
  'https://news.example.org/evidence/item',
  'Review legale di esempio: contenuto originale e licenza per luso commerciale verificata.',
  '00000000-0000-0000-0000-00000000d404',now(),now()+interval '5 days'
);
-- Even a published synthetic item does not override the explicit public kill switch.
set local role anon;
select pg_temp.sp4_assert(
  public.sp4_public_steel_pulse_feed(3)='[]'::jsonb,
  'published card remains hidden with disabled flag'
);
reset role;

update steel_pulse_private.publication_settings set enabled=true,changed_at=now()
 where singleton=true;
set local role anon;
select public.sp4_public_steel_pulse_feed(3) as sp4_public_result \gset
select pg_temp.sp4_assert(
  jsonb_array_length(:'sp4_public_result'::jsonb)=1,
  'only eligible reviewed card is returned'
);
select pg_temp.sp4_assert(
  (:'sp4_public_result'::jsonb->0->>'source_name')='SP4 Synthetic Source'
  and (:'sp4_public_result'::jsonb->0->>'source_url')='https://news.example.org/articles/one'
  and not (:'sp4_public_result'::jsonb->0 ? 'item_rights_evidence_url')
  and not (:'sp4_public_result'::jsonb->0 ? 'authored_by')
  and not (:'sp4_public_result'::jsonb->0 ? 'legal_attestation'),
  'public projection selects only approved display fields'
);
reset role;
update steel_pulse_private.sources set status='suspended' where id='test_sp4_feed';
set local role anon;
select pg_temp.sp4_assert(public.sp4_public_steel_pulse_feed(3)='[]'::jsonb,
  'source suspension removes public feed item instantly');
reset role;
update steel_pulse_private.sources set status='approved' where id='test_sp4_feed';
update steel_pulse_private.editorial_cards set status='withdrawn',withdrawn_at=now(),
  withdrawn_by='00000000-0000-0000-0000-00000000d404'
 where id='00000000-0000-0000-0000-00000000d412';
set local role anon;
select pg_temp.sp4_assert(public.sp4_public_steel_pulse_feed(3)='[]'::jsonb,
  'editorial withdrawal removes public card');
reset role;
rollback;
