-- NET-GROWTH2C.1 visual test: disposable FLOW1 local Supabase ONLY.
-- No production execution, no real identities, no external company data.
\set ON_ERROR_STOP on
begin;
insert into public.platform_staff(user_id,status)
values (:'buyer_user_id'::uuid,'active');
insert into public.platform_staff_roles(user_id,role_key,status,assigned_by,reason)
values (:'buyer_user_id'::uuid,'platform_auditor','active',:'buyer_user_id'::uuid,'Synthetic local Chrome discovery.read acceptance');

insert into public.network_core_target_leads
(company_name,canonical_domain,evidence_url,evidence_summary,segment,proposed_role,material_signal,status,intake_batch)
select
  case
    when n<=2 then 'QA Twin Equipment'
    when n<=8 then 'QA Manufacturer Group '||n
    else 'QA Industrial Prospect '||n
  end,
  'netgrowth-qa-'||lpad(n::text,2,'0')||'.example',
  'https://netgrowth-qa-'||lpad(n::text,2,'0')||'.example/',
  'Synthetic public-company fact for local automated interface acceptance only.',
  'industrial_equipment',
  'end_user',
  'finished_equipment_only',
  'needs_review',
  'netgrowth2c1-ci-local'
from generate_series(1,28) as n;
do $$
begin
  if (select count(*) from public.network_core_target_leads where intake_batch='netgrowth2c1-ci-local')<>28 then
    raise exception 'NET-GROWTH2C.1 synthetic 28-lead visual seed missing';
  end if;
  if (select count(*) from private.net_growth2b_identity_recovery where canonical_domain like 'netgrowth-qa-%.example')<>28 then
    raise exception 'NET-GROWTH2C.1 synthetic recovery view missing';
  end if;
  if (select count(*) from public.platform_staff_roles where user_id=:'buyer_user_id'::uuid and role_key='platform_auditor')<>1 then
    raise exception 'NET-GROWTH2C.1 local platform auditor missing';
  end if;
end $$;
commit;
