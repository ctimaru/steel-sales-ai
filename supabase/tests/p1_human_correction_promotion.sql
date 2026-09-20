-- P1.11a — controlled correction promotion acceptance.
-- Disposable CI database only.

begin;

insert into auth.users (id,email) values
  ('00000000-0000-0000-0000-000000011101','p111-a@test.invalid'),
  ('00000000-0000-0000-0000-000000011102','p111-b@test.invalid');

insert into public.organizations (id,name,slug,created_by,onboarding_status) values
  ('00000000-0000-0000-0000-000000011110','P1.11 Tenant A','p111-a','00000000-0000-0000-0000-000000011101','completed'),
  ('00000000-0000-0000-0000-000000011120','P1.11 Tenant B','p111-b','00000000-0000-0000-0000-000000011102','completed');

insert into public.organization_memberships (
  organization_id,user_id,role,status,is_default
) values
  ('00000000-0000-0000-0000-000000011110','00000000-0000-0000-0000-000000011101','member','active',true),
  ('00000000-0000-0000-0000-000000011120','00000000-0000-0000-0000-000000011102','member','active',true);

insert into public.commercial_datasets (
  id,owner_id,organization_id,source_run_id,source_filename,status
) values (
  '00000000-0000-0000-0000-000000011130',
  '00000000-0000-0000-0000-000000011101',
  '00000000-0000-0000-0000-000000011110',
  '00000000-0000-0000-0000-000000011131',
  'p111-fixture.eml','active'
);

insert into public.commercial_threads (
  id,owner_id,organization_id,dataset_id,source_conversation_id,
  subject,classification,started_at,last_activity_at
) values (
  '00000000-0000-0000-0000-000000011140',
  '00000000-0000-0000-0000-000000011101',
  '00000000-0000-0000-0000-000000011110',
  '00000000-0000-0000-0000-000000011130',
  '00000000-0000-0000-0000-000000011141',
  'P1.11 fixture','offer',now(),now()
);

insert into public.commercial_observations (
  id,owner_id,organization_id,dataset_id,thread_id,source_conversation_id,
  item_role,product_type,grade,standard,outer_diameter_mm,thickness_mm,
  length_mm,quantity,quantity_unit,price_value,price_unit,currency,
  availability_status,source_filename,source_text,source_clause,confidence,
  flags,search_text,canonical_product_key,canonical_product_id
) values (
  911101,
  '00000000-0000-0000-0000-000000011101',
  '00000000-0000-0000-0000-000000011110',
  '00000000-0000-0000-0000-000000011130',
  '00000000-0000-0000-0000-000000011140',
  '00000000-0000-0000-0000-000000011141',
  'offered','round_tube','P235GH','EN 10216-2',168.3,7.11,
  6000,20,'T',800,'T','EUR',
  'production','p111-fixture.eml','Offer source remains immutable.','Offer source remains immutable.',0.82,
  '["low_confidence"]'::jsonb,
  'offer source p235gh en 10216-2 168.3 7.11 6000 20 t 800 t eur',
  public.canonical_tube_product_key('round_tube','P235GH','EN 10216-2',null,168.3,null,null,7.11,null),
  public.canonical_tube_product_id('round_tube','P235GH','EN 10216-2',null,168.3,null,null,7.11,null)
);

insert into public.commercial_review_queue (
  id,owner_id,organization_id,dataset_id,thread_id,source_review_id,
  reason,severity,source_text,status,observation_id
) values (
  911102,
  '00000000-0000-0000-0000-000000011101',
  '00000000-0000-0000-0000-000000011110',
  '00000000-0000-0000-0000-000000011130',
  '00000000-0000-0000-0000-000000011140',
  911101,'low_confidence_worker_extraction','warning',
  'Offer source remains immutable.','pending',911101
);

create or replace function pg_temp.p111_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P1.11a assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.p111_assert(
  not has_table_privilege('authenticated','public.commercial_observations','UPDATE'),
  'browser role must remain unable to update commercial observations directly'
);

select pg_temp.p111_assert(
  not has_function_privilege(
    'authenticated',
    'public.p1_apply_review_correction(bigint,uuid,uuid,jsonb,jsonb)',
    'EXECUTE'
  ),
  'correction writer must remain service-role only'
);

do $$
declare
  v_result jsonb;
  v_repeat jsonb;
  v_expected_key text;
  v_expected_id uuid;
begin
  select public.p1_apply_review_correction(
    911102,
    '00000000-0000-0000-0000-000000011101',
    '00000000-0000-0000-0000-000000011110',
    jsonb_build_object(
      'grade','P265GH',
      'standard','EN 10216-2',
      'outer_diameter_mm','168.3',
      'thickness_mm','7.11',
      'length_mm','12000',
      'quantity','55',
      'quantity_unit','t',
      'price_value','900',
      'price_unit','t',
      'currency','eur',
      'availability_status','stock',
      'note','validated against original document'
    ),
    jsonb_build_object('acceptance_test',true)
  ) into v_result;

  if coalesce((v_result->>'applied')::boolean,false) is not true
     or coalesce((v_result->>'idempotent')::boolean,true) is not false then
    raise exception 'first correction promotion did not apply: %',v_result;
  end if;

  v_expected_key := public.canonical_tube_product_key(
    'round_tube','P265GH','EN 10216-2',null,168.3,null,null,7.11,null
  );
  v_expected_id := public.canonical_tube_product_id(
    'round_tube','P265GH','EN 10216-2',null,168.3,null,null,7.11,null
  );

  if not exists (
    select 1
    from public.commercial_observations o
    where o.id=911101
      and o.grade='P265GH'
      and o.standard='EN 10216-2'
      and o.length_mm=12000
      and o.quantity=55
      and o.quantity_unit='T'
      and o.price_value=900
      and o.price_unit='T'
      and o.currency='EUR'
      and o.availability_status='stock'
      and o.canonical_product_key=v_expected_key
      and o.canonical_product_id=v_expected_id
      and o.search_text ilike '%p265gh%'
      and o.search_text ilike '%12000%'
      and o.flags @> '["human_corrected"]'::jsonb
      and o.source_text='Offer source remains immutable.'
  ) then
    raise exception 'commercial observation did not receive corrected values / canonical identity';
  end if;

  if not exists (
    select 1
    from public.commercial_review_queue rq
    where rq.id=911102
      and rq.status='corrected'
      and rq.corrected_values->>'grade'='P265GH'
      and rq.reviewed_at is not null
  ) then
    raise exception 'review row was not finalized';
  end if;

  if not exists (
    select 1
    from public.commercial_correction_events e
    where e.review_id=911102
      and e.observation_id=911101
      and e.actor_user_id='00000000-0000-0000-0000-000000011101'
      and e.before_values->>'grade'='P235GH'
      and e.corrected_values->>'grade'='P265GH'
      and e.after_values->>'grade'='P265GH'
      and e.note='validated against original document'
      and e.new_canonical_product_id=v_expected_id
      and coalesce((e.metadata->>'source_provenance_preserved')::boolean,false)
  ) then
    raise exception 'append-only correction audit was not recorded';
  end if;

  select public.p1_apply_review_correction(
    911102,
    '00000000-0000-0000-0000-000000011101',
    '00000000-0000-0000-0000-000000011110',
    jsonb_build_object('grade','P265GH'),
    '{}'::jsonb
  ) into v_repeat;

  if coalesce((v_repeat->>'idempotent')::boolean,false) is not true
     or (select count(*) from public.commercial_correction_events where review_id=911102)<>1 then
    raise exception 'correction writer is not idempotent: %',v_repeat;
  end if;
end
$$;

do $$
begin
  begin
    perform public.p1_apply_review_correction(
      911102,
      '00000000-0000-0000-0000-000000011102',
      '00000000-0000-0000-0000-000000011110',
      jsonb_build_object('grade','S355J2H'),
      '{}'::jsonb
    );
    raise exception 'cross-tenant actor unexpectedly promoted correction';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

rollback;
