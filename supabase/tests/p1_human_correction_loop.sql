-- P1.11 — Human correction loop acceptance.
-- Disposable CI database only.

begin;

create or replace function pg_temp.p111_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P1.11 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-0000000011a1'::uuid,'p111-a@test.example'),
  ('00000000-0000-0000-0000-0000000011b1'::uuid,'p111-b@test.example');

insert into public.organizations(
  id,name,slug,created_by,onboarding_status
) values
  (
    '00000000-0000-0000-0000-0000000011f1'::uuid,
    'P1.11 Org A','p111-org-a',
    '00000000-0000-0000-0000-0000000011a1'::uuid,'completed'
  ),
  (
    '00000000-0000-0000-0000-0000000011f2'::uuid,
    'P1.11 Org B','p111-org-b',
    '00000000-0000-0000-0000-0000000011b1'::uuid,'completed'
  );

insert into public.organization_memberships(
  organization_id,user_id,role,status,is_default
) values
  (
    '00000000-0000-0000-0000-0000000011f1',
    '00000000-0000-0000-0000-0000000011a1','admin','active',true
  ),
  (
    '00000000-0000-0000-0000-0000000011f2',
    '00000000-0000-0000-0000-0000000011b1','admin','active',true
  );

insert into public.commercial_datasets(
  id,owner_id,organization_id,source_run_id,source_filename,parser_version,status
) values (
  '00000000-0000-0000-0000-0000000011c1',
  '00000000-0000-0000-0000-0000000011a1',
  '00000000-0000-0000-0000-0000000011f1',
  '00000000-0000-0000-0000-0000000011c2',
  'p111.txt','v4','active'
);

insert into public.worker_jobs(
  id,filename,extension,size_bytes,status,parser_version,
  owner_id,organization_id,dataset_id
) values (
  911001,
  '00000000-0000-0000-0000-0000000011d1',
  'p111.txt','.txt',128,'completed','v4',
  '00000000-0000-0000-0000-0000000011a1',
  '00000000-0000-0000-0000-0000000011f1',
  '00000000-0000-0000-0000-0000000011c1'
);

insert into public.worker_staging_observations(
  id,job_id,source_filename,source_text,item_role,grade,standard,
  outer_diameter_mm,thickness_mm,length_mm,price_value,price_unit,currency,
  confidence,metadata
) values (
  '00000000-0000-0000-0000-0000000011d1',
  'p111.txt',
  'P265GH 168.3 x 7.11 x 12000 EN 10216-2 EUR 999/T',
  'offered','P265GH','EN 10216-2',
  168.3,7.11,12000,999,'T','EUR',0.75,'{}'::jsonb
);

insert into public.commercial_threads(
  id,owner_id,organization_id,dataset_id,source_conversation_id,
  subject,classification,started_at,last_activity_at,email_count
) values (
  '00000000-0000-0000-0000-0000000011e1',
  '00000000-0000-0000-0000-0000000011a1',
  '00000000-0000-0000-0000-0000000011f1',
  '00000000-0000-0000-0000-0000000011c1',
  '00000000-0000-0000-0000-0000000011d1',
  'P1.11 fixture','offer',now(),now(),0
);

insert into public.commercial_observations(
  id,owner_id,organization_id,dataset_id,thread_id,source_extraction_id,
  source_conversation_id,item_role,product_type,grade,standard,
  outer_diameter_mm,thickness_mm,length_mm,price_value,price_unit,currency,
  source_filename,source_text,source_clause,confidence,flags,search_text,
  canonical_product_key,canonical_product_id
) values (
  911002,
  '00000000-0000-0000-0000-0000000011a1',
  '00000000-0000-0000-0000-0000000011f1',
  '00000000-0000-0000-0000-0000000011c1',
  '00000000-0000-0000-0000-0000000011e1',
  911001,
  '00000000-0000-0000-0000-0000000011d1',
  'offered','round_tube','P265GH','EN 10216-2',
  168.3,7.11,12000,999,'T','EUR',
  'p111.txt',
  'P265GH 168.3 x 7.11 x 12000 EN 10216-2 EUR 999/T',
  'P265GH 168.3 x 7.11 x 12000 EN 10216-2 EUR 999/T',
  0.75,'[]'::jsonb,
  'p265gh 168.3 7.11 12000 en 10216-2 999 t eur',
  public.canonical_tube_product_key(
    'round_tube','P265GH','EN 10216-2',null,168.3,null,null,7.11,null
  ),
  public.canonical_tube_product_id(
    'round_tube','P265GH','EN 10216-2',null,168.3,null,null,7.11,null
  )
);

insert into public.commercial_review_queue(
  id,owner_id,organization_id,dataset_id,thread_id,source_review_id,
  reason,severity,source_text,status,observation_id
) values (
  911003,
  '00000000-0000-0000-0000-0000000011a1',
  '00000000-0000-0000-0000-0000000011f1',
  '00000000-0000-0000-0000-0000000011c1',
  '00000000-0000-0000-0000-0000000011e1',
  911002,
  'p111_fixture','warning','fixture','pending',911002
);;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-0000000011a1',
  true
);
select set_config('request.jwt.claim.role','authenticated',true);

do $$
declare
  v_review_id bigint;
  v_result jsonb;
  v_repeat jsonb;
begin
  v_review_id := 911003;

  v_result := public.p1_apply_commercial_review_correction(
    v_review_id,
    jsonb_build_object(
      'grade','P355NH',
      'price_value',1050,
      'length_mm',6000
    ),
    'human verified fixture'
  );

  if v_result->>'status' <> 'corrected' then
    raise exception 'P1.11 correction RPC did not return corrected';
  end if;

  v_repeat := public.p1_apply_commercial_review_correction(
    v_review_id,
    jsonb_build_object(
      'grade','P355NH',
      'price_value',1050,
      'length_mm',6000
    ),
    'retry'
  );

  if v_repeat->>'status' <> 'already_corrected' then
    raise exception 'P1.11 correction retry is not idempotent';
  end if;
end
$$;

select pg_temp.p111_assert(
  exists(
    select 1
    from public.commercial_observations
    where organization_id='00000000-0000-0000-0000-0000000011f1'::uuid
      and grade='P355NH'
      and price_value=1050
      and length_mm=6000
      and canonical_product_key like '%grade=p355nh%'
      and canonical_product_id is not null
      and search_text like '%p355nh%'
      and flags @> '["human_corrected"]'::jsonb
  ),
  'corrected observation/search/product identity must be visible to tenant A'
);

select pg_temp.p111_assert(
  exists(
    select 1
    from public.commercial_review_queue
    where organization_id='00000000-0000-0000-0000-0000000011f1'::uuid
      and reason='p111_fixture'
      and status='corrected'
      and corrected_values->>'grade'='P355NH'
      and reviewed_at is not null
  ),
  'review queue row must close as corrected'
);

select pg_temp.p111_assert(
  exists(
    select 1
    from public.commercial_correction_events
    where organization_id='00000000-0000-0000-0000-0000000011f1'::uuid
      and actor_id='00000000-0000-0000-0000-0000000011a1'::uuid
      and before_values->>'grade'='P265GH'
      and after_values->>'grade'='P355NH'
      and corrected_values->>'price_value'='1050'
      and note='human verified fixture'
  ),
  'append-only audit event must capture before/correction/after'
);

reset role;

select pg_temp.p111_assert(
  exists(
    select 1
    from public.worker_staging_observations
    where job_id='00000000-0000-0000-0000-0000000011d1'::uuid
      and grade='P265GH'
      and price_value=999
      and length_mm=12000
      and source_text='P265GH 168.3 x 7.11 x 12000 EN 10216-2 EUR 999/T'
  ),
  'source/staging evidence must remain unchanged'
);

select pg_temp.p111_assert(
  coalesce((
    public.p1_global_structured_search(
      '00000000-0000-0000-0000-0000000011f1'::uuid,
      'P355NH',
      array['offer','product']::text[],
      '{}'::jsonb,
      20
    )->>'total'
  )::integer,0) > 0,
  'global search must immediately see corrected value'
);

do $$
declare
  v_new_product_id uuid;
  v_old_product_id uuid;
  v_new jsonb;
  v_old jsonb;
begin
  select canonical_product_id into v_new_product_id
  from public.commercial_observations
  where organization_id='00000000-0000-0000-0000-0000000011f1'::uuid
  limit 1;

  v_old_product_id := public.canonical_tube_product_id(
    'round_tube','P265GH','EN 10216-2',null,168.3,null,null,7.11,null
  );

  v_new := public.p1_product_360(
    '00000000-0000-0000-0000-0000000011f1'::uuid,
    v_new_product_id,
    20
  );

  v_old := public.p1_product_360(
    '00000000-0000-0000-0000-0000000011f1'::uuid,
    v_old_product_id,
    20
  );

  if coalesce((v_new->>'found')::boolean,false) is not true
     or v_new #>> '{product,grade}' <> 'P355NH'
     or (v_new #>> '{latest_price,value}')::numeric <> 1050 then
    raise exception 'P1.11 Product 360 did not follow corrected product identity';
  end if;

  if coalesce((v_old->>'found')::boolean,false) then
    raise exception 'P1.11 old product identity still owns corrected fixture';
  end if;
end
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-0000000011b1',
  true
);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p111_assert(
  not exists(
    select 1 from public.commercial_correction_events
    where organization_id='00000000-0000-0000-0000-0000000011f1'::uuid
  ),
  'tenant B must not read tenant A correction audit'
);

do $$
begin
  begin
    perform public.p1_apply_commercial_review_correction(
      911003,
      jsonb_build_object('grade','P235GH'),
      'cross tenant attempt'
    );
    raise exception 'cross-tenant correction unexpectedly succeeded';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;;

reset role;

do $$
declare
  v_event_id uuid;
begin
  select id into v_event_id
  from public.commercial_correction_events
  where organization_id='00000000-0000-0000-0000-0000000011f1'::uuid
  limit 1;

  begin
    update public.commercial_correction_events
    set note='tampered'
    where id=v_event_id;
    raise exception 'correction audit unexpectedly mutable';
  exception
    when invalid_parameter_value then
      null;
  end;
end
$$;

select pg_temp.p111_assert(
  not has_function_privilege(
    'anon',
    'public.p1_apply_commercial_review_correction(bigint,jsonb,text)',
    'EXECUTE'
  ),
  'anon must not execute correction RPC'
);

select pg_temp.p111_assert(
  has_function_privilege(
    'authenticated',
    'public.p1_apply_commercial_review_correction(bigint,jsonb,text)',
    'EXECUTE'
  ),
  'authenticated must execute correction RPC'
);

select pg_temp.p111_assert(
  not has_function_privilege(
    'authenticated',
    'public.p1_commercial_correction_feedback(uuid,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.p1_commercial_correction_feedback(uuid,integer)',
    'EXECUTE'
  ),
  'correction feedback dataset must remain service-only'
);

rollback;
