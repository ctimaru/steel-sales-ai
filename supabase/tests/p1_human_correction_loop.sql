-- P1.11 — Human correction promotion loop acceptance.
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

insert into auth.users (id,email) values
  ('00000000-0000-0000-0000-0000000111a1','p111-owner@example.test'),
  ('00000000-0000-0000-0000-0000000111b1','p111-teammate@example.test'),
  ('00000000-0000-0000-0000-0000000111c1','p111-outsider@example.test');

insert into public.organizations (id,name,slug,created_by,onboarding_status) values
  ('00000000-0000-0000-0000-0000000111f1','P1.11 Team','p111-team','00000000-0000-0000-0000-0000000111a1','completed'),
  ('00000000-0000-0000-0000-0000000111f2','P1.11 Other','p111-other','00000000-0000-0000-0000-0000000111c1','completed');

insert into public.organization_memberships (
  organization_id,user_id,role,status,is_default
) values
  ('00000000-0000-0000-0000-0000000111f1','00000000-0000-0000-0000-0000000111a1','admin','active',true),
  ('00000000-0000-0000-0000-0000000111f1','00000000-0000-0000-0000-0000000111b1','member','active',true),
  ('00000000-0000-0000-0000-0000000111f2','00000000-0000-0000-0000-0000000111c1','admin','active',true);

insert into public.commercial_datasets (
  id,owner_id,source_run_id,source_filename,parser_version,status,organization_id
) values (
  '00000000-0000-0000-0000-000000011101',
  '00000000-0000-0000-0000-0000000111a1',
  '00000000-0000-0000-0000-000000011102',
  'p111-fixture.pdf','v4','ready',
  '00000000-0000-0000-0000-0000000111f1'
);

insert into public.commercial_threads (
  id,owner_id,dataset_id,source_conversation_id,subject,classification,
  started_at,last_activity_at,organization_id
) values (
  '00000000-0000-0000-0000-000000011103',
  '00000000-0000-0000-0000-0000000111a1',
  '00000000-0000-0000-0000-000000011101',
  '00000000-0000-0000-0000-000000011104',
  'P1.11 correction fixture','offer',
  now()-interval '1 day',now(),
  '00000000-0000-0000-0000-0000000111f1'
);

insert into public.commercial_observations (
  id,owner_id,dataset_id,thread_id,source_conversation_id,
  item_role,role_method,direction,product_type,grade,standard,
  outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
  price_value,price_unit,currency,availability_status,
  source_filename,source_text,confidence,flags,organization_id
) values (
  911101,
  '00000000-0000-0000-0000-0000000111a1',
  '00000000-0000-0000-0000-000000011101',
  '00000000-0000-0000-0000-000000011103',
  '00000000-0000-0000-0000-000000011104',
  'offered','worker_v4','outbound','round_tube','P265GH','EN 10216-2',
  168.30,7.11,12000,10,'T',
  850,'EUR/t','EUR','production',
  'p111-fixture.pdf','P265GH EN 10216-2 168.3x7.11 qty 10',0.82,'[]',
  '00000000-0000-0000-0000-0000000111f1'
);

insert into public.commercial_review_queue (
  id,owner_id,dataset_id,thread_id,source_review_id,reason,severity,
  source_text,status,observation_id,organization_id
) values
  (
    911201,
    '00000000-0000-0000-0000-0000000111a1',
    '00000000-0000-0000-0000-000000011101',
    '00000000-0000-0000-0000-000000011103',
    911101,'low_confidence_grade','warning',
    'P265GH EN 10216-2 168.3x7.11 qty 10','pending',911101,
    '00000000-0000-0000-0000-0000000111f1'
  ),
  (
    911202,
    '00000000-0000-0000-0000-0000000111a1',
    '00000000-0000-0000-0000-000000011101',
    '00000000-0000-0000-0000-000000011103',
    911102,'confirmation_fixture','warning',
    'same source confirmation fixture','pending',911101,
    '00000000-0000-0000-0000-0000000111f1'
  );

create temp table p111_before as
select canonical_product_id,canonical_product_key
from public.commercial_observations
where id=911101;

-- A teammate in the same tenant resolves the owner's review.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000111b1',true);
select set_config('request.jwt.claim.role','authenticated',true);

update public.commercial_review_queue
set
  status='corrected',
  corrected_values=jsonb_build_object(
    'grade','P235GH',
    'standard','EN 10216-2',
    'length_mm','6000',
    'quantity','12.5',
    'quantity_unit','T',
    'availability_status','stock',
    'note','Corrected by teammate after checking source PDF.'
  ),
  reviewed_at=now()
where id=911201
  and status='pending';

select pg_temp.p111_assert(
  exists(
    select 1
    from public.commercial_review_queue
    where id=911201
      and status='corrected'
      and reviewed_by='00000000-0000-0000-0000-0000000111b1'
  ),
  'same-tenant teammate must resolve the review'
);

select pg_temp.p111_assert(
  exists(
    select 1
    from public.commercial_observations o
    cross join p111_before b
    where o.id=911101
      and o.grade='P235GH'
      and o.standard='EN 10216-2'
      and o.length_mm=6000
      and o.quantity=12.5
      and o.quantity_unit='T'
      and o.availability_status='stock'
      and o.flags @> '["human_corrected"]'::jsonb
      and o.canonical_product_id is distinct from b.canonical_product_id
      and o.canonical_product_key is distinct from b.canonical_product_key
  ),
  'correction must promote into observation and regenerate canonical product identity'
);

select pg_temp.p111_assert(
  exists(
    select 1
    from public.commercial_review_events e
    where e.review_id=911201
      and e.observation_id=911101
      and e.actor_id='00000000-0000-0000-0000-0000000111b1'
      and e.event_type='corrected'
      and e.corrected_values->>'note'='Corrected by teammate after checking source PDF.'
      and e.before_observation->>'grade'='P265GH'
      and e.after_observation->>'grade'='P235GH'
      and e.before_observation->>'canonical_product_id'
          is distinct from e.after_observation->>'canonical_product_id'
  ),
  'append-only review event must preserve actor and before/after correction evidence'
);

select pg_temp.p111_assert(
  (
    select coalesce((payload->>'total')::integer,0)>0
    from (
      select public.p1_global_structured_search(
        '00000000-0000-0000-0000-0000000111f1',
        'P235GH',
        array['offer']::text[],
        '{}'::jsonb,
        20
      ) as payload
    ) s
  ),
  'structured search must immediately find corrected grade'
);

select pg_temp.p111_assert(
  (
    select coalesce((payload->>'total')::integer,0)=0
    from (
      select public.p1_global_structured_search(
        '00000000-0000-0000-0000-0000000111f1',
        'P265GH',
        array['offer']::text[],
        '{}'::jsonb,
        20
      ) as payload
    ) s
  ),
  'structured search must stop matching old grade when source text does not carry it as a structured match'
);

select pg_temp.p111_assert(
  (
    select coalesce((payload->>'found')::boolean,false)
    from (
      select public.p1_product_360(
        '00000000-0000-0000-0000-0000000111f1',
        canonical_product_id,
        20
      ) as payload
      from public.commercial_observations
      where id=911101
    ) p
  ),
  'Product 360 must resolve the regenerated corrected product identity'
);

-- Completed reviews cannot be altered.
do $$
begin
  begin
    update public.commercial_review_queue
    set corrected_values=jsonb_build_object('grade','P355NH')
    where id=911201;
    raise exception 'terminal review mutation unexpectedly succeeded';
  exception
    when sqlstate '22023' then null;
  end;
end
$$;

-- Another tenant cannot resolve the pending confirmation.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000111c1',true);
select set_config('request.jwt.claim.role','authenticated',true);

update public.commercial_review_queue
set status='confirmed',reviewed_at=now()
where id=911202 and status='pending';

select pg_temp.p111_assert(
  exists(
    select 1
    from public.commercial_review_queue
    where id=911202 and status='pending'
  ),
  'cross-tenant user must not resolve another organization review'
);

select pg_temp.p111_assert(
  not exists(
    select 1 from public.commercial_review_events
    where review_id=911202
  ),
  'cross-tenant attempt must not create an audit event'
);

-- Owner confirms the second review: audit yes, observation unchanged.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000111a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

update public.commercial_review_queue
set status='confirmed',reviewed_at=now()
where id=911202 and status='pending';

select pg_temp.p111_assert(
  exists(
    select 1
    from public.commercial_review_events
    where review_id=911202
      and event_type='confirmed'
      and actor_id='00000000-0000-0000-0000-0000000111a1'
      and before_observation=after_observation
  ),
  'confirmation must create an immutable feedback event without changing observation'
);

select pg_temp.p111_assert(
  has_table_privilege('authenticated','public.commercial_review_events','SELECT')
  and not has_table_privilege('authenticated','public.commercial_review_events','INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon','public.commercial_review_events','SELECT'),
  'feedback ledger must be tenant-readable but browser append-only'
);

reset role;
rollback;
