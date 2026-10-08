-- SP3 acceptance fixtures: all role identities and publication rows rolled back.
begin;
create or replace function pg_temp.sp3_assert(p_ok boolean,p_note text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok,false) then raise exception 'SP3: %',p_note; end if;
end; $$;
create or replace function pg_temp.sp3_must_deny(p_statement text)
returns void language plpgsql as $$
begin
  begin
    execute p_statement;
  exception when sqlstate '42501' or sqlstate '22023' then
    return;
  end;
  raise exception 'SP3: expected denial: %',p_statement;
end; $$;

select pg_temp.sp3_assert(
  not has_table_privilege('anon','steel_pulse_private.editorial_cards','SELECT')
  and not has_table_privilege('authenticated','steel_pulse_private.editorial_cards','SELECT')
  and not has_table_privilege('authenticated','steel_pulse_private.editorial_events','INSERT')
  and not has_table_privilege('anon','steel_pulse_private.sp3_currently_eligible_cards','SELECT')
  and not has_schema_privilege('authenticated','steel_pulse_private','USAGE'),
  'drafts, events and private projection hidden from browser roles'
);
select pg_temp.sp3_assert(
  (select count(*)=2 from pg_class c
   join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='steel_pulse_private' and c.relrowsecurity
     and c.relname in ('editorial_cards','editorial_events')),
  'RLS enabled'
);
select pg_temp.sp3_assert(
  (select count(*)=0 from steel_pulse_private.editorial_cards),
  'no seeded or published content in SP3'
);

-- Test users only; owner fallback is temporary and isolated to this rollback.
insert into auth.users(id,email) values
('00000000-0000-0000-0000-00000000c301','sp3-author@example.test'),
('00000000-0000-0000-0000-00000000c302','sp3-editor@example.test'),
('00000000-0000-0000-0000-00000000c303','sp3-publisher@example.test'),
('00000000-0000-0000-0000-00000000c304','sp3-unrelated@example.test')
on conflict (id) do nothing;

do $$
begin
  if not exists(
    select 1 from public.platform_user_roles
     where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email)
      values('00000000-0000-0000-0000-00000000c300','sp3-owner@example.test')
      on conflict do nothing;
    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
      values('00000000-0000-0000-0000-00000000c300',
         'platform_superadmin','active',null,'SP3 synthetic owner');
  end if;
end $$;
select user_id as sp3_owner_id from public.platform_user_roles
 where role='platform_superadmin' and status='active' limit 1 \gset

insert into public.platform_staff(user_id,status)
values
('00000000-0000-0000-0000-00000000c301','active'),
('00000000-0000-0000-0000-00000000c302','active'),
('00000000-0000-0000-0000-00000000c303','active')
on conflict do nothing;
insert into public.platform_staff_roles(user_id,role_key,status,assigned_by,reason)
values
('00000000-0000-0000-0000-00000000c301','knowledge_editor','active',:'sp3_owner_id'::uuid,'SP3 author'),
('00000000-0000-0000-0000-00000000c302','knowledge_editor','active',:'sp3_owner_id'::uuid,'SP3 editor'),
('00000000-0000-0000-0000-00000000c303','knowledge_publisher','active',:'sp3_owner_id'::uuid,'SP3 publisher');

insert into steel_pulse_private.sources(
  id,display_name,origin_url,allowed_hosts,channel,status,
  license_basis,approved_operations,feed_url,policy_url,approval_evidence_url,
  approval_reason,reviewer_user_id,legal_reviewer_user_id,
  approved_at,approval_expires_at,terms_reviewed_at
) values (
  'test_sp3_feed','SP3 Synthetic Official Source','https://news.example.org/',
  array['news.example.org'],'press_room','approved','explicit_written_agreement',
  array['discover_metadata','publish_news_card'],
  'https://news.example.org/rss','https://news.example.org/terms',
  'https://news.example.org/evidence/source',
  'Contractually approved synthetic source solely for SP3 test',
  '00000000-0000-0000-0000-00000000c302',:'sp3_owner_id'::uuid,
  now()-interval '1 day',now()+interval '7 days',now()
);
-- A test item has no full copied article and no source media.
insert into steel_pulse_private.fetch_runs(id,source_id,state,finished_at)
values('00000000-0000-0000-0000-00000000c310','test_sp3_feed','succeeded',now());
insert into steel_pulse_private.items(
  id,source_id,canonical_url,first_run_id,rights_evidence_url
) values(
  '00000000-0000-0000-0000-00000000c311','test_sp3_feed',
  'https://news.example.org/articles/sample',
  '00000000-0000-0000-0000-00000000c310',
  'https://news.example.org/evidence/source'
);
-- Unauthorized authenticated account cannot save.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c304',true);
select pg_temp.sp3_must_deny($q$
  select public.sp3_save_draft('00000000-0000-0000-0000-00000000c311',0,
    'A legitimate synthetic steel-sector headline',
    'This text explains an independently written industry development with factual context.',
    'A practical implication for steel producers and distributors in Europe.',
    'market','it')
$q$);
-- Author prepares own original draft, then submits for independent review.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c301',true);
select public.sp3_save_draft(
  '00000000-0000-0000-0000-00000000c311',0,
  'A legitimate synthetic steel-sector headline',
  'This text explains an independently written industry development with factual context.',
  'A practical implication for steel producers and distributors in Europe.',
  'market','it'
) as sp3_draft \gset
select (:'sp3_draft'::jsonb->>'card_id') as sp3_card_id \gset
select pg_temp.sp3_must_deny(format(
  'select public.sp3_save_draft(%L::uuid,0,%L,%L,%L,%L,%L)',
  '00000000-0000-0000-0000-00000000c311',
  'A legitimate synthetic steel-sector headline',
  'This text explains an independently written industry development with factual context.',
  'A practical implication for steel producers and distributors in Europe.',
  'market','it'
));
select public.sp3_decide(:'sp3_card_id'::uuid,1,'submit',null,'Submit for independent editorial review');
select pg_temp.sp3_must_deny(format(
  'select public.sp3_decide(%L::uuid,1,%L,%L,%L)',
  :'sp3_card_id','editor_approve','https://news.example.org/articles/sample',
  'Cannot independently approve own draft'
));
-- A separate editor can approve a checked fact reference.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c302',true);
select public.sp3_decide(:'sp3_card_id'::uuid,1,'editor_approve',
  'https://news.example.org/articles/sample',
  'Original copy and source facts manually verified') as editor_ok \gset
-- The editor cannot give legal sign-off.
select pg_temp.sp3_must_deny(format(
  'select public.sp3_decide(%L::uuid,1,%L,%L,%L)',
  :'sp3_card_id','legal_approve','https://news.example.org/evidence/item',
  'Independent item-specific legal rights have been checked'
));
-- Publishing is refused until the owner signs off on rights.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c303',true);
select pg_temp.sp3_must_deny(format(
  'select public.sp3_decide(%L::uuid,1,%L,null,%L)',
  :'sp3_card_id','publish','Not yet legally approved'
));
select set_config('request.jwt.claim.sub',:'sp3_owner_id',true);
select public.sp3_decide(:'sp3_card_id'::uuid,1,'legal_approve',
  'https://news.example.org/evidence/item',
  'The rights of this particular item permit original factual commentary without reused media.') as legal_ok \gset
-- Neither author nor editor may publish after sign-off.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c301',true);
select pg_temp.sp3_must_deny(format(
  'select public.sp3_decide(%L::uuid,1,%L,null,%L)',
  :'sp3_card_id','publish','Author must not publish own article'
));
-- Independent publisher can make private staging 'published'.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c303',true);
select public.sp3_decide(:'sp3_card_id'::uuid,1,'publish',null,
  'Independent release after editorial and legal approval') as published \gset
reset role;
select pg_temp.sp3_assert(
  (select count(*)=1 from steel_pulse_private.sp3_currently_eligible_cards
    where id=:'sp3_card_id'::uuid),
  'signed release enters ONLY private eligible projection'
);
select pg_temp.sp3_assert(
  (select count(*)=5 from steel_pulse_private.editorial_events where card_id=:'sp3_card_id'::uuid),
  'draft submit editor legal and publish decisions are audited'
);
-- Suspending the source removes visibility without rewriting the card.
update steel_pulse_private.sources set status='suspended',updated_at=now()
  where id='test_sp3_feed';
select pg_temp.sp3_assert(
  not exists(select 1 from steel_pulse_private.sp3_currently_eligible_cards
    where id=:'sp3_card_id'::uuid),
  'source revocation immediately blocks private eligible projection'
);
update steel_pulse_private.sources set status='approved',updated_at=now()
  where id='test_sp3_feed';
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c303',true);
select public.sp3_decide(:'sp3_card_id'::uuid,1,'withdraw',null,
  'Publisher withdraws content as an editorial recall') as withdrawal \gset
reset role;
select pg_temp.sp3_assert(
  not exists(select 1 from steel_pulse_private.sp3_currently_eligible_cards where id=:'sp3_card_id'::uuid),
  'withdrawal is immediate'
);
do $$
begin
  begin
    update steel_pulse_private.editorial_events set reason='tamper attempt'
      where event_type='published';
    raise exception 'SP3 immutable events update unexpectedly succeeded';
  exception when sqlstate '42501' then
    null;
  end;
end $$;
rollback;
