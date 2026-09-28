-- SA7 — Knowledge Operations Delegation Cutover acceptance.
begin;

create or replace function pg_temp.sa7_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'SA7 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.sa7_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'SA7 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'SA7 statement unexpectedly succeeded: %',statement;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000a701'::uuid,'sa7-knowledge-editor@example.com',now()),
  ('00000000-0000-0000-0000-00000000a702'::uuid,'sa7-knowledge-publisher@example.com',now()),
  ('00000000-0000-0000-0000-00000000a703'::uuid,'sa7-platform-auditor@example.com',now()),
  ('00000000-0000-0000-0000-00000000a704'::uuid,'sa7-outsider@example.com',now())
on conflict (id) do nothing;

do $root$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values ('00000000-0000-0000-0000-00000000a700'::uuid,'sa7-owner@example.com',now())
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-00000000a700'::uuid,
      'platform_superadmin','active',null,'SA7 acceptance fallback owner'
    );
  end if;
end
$root$;

select user_id as owner_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

insert into public.platform_staff(user_id,status,activated_at,updated_at)
values
  ('00000000-0000-0000-0000-00000000a701'::uuid,'active',now(),now()),
  ('00000000-0000-0000-0000-00000000a702'::uuid,'active',now(),now()),
  ('00000000-0000-0000-0000-00000000a703'::uuid,'active',now(),now())
on conflict (user_id) do update
set status='active',suspended_at=null,revoked_at=null,updated_at=now();

insert into public.platform_staff_roles(user_id,role_key,status,assigned_by,reason)
values
  ('00000000-0000-0000-0000-00000000a701'::uuid,'knowledge_editor','active',:'owner_id'::uuid,'SA7 acceptance'),
  ('00000000-0000-0000-0000-00000000a702'::uuid,'knowledge_publisher','active',:'owner_id'::uuid,'SA7 acceptance'),
  ('00000000-0000-0000-0000-00000000a703'::uuid,'platform_auditor','active',:'owner_id'::uuid,'SA7 acceptance');

-- K3 guarantees published standard pages. Reuse one so acceptance proves that a
-- delegated edit cannot leak into the already-indexed public Knowledge page.
select p.id as page_id,
       p.slug,
       p.intro as original_live_intro,
       p.draft_version as original_draft_version,
       p.editorial_version as original_live_version
from public.steel_knowledge_standard_pages p
where p.page_status='published'
order by p.slug
limit 1 \gset

select pg_temp.sa7_assert(
  :'page_id'::uuid is not null
  and nullif(:'slug','') is not null
  and nullif(:'original_live_intro','') is not null,
  'SA7 acceptance requires one existing published standard page'
);

-- Raw editorial tables remain outside browser-role access.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a701',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sa7_assert_raises(
  'select count(*) from public.steel_knowledge_standard_pages',
  'permission denied'
);

select pg_temp.sa7_assert(
  not has_function_privilege(
    'authenticated',
    'public.k8_knowledge_seo_quality_audit()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.k8_knowledge_publication_readiness()',
    'EXECUTE'
  ),
  'K8 internal quality RPCs must remain service-role-only'
);

-- Knowledge Editor can read, edit, review and inspect quality, but cannot publish.
select pg_temp.sa7_assert(
  public.has_platform_permission('platform.console.access')
  and public.has_platform_permission('knowledge.read_drafts')
  and public.has_platform_permission('knowledge.edit')
  and public.has_platform_permission('knowledge.review')
  and public.has_platform_permission('knowledge.quality_audit')
  and not public.has_platform_permission('knowledge.publish'),
  'Knowledge Editor capability set must exclude publication'
);

select pg_temp.sa7_assert(
  not public.has_platform_permission('registrations.read')
  and not public.has_platform_permission('discovery.read')
  and not public.has_platform_permission('claims.read')
  and not public.has_platform_permission('platform.staff.read'),
  'Knowledge Editor must remain outside unrelated Platform domains'
);

select public.sa7_knowledge_queue(null,200) as editor_queue \gset
select public.sa7_knowledge_page('standard',:'page_id'::uuid) as editor_page \gset
select public.sa7_knowledge_quality_audit() as editor_quality \gset

select pg_temp.sa7_assert(
  (:'editor_queue'::jsonb->>'total')::integer > 0
  and :'editor_page'::jsonb->>'page_id'=:'page_id'
  and jsonb_typeof(:'editor_quality'::jsonb->'live_quality')='array',
  'Knowledge Editor must read queue, detail and quality audit'
);

select public.sa7_save_knowledge_draft(
  'standard',
  :'page_id'::uuid,
  (:'editor_page'::jsonb->'draft_payload')
    || jsonb_build_object(
      'intro','SA7 delegated draft intro — not live until Publisher approval'
    ),
  'SA7 editor isolated-draft acceptance'
) as save_payload \gset

select pg_temp.sa7_assert(
  :'save_payload'::jsonb->>'workflow_status'='draft'
  and (:'save_payload'::jsonb->>'draft_version')::integer
      > :'original_draft_version'::integer,
  'Knowledge Editor must save a new isolated draft version'
);

select intro as live_intro_after_edit
from public.k2_public_knowledge_standard(:'slug') \gset

select pg_temp.sa7_assert(
  :'live_intro_after_edit'=:'original_live_intro',
  'saving a Knowledge draft must not change the public K2 live copy'
);

select pg_temp.sa7_assert(
  exists (
    select 1
    from public.steel_knowledge_standard_pages
    where id=:'page_id'::uuid
      and page_status='published'
      and intro=:'original_live_intro'
      and draft_payload->>'intro'='SA7 delegated draft intro — not live until Publisher approval'
  ),
  'live fields and isolated draft must coexist after delegated edit'
);

select public.sa7_submit_knowledge_review(
  'standard',
  :'page_id'::uuid,
  'SA7 ready for publisher review'
) as submit_payload \gset

select pg_temp.sa7_assert(
  :'submit_payload'::jsonb->>'workflow_status'='in_review',
  'Knowledge Editor must submit a ready draft for review'
);

select pg_temp.sa7_assert_raises(
  format(
    'select public.sa7_save_knowledge_draft(%L,%L::uuid,%L::jsonb,%L)',
    'standard',
    :'page_id',
    (:'editor_page'::jsonb->'draft_payload')::text,
    'must remain frozen'
  ),
  'frozen while in review'
);

select pg_temp.sa7_assert_raises(
  format(
    'select public.sa7_publish_knowledge_page(%L,%L::uuid,%L,%L)',
    'standard',:'page_id','publish','editor must not publish'
  ),
  'Platform permission required'
);

reset role;

-- Knowledge Publisher can review and publish, but deliberately cannot edit.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a702',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sa7_assert(
  public.has_platform_permission('knowledge.read_drafts')
  and public.has_platform_permission('knowledge.review')
  and public.has_platform_permission('knowledge.publish')
  and public.has_platform_permission('knowledge.quality_audit')
  and not public.has_platform_permission('knowledge.edit'),
  'Knowledge Publisher must publish/review without draft-edit authority'
);

select pg_temp.sa7_assert_raises(
  format(
    'select public.sa7_save_knowledge_draft(%L,%L::uuid,%L::jsonb,%L)',
    'standard',
    :'page_id',
    (:'editor_page'::jsonb->'draft_payload')::text,
    'publisher must not edit'
  ),
  'Platform permission required'
);

select public.sa7_review_knowledge_draft(
  'standard',
  :'page_id'::uuid,
  'approve',
  'SA7 publisher review acceptance'
) as review_payload \gset

select pg_temp.sa7_assert(
  :'review_payload'::jsonb->>'workflow_status'='approved',
  'Knowledge Publisher must approve an in-review draft without publishing it'
);

select intro as live_intro_after_review
from public.k2_public_knowledge_standard(:'slug') \gset

select pg_temp.sa7_assert(
  :'live_intro_after_review'=:'original_live_intro',
  'review approval alone must not change the public copy'
);

select public.sa7_publish_knowledge_page(
  'standard',
  :'page_id'::uuid,
  'publish',
  'SA7 delegated publication acceptance'
) as publish_payload \gset

select intro as public_intro_after_publish
from public.k2_public_knowledge_standard(:'slug') \gset

select pg_temp.sa7_assert(
  :'publish_payload'::jsonb->>'page_status'='published'
  and :'public_intro_after_publish'='SA7 delegated draft intro — not live until Publisher approval',
  'knowledge.publish must atomically promote the approved draft to the public copy'
);

select pg_temp.sa7_assert(
  exists (
    select 1
    from public.steel_knowledge_standard_pages
    where id=:'page_id'::uuid
      and page_status='published'
      and editorial_version=draft_version
      and intro='SA7 delegated draft intro — not live until Publisher approval'
  ),
  'published live version must equal the approved draft version'
);

select public.sa7_publish_knowledge_page(
  'standard',
  :'page_id'::uuid,
  'unpublish',
  'SA7 delegated unpublish acceptance'
) as unpublish_payload \gset

select count(*)::integer as public_count_after_unpublish
from public.k2_public_knowledge_standard(:'slug') \gset

select pg_temp.sa7_assert(
  :'unpublish_payload'::jsonb->>'page_status'='archived'
  and :'public_count_after_unpublish'::integer=0,
  'unpublish must remove the page from the anonymous K2 public contract'
);

-- Approved draft can be republished explicitly; rollback later restores the
-- original production/test fixture.
select public.sa7_publish_knowledge_page(
  'standard',
  :'page_id'::uuid,
  'publish',
  'SA7 delegated republish acceptance'
) as republish_payload \gset

select pg_temp.sa7_assert(
  :'republish_payload'::jsonb->>'page_status'='published',
  'an approved archived Knowledge page must be explicitly republishable'
);

reset role;

-- Audit ledger must retain the effective capability and actor for each stage.
select pg_temp.sa7_assert(
  exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a701'::uuid
      and permission_key='knowledge.edit'
      and action='knowledge_draft_saved'
      and entity_id=:'page_id'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a701'::uuid
      and permission_key='knowledge.edit'
      and action='knowledge_review_submitted'
      and entity_id=:'page_id'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a702'::uuid
      and permission_key='knowledge.review'
      and action='knowledge_draft_approved'
      and entity_id=:'page_id'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a702'::uuid
      and permission_key='knowledge.publish'
      and action='knowledge_page_published'
      and entity_id=:'page_id'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000a702'::uuid
      and permission_key='knowledge.publish'
      and action='knowledge_page_unpublished'
      and entity_id=:'page_id'
  ),
  'SA7 workflow mutations must write permission-aware Platform audit events'
);

select pg_temp.sa7_assert(
  not exists (
    select 1
    from public.organization_memberships
    where user_id in (
      '00000000-0000-0000-0000-00000000a701'::uuid,
      '00000000-0000-0000-0000-00000000a702'::uuid,
      '00000000-0000-0000-0000-00000000a703'::uuid
    )
  ),
  'Knowledge Platform Staff must not receive tenant membership'
);

-- Platform Auditor gets queue + quality visibility, but no mutations.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a703',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sa7_assert(
  public.has_platform_permission('knowledge.read_drafts')
  and public.has_platform_permission('knowledge.quality_audit')
  and not public.has_platform_permission('knowledge.edit')
  and not public.has_platform_permission('knowledge.review')
  and not public.has_platform_permission('knowledge.publish'),
  'Platform Auditor must remain read-only for Knowledge Operations'
);

select pg_temp.sa7_assert(
  jsonb_typeof(public.sa7_knowledge_queue(null,20)->'items')='array'
  and jsonb_typeof(public.sa7_knowledge_quality_audit()->'live_quality')='array',
  'Platform Auditor must read Knowledge queue and quality audit'
);

select pg_temp.sa7_assert_raises(
  format(
    'select public.sa7_review_knowledge_draft(%L,%L::uuid,%L,%L)',
    'standard',:'page_id','approve','auditor denied'
  ),
  'Platform permission required'
);

-- Ordinary authenticated users cannot enter the Knowledge control plane.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a704',true);

select pg_temp.sa7_assert_raises(
  'select public.sa7_knowledge_queue(null,20)',
  'Platform permission required'
);

-- Platform Owner retains implicit capability access.
select set_config('request.jwt.claim.sub',:'owner_id',true);

select pg_temp.sa7_assert(
  public.has_platform_permission('knowledge.read_drafts')
  and public.has_platform_permission('knowledge.edit')
  and public.has_platform_permission('knowledge.review')
  and public.has_platform_permission('knowledge.publish')
  and public.has_platform_permission('knowledge.quality_audit'),
  'Platform Owner must retain every Knowledge capability'
);

rollback;
