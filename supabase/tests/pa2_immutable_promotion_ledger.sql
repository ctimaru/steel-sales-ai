-- PA2.2e immutable commercial entity promotion ledger acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'PA2.2e assertion failed: %', message;
  end if;
end;
$$;

create or replace function pg_temp.assert_raises(statement text, expected_fragment text)
returns void
language plpgsql
as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm) = 0 then
      raise exception 'PA2.2e expected error containing "%", got "%"', expected_fragment, sqlerrm;
    end if;
    return;
  end;
  raise exception 'PA2.2e statement unexpectedly succeeded: %', statement;
end;
$$;

select pg_temp.assert_true(
  to_regclass('public.commercial_entity_promotions') is not null,
  'promotion ledger table must exist'
);

select pg_temp.assert_true(
  has_function_privilege(
    'authenticated',
    'public.record_commercial_entity_promotion(uuid,bigint,text,uuid,text,text,text,numeric,text,bigint,bigint,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.record_commercial_entity_promotion(uuid,bigint,text,uuid,text,text,text,numeric,text,bigint,bigint,jsonb)',
    'EXECUTE'
  ),
  'promotion writer must be authenticated/service only'
);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000025a1', 'writer-a@pa22e.example'),
  ('00000000-0000-0000-0000-0000000025b1', 'writer-b@pa22e.example');

insert into public.organizations (id, name, slug, created_by, onboarding_status)
values
  ('00000000-0000-0000-0000-0000000025f1', 'PA22E Org A', 'pa22e-org-a', '00000000-0000-0000-0000-0000000025a1', 'completed'),
  ('00000000-0000-0000-0000-0000000025f2', 'PA22E Org B', 'pa22e-org-b', '00000000-0000-0000-0000-0000000025b1', 'completed');

insert into public.organization_memberships (
  organization_id,user_id,role,business_role,status,is_default
) values
  ('00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-0000000025a1','admin','sales_director','active',true),
  ('00000000-0000-0000-0000-0000000025f2','00000000-0000-0000-0000-0000000025b1','admin','sales_director','active',true);

insert into public.commercial_datasets (
  id,owner_id,source_run_id,source_filename,organization_id
) values
  ('00000000-0000-0000-0000-000000002501','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-000000002511','pa22e-a.eml','00000000-0000-0000-0000-0000000025f1');

insert into public.commercial_threads (
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
  ('00000000-0000-0000-0000-000000002521','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-000000002501','00000000-0000-0000-0000-000000002531','PA22E fixture','rfq','2026-09-21T15:00:00Z','00000000-0000-0000-0000-0000000025f1');

insert into public.commercial_observations (
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
  source_filename,source_text,confidence,search_text,organization_id
) values (
  25001,
  '00000000-0000-0000-0000-0000000025a1',
  '00000000-0000-0000-0000-000000002501',
  '00000000-0000-0000-0000-000000002521',
  '00000000-0000-0000-0000-000000002531',
  'requested','inbound','round_tube','S355',273,8,12000,2,'PACCHI',
  'pa22e-a.eml','Tubo tondo 273x8 a 12000 | 2 pacchi | s355',0.95,
  's355 273 8 12000 2 pacchi',
  '00000000-0000-0000-0000-0000000025f1'
);

insert into public.commercial_review_queue (
  id,owner_id,dataset_id,thread_id,source_review_id,reason,severity,source_text,status,
  observation_id,organization_id
) values (
  25001,
  '00000000-0000-0000-0000-0000000025a1',
  '00000000-0000-0000-0000-000000002501',
  '00000000-0000-0000-0000-000000002521',
  25001,'manual_check','warning','fixture','pending',
  25001,'00000000-0000-0000-0000-0000000025f1'
);

insert into public.companies (id, owner_id, organization_id, name, company_type)
values
  ('00000000-0000-0000-0000-000000002541','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','Customer A','customer'),
  ('00000000-0000-0000-0000-000000002542','00000000-0000-0000-0000-0000000025b1','00000000-0000-0000-0000-0000000025f2','Customer B','customer');

insert into public.rfqs (
  id, owner_id, organization_id, company_id, created_by_user_id, requested_at
) values
  ('00000000-0000-0000-0000-000000002551','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002541','00000000-0000-0000-0000-0000000025a1',now()),
  ('00000000-0000-0000-0000-000000002552','00000000-0000-0000-0000-0000000025b1','00000000-0000-0000-0000-0000000025f2','00000000-0000-0000-0000-000000002542','00000000-0000-0000-0000-0000000025b1',now());

-- Tenant A can create a promotion through the controlled RPC.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000025a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.record_commercial_entity_promotion(
  '00000000-0000-0000-0000-0000000025f1',
  25001,
  'rfq',
  '00000000-0000-0000-0000-000000002551',
  null,
  'created',
  'applied',
  0.95,
  'human_review',
  25001,
  null,
  '{"fixture":"pa22e"}'::jsonb
) as first_promotion_id
\gset

select pg_temp.assert_true(
  :'first_promotion_id'::bigint > 0,
  'controlled writer must return promotion id'
);

-- Repeating the identical event is idempotent and returns the same row.
select public.record_commercial_entity_promotion(
  '00000000-0000-0000-0000-0000000025f1',
  25001,
  'rfq',
  '00000000-0000-0000-0000-000000002551',
  null,
  'created',
  'applied',
  0.95,
  'human_review',
  25001,
  null,
  '{"fixture":"duplicate"}'::jsonb
) as duplicate_promotion_id
\gset

select pg_temp.assert_true(
  :'duplicate_promotion_id'::bigint = :'first_promotion_id'::bigint,
  'identical promotion must be idempotent'
);

select pg_temp.assert_true(
  (select count(*) from public.commercial_entity_promotions where observation_id=25001) = 1,
  'idempotent repeat must not append a duplicate row'
);

-- Cross-tenant target must fail closed.
select pg_temp.assert_raises(
  $stmt$
    select public.record_commercial_entity_promotion(
      '00000000-0000-0000-0000-0000000025f1',
      25001,
      'rfq',
      '00000000-0000-0000-0000-000000002552',
      null,'linked','applied',0.9,'manual_link',null,null,'{}'::jsonb
    )
  $stmt$,
  'Promotion target not found in organization'
);

-- Direct INSERT is denied to authenticated callers.
select pg_temp.assert_raises(
  $stmt$
    insert into public.commercial_entity_promotions (
      organization_id,observation_id,entity_type,entity_id,promotion_action,status,promoted_by
    ) values (
      '00000000-0000-0000-0000-0000000025f1',
      25001,'rfq','00000000-0000-0000-0000-000000002551',
      'linked','applied','00000000-0000-0000-0000-0000000025a1'
    )
  $stmt$,
  'permission denied'
);

-- Append-only supersession creates a second event; it never mutates the first.
select public.record_commercial_entity_promotion(
  '00000000-0000-0000-0000-0000000025f1',
  25001,
  'rfq',
  '00000000-0000-0000-0000-000000002551',
  'status',
  'superseded',
  'superseded',
  1.0,
  'human_review',
  25001,
  :'first_promotion_id'::bigint,
  '{"reason":"replacement"}'::jsonb
) as supersession_id
\gset

select pg_temp.assert_true(
  :'supersession_id'::bigint <> :'first_promotion_id'::bigint
  and (select count(*) from public.commercial_entity_promotions where observation_id=25001)=2
  and exists (
    select 1 from public.commercial_entity_promotions
    where id=:'supersession_id'::bigint
      and supersedes_promotion_id=:'first_promotion_id'::bigint
      and promotion_action='superseded'
      and status='superseded'
  ),
  'supersession must append a new linked audit event'
);

reset role;
set local role service_role;

-- Even privileged service paths cannot mutate rows normally; trigger enforces append-only.
select pg_temp.assert_raises(
  format(
    'update public.commercial_entity_promotions set basis=%L where id=%s',
    'tampered',
    :'first_promotion_id'
  ),
  'commercial_entity_promotions is append-only'
);

select pg_temp.assert_raises(
  format(
    'delete from public.commercial_entity_promotions where id=%s',
    :'first_promotion_id'
  ),
  'commercial_entity_promotions is append-only'
);

reset role;
rollback;
