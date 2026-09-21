-- P1.11 — human correction promotion acceptance.
-- Disposable CI database only. Everything rolls back.

begin;

insert into auth.users (id,email) values
  ('00000000-0000-0000-0000-0000000018a1','correction-a@p1-test.example'),
  ('00000000-0000-0000-0000-0000000018b1','correction-b@p1-test.example');

insert into public.organizations (id,name,slug,created_by,onboarding_status) values
  ('00000000-0000-0000-0000-0000000018f1','Correction Tenant A','correction-tenant-a','00000000-0000-0000-0000-0000000018a1','completed'),
  ('00000000-0000-0000-0000-0000000018f2','Correction Tenant B','correction-tenant-b','00000000-0000-0000-0000-0000000018b1','completed');

insert into public.organization_memberships (
  organization_id,user_id,role,status,is_default
) values
  ('00000000-0000-0000-0000-0000000018f1','00000000-0000-0000-0000-0000000018a1','admin','active',true),
  ('00000000-0000-0000-0000-0000000018f2','00000000-0000-0000-0000-0000000018b1','admin','active',true);

insert into public.commercial_datasets (
  id,owner_id,source_run_id,source_filename,organization_id
) values
  ('00000000-0000-0000-0000-000000001801','00000000-0000-0000-0000-0000000018a1','00000000-0000-0000-0000-000000001811','correction-a.eml','00000000-0000-0000-0000-0000000018f1');

insert into public.commercial_threads (
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
  ('00000000-0000-0000-0000-000000001821','00000000-0000-0000-0000-0000000018a1','00000000-0000-0000-0000-000000001801','00000000-0000-0000-0000-000000001831','Correction fixture','offer','2026-09-21T08:00:00Z','00000000-0000-0000-0000-0000000018f1');

insert into public.commercial_observations (
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  product_type,grade,standard,outer_diameter_mm,thickness_mm,length_mm,
  quantity,quantity_unit,price_value,price_unit,currency,availability_status,
  source_filename,source_text,confidence,search_text,organization_id
) values (
  18001,
  '00000000-0000-0000-0000-0000000018a1',
  '00000000-0000-0000-0000-000000001801',
  '00000000-0000-0000-0000-000000001821',
  '00000000-0000-0000-0000-000000001831',
  'offered','outbound','round_tube','P235GH','EN 10216-2',168.3,7.11,12000,
  10,'PZ',900,'T','EUR','available',
  'correction-a.eml','Documento originale: P235GH 168,3 x 7,11',0.98,
  'p235gh en10216-2 168.3 7.11 12000 10 pz 900 t eur available',
  '00000000-0000-0000-0000-0000000018f1'
);

insert into public.commercial_review_queue (
  id,owner_id,dataset_id,thread_id,source_review_id,reason,severity,source_text,status,
  observation_id,organization_id
) values (
  18001,
  '00000000-0000-0000-0000-0000000018a1',
  '00000000-0000-0000-0000-000000001801',
  '00000000-0000-0000-0000-000000001821',
  18001,'grade_conflict','warning','Documento originale: P235GH 168,3 x 7,11','pending',
  18001,'00000000-0000-0000-0000-0000000018f1'
);

create or replace function pg_temp.p111_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P1.11 assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.p111_assert(
  has_function_privilege(
    'authenticated',
    'public.p1_apply_commercial_review_correction(bigint,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.p1_apply_commercial_review_correction(bigint,jsonb)',
    'EXECUTE'
  ),
  'correction writer must be authenticated/service only'
);

-- Cross-tenant correction must fail.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000018b1',true);
select set_config('request.jwt.claim.role','authenticated',true);

do $$
begin
  begin
    perform public.p1_apply_commercial_review_correction(
      18001,
      '{"grade":"P265GH"}'::jsonb
    );
    raise exception 'cross-tenant correction unexpectedly succeeded';
  exception
    when sqlstate '42501' then null;
  end;
end
$$;

select pg_temp.p111_assert(
  (select status='pending' from public.commercial_review_queue where id=18001) is not true,
  'tenant B must not see tenant A review through RLS'
);

reset role;

-- Tenant A correction: grade and quantity change atomically.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000018a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p1_apply_commercial_review_correction(
  18001,
  '{"grade":"P265GH","quantity":"12","note":"Corretto dopo verifica manuale"}'::jsonb
);

select pg_temp.p111_assert(
  exists(
    select 1
    from public.commercial_observations
    where id=18001
      and grade='P265GH'
      and quantity=12
      and search_text ilike '%p265gh%'
      and canonical_product_key=public.canonical_tube_product_key(
        'round_tube','P265GH','EN 10216-2',null,168.3,null,null,7.11,null
      )
      and canonical_product_id=public.canonical_tube_product_id(
        'round_tube','P265GH','EN 10216-2',null,168.3,null,null,7.11,null
      )
  ),
  'corrected observation must refresh structured fields, search and product identity'
);

select pg_temp.p111_assert(
  exists(
    select 1 from public.commercial_review_queue
    where id=18001
      and status='corrected'
      and reviewed_by='00000000-0000-0000-0000-0000000018a1'
      and corrected_values->>'grade'='P265GH'
      and corrected_values->>'quantity'='12'
      and reviewed_at is not null
  ),
  'review queue must record correction status and reviewer'
);

select pg_temp.p111_assert(
  exists(
    select 1 from public.commercial_correction_events
    where review_id=18001
      and observation_id=18001
      and corrected_by='00000000-0000-0000-0000-0000000018a1'
      and original_values->>'grade'='P235GH'
      and requested_values->>'grade'='P265GH'
      and resulting_values->>'grade'='P265GH'
      and note='Corretto dopo verifica manuale'
      and previous_canonical_product_id is distinct from resulting_canonical_product_id
  ),
  'append-only correction event must preserve before/request/result lineage'
);

-- Search/Product 360 are intentionally service-role-only. The worker resolves
-- the authenticated tenant first, then calls these RPCs with organization_id.
reset role;
set local role service_role;

select pg_temp.p111_assert(
  (public.p1_global_structured_search(
    '00000000-0000-0000-0000-0000000018f1',
    'P265GH',
    array['offer']::text[],
    '{}'::jsonb,
    20
  )->>'total')::integer >= 1,
  'Search must immediately find corrected structured data'
);

select pg_temp.p111_assert(
  (
    public.p1_product_360(
      '00000000-0000-0000-0000-0000000018f1',
      public.canonical_tube_product_id(
        'round_tube','P265GH','EN 10216-2',null,168.3,null,null,7.11,null
      ),
      20
    )->'product'->>'grade'
  )='P265GH',
  'Product 360 must immediately expose corrected product identity'
);

select pg_temp.p111_assert(
  (
    public.p1_product_360(
      '00000000-0000-0000-0000-0000000018f1',
      public.canonical_tube_product_id(
        'round_tube','P235GH','EN 10216-2',null,168.3,null,null,7.11,null
      ),
      20
    )->>'found'
  )::boolean=false,
  'old product identity must no longer own the corrected observation'
);

-- Correction is one-shot/idempotency-safe through pending status.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000018a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

do $$
begin
  begin
    perform public.p1_apply_commercial_review_correction(
      18001,
      '{"grade":"P355GH"}'::jsonb
    );
    raise exception 'repeat correction unexpectedly succeeded';
  exception
    when sqlstate '55000' then null;
  end;
end
$$;

-- Unsupported immutable fields must fail before mutation.
-- Review Queue is service-populated by design: create the fixture with the
-- service role, then return to the authenticated actor for the correction RPC.
reset role;
set local role service_role;

insert into public.commercial_review_queue (
  id,owner_id,dataset_id,thread_id,source_review_id,reason,severity,source_text,status,
  observation_id,organization_id
) values (
  18002,
  '00000000-0000-0000-0000-0000000018a1',
  '00000000-0000-0000-0000-000000001801',
  '00000000-0000-0000-0000-000000001821',
  18002,'manual_check','warning','fixture','pending',
  18001,'00000000-0000-0000-0000-0000000018f1'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000018a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

do $p111$
begin
  begin
    perform public.p1_apply_commercial_review_correction(
      18002,
      '{"organization_id":"00000000-0000-0000-0000-0000000018f2"}'::jsonb
    );
    raise exception 'immutable-field correction unexpectedly succeeded';
  exception
    when sqlstate '22023' then null;
  end;
end
$p111$;

select pg_temp.p111_assert(
  (select organization_id='00000000-0000-0000-0000-0000000018f1'
   from public.commercial_observations where id=18001),
  'correction must never move an observation across tenants'
);

-- Audit is append-only at both permission and trigger layers.
select pg_temp.p111_assert(
  not has_table_privilege(
    'authenticated',
    'public.commercial_correction_events',
    'UPDATE,DELETE'
  ),
  'authenticated role must not mutate correction audit'
);

reset role;
set local role service_role;

do $
begin
  begin
    update public.commercial_correction_events
    set note='tampered'
    where review_id=18001;
    raise exception 'audit update unexpectedly succeeded';
  exception
    when sqlstate '55000' then null;
  end;
end
$;

reset role;
rollback;
