-- RQG3.2a: OPTIONAL owner-controlled production-only SYNTHETIC evidence,
-- after TWO real governed company activations and approved admin memberships.
-- NOT A MIGRATION. NEVER EXECUTE AGAINST REAL COMPANIES.
-- No auth.users writes, no Platform grants, no legal acceptance simulation.
-- Explicit single transaction; fail closed on any existing fixture id/marker.
begin;
do $rqg32a$
declare
  v_owner_count integer;
  v_a uuid;
  v_b uuid;
  v_org_a uuid;
  v_org_b uuid;
  v_id bigint;
begin
  select count(*) into v_owner_count
  from public.platform_user_roles
  where role='platform_superadmin' and status='active';
  if v_owner_count<>1 then
    raise exception 'RQG3.2a: exactly one Platform Owner required';
  end if;
  select id into v_a from auth.users
  where email='rqg32-company-a@smartsteelsales.test'
    and raw_app_meta_data->>'rqg32_suite'='RQG3.2a'
    and raw_app_meta_data->>'rqg32_persona'='companyA';
  select id into v_b from auth.users
  where email='rqg32-company-b@smartsteelsales.test'
    and raw_app_meta_data->>'rqg32_suite'='RQG3.2a'
    and raw_app_meta_data->>'rqg32_persona'='companyB';
  if v_a is null or v_b is null or v_a=v_b then
    raise exception 'RQG3.2a: approved synthetic Auth company accounts missing';
  end if;
  select id into v_org_a from public.organizations
  where slug='rqg32-company-a' and onboarding_status='completed';
  select id into v_org_b from public.organizations
  where slug='rqg32-company-b' and onboarding_status='completed';
  if v_org_a is null or v_org_b is null or v_org_a=v_org_b then
    raise exception 'RQG3.2a: two approved and activated test workspaces required';
  end if;
  if not exists (
    select 1 from public.organization_memberships
    where organization_id=v_org_a and user_id=v_a and status='active' and role='admin'
  ) or not exists (
    select 1 from public.organization_memberships
    where organization_id=v_org_b and user_id=v_b and status='active' and role='admin'
  ) then
    raise exception 'RQG3.2a: both synthetic company admins must be approved';
  end if;
  if exists (
    select 1 from public.organization_memberships
    where status='active' and (
      (user_id=v_a and organization_id<>v_org_a)
      or (user_id=v_b and organization_id<>v_org_b)
    )
  ) then
    raise exception 'RQG3.2a: unexpected cross-tenant membership';
  end if;
  if exists (
    select 1 from public.commercial_review_queue
    where id in (980321,980322)
      or source_text in ('RQG32-ORG_A-20261013','RQG32-ORG_B-20261013')
  ) or exists (
    select 1 from public.commercial_observations where id in (980321,980322)
  ) or exists (
    select 1 from public.commercial_datasets
    where id in ('00000000-0000-0000-0000-000000032101',
                 '00000000-0000-0000-0000-000000032102')
  ) or exists (
    select 1 from public.commercial_threads
    where id in ('00000000-0000-0000-0000-000000032121',
                 '00000000-0000-0000-0000-000000032122')
  ) then
    raise exception 'RQG3.2a: reserved synthetic IDs/markers already exist; no overwrite';
  end if;

  insert into public.commercial_datasets(
    id,owner_id,source_run_id,source_filename,organization_id
  ) values
    ('00000000-0000-0000-0000-000000032101',v_a,
     '00000000-0000-0000-0000-000000032111','RQG32-SYNTHETIC-A.eml',v_org_a),
    ('00000000-0000-0000-0000-000000032102',v_b,
     '00000000-0000-0000-0000-000000032112','RQG32-SYNTHETIC-B.eml',v_org_b);
  insert into public.commercial_threads(
    id,owner_id,dataset_id,source_conversation_id,subject,
    classification,last_activity_at,organization_id
  ) values
    ('00000000-0000-0000-0000-000000032121',v_a,
     '00000000-0000-0000-0000-000000032101',
     '00000000-0000-0000-0000-000000032131',
     'RQG32 SYNTHETIC TEST A','offer',now(),v_org_a),
    ('00000000-0000-0000-0000-000000032122',v_b,
     '00000000-0000-0000-0000-000000032102',
     '00000000-0000-0000-0000-000000032132',
     'RQG32 SYNTHETIC TEST B','offer',now(),v_org_b);
  insert into public.commercial_observations(
    id,owner_id,dataset_id,thread_id,source_conversation_id,
    item_role,direction,product_type,grade,standard,
    outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
    price_value,price_unit,currency,availability_status,
    source_filename,source_text,confidence,search_text,organization_id
  ) values
    (980321,v_a,'00000000-0000-0000-0000-000000032101',
     '00000000-0000-0000-0000-000000032121',
     '00000000-0000-0000-0000-000000032131',
     'offered','outbound','round_tube','S355J2H','EN 10219',
     168.3,6.3,6000,10,'PZ',900,'T','EUR','available',
     'RQG32-SYNTHETIC-A.eml','RQG32-ORG_A-20261013',0.8,
     'rqg32 synthetic test company a',v_org_a),
    (980322,v_b,'00000000-0000-0000-0000-000000032102',
     '00000000-0000-0000-0000-000000032122',
     '00000000-0000-0000-0000-000000032132',
     'offered','outbound','round_tube','S355J2H','EN 10219',
     168.3,6.3,6000,10,'PZ',900,'T','EUR','available',
     'RQG32-SYNTHETIC-B.eml','RQG32-ORG_B-20261013',0.8,
     'rqg32 synthetic test company b',v_org_b);
  insert into public.commercial_review_queue(
    id,owner_id,dataset_id,thread_id,source_review_id,reason,severity,
    source_text,status,observation_id,organization_id
  ) values
    (980321,v_a,'00000000-0000-0000-0000-000000032101',
     '00000000-0000-0000-0000-000000032121',980321,'manual_check',
     'warning','RQG32-ORG_A-20261013','pending',980321,v_org_a),
    (980322,v_b,'00000000-0000-0000-0000-000000032102',
     '00000000-0000-0000-0000-000000032122',980322,'manual_check',
     'warning','RQG32-ORG_B-20261013','pending',980322,v_org_b);
  if (select count(*) from public.commercial_review_queue where id in (980321,980322))<>2 then
    raise exception 'RQG3.2a: two synthetic review rows not created';
  end if;
end;
$rqg32a$;
commit;
