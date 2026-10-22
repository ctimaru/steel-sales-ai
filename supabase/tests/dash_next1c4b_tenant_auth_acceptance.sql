-- C4B staging-only, genuinely role-constrained SQL acceptance.
-- All four reserved synthetic Auth identities, two orgs and entitlements ROLLBACK.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $pre$ begin
  if (select count(*) from auth.users)<>0
    or (select count(*) from public.organizations)<>0
  then raise exception 'C4B staging synthetic acceptance requires EMPTY auth and organizations'; end if;
  if to_regclass('public.crm_network_relationships') is null
    or to_regclass('public.crm_network_relationship_events') is null
  then raise exception 'C4B migration must be installed first'; end if;
end $pre$;
insert into auth.users(id) values
('00000000-0000-4000-8000-000000000111'),
('00000000-0000-4000-8000-000000000112'),
('00000000-0000-4000-8000-000000000113'),
('00000000-0000-4000-8000-000000000114');
insert into public.organizations(id,name,slug) values
('00000000-0000-4000-8000-000000000211','C4B QA synthetic A','c4b-qa-org-a'),
('00000000-0000-4000-8000-000000000212','C4B QA synthetic B','c4b-qa-org-b');
insert into public.organization_memberships(organization_id,user_id,role,status,is_default) values
('00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000111','admin','active',true),
('00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000112','member','active',true),
('00000000-0000-4000-8000-000000000212','00000000-0000-4000-8000-000000000113','admin','active',true),
('00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000114','viewer','active',true);
insert into public.organization_product_entitlement_events
(organization_id,product_key,event_type,source_kind,idempotency_key,actor_authority_type)
values
('00000000-0000-4000-8000-000000000211','network_access','granted','system','c4baccept-20261022-a','system'),
('00000000-0000-4000-8000-000000000212','network_access','granted','system','c4baccept-20261022-b','system');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000111',true);
do $owner$ declare n uuid;
begin
 select id into n from public.network_companies where publication_status='published' order by id limit 1;
 if n is null then raise exception 'No published Network company'; end if;
 insert into public.crm_network_relationships(organization_id,network_company_id,created_by)
 values('00000000-0000-4000-8000-000000000211',n,'00000000-0000-4000-8000-000000000111');
 if (select count(*) from public.crm_network_relationship_events where event_type='created')<>1
 then raise exception 'Missing atomic created event'; end if;
 insert into public.crm_network_relationships(organization_id,network_company_id,created_by)
 values('00000000-0000-4000-8000-000000000211',n,'00000000-0000-4000-8000-000000000111')
 on conflict(organization_id,network_company_id) do nothing;
 if (select count(*) from public.crm_network_relationships)<>1 then raise exception 'Duplicate relationship'; end if;
end $owner$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000112',true);
do $member$ declare rid uuid;
begin
 select id into rid from public.crm_network_relationships limit 1;
 if rid is null then raise exception 'Same-org member cannot read relationship'; end if;
 insert into public.crm_network_relationship_events(relationship_id,organization_id,actor_user_id,event_type,note)
 values(rid,'00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000112','note','Authorized synthetic note');
 if (select count(*) from public.crm_network_relationship_events where relationship_id=rid)<>2
 then raise exception 'Member append failed'; end if;
end $member$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000114',true);
do $viewer$ declare rid uuid; rejected boolean:=false;
begin
 select id into rid from public.crm_network_relationships limit 1;
 if rid is null then raise exception 'Viewer cannot read shared relation'; end if;
 begin
 insert into public.crm_network_relationship_events(relationship_id,organization_id,actor_user_id,event_type,note)
 values(rid,'00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000114','note','DENIED');
 exception when others then rejected:=true;
 end;
 if not rejected then raise exception 'Viewer wrote to shared ledger'; end if;
end $viewer$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000113',true);
do $other$ declare n uuid;
begin
 if exists(select 1 from public.crm_network_relationships) or
    exists(select 1 from public.crm_network_relationship_events)
 then raise exception 'Cross-tenant read disclosure'; end if;
 select id into n from public.network_companies where publication_status='published' limit 1;
 insert into public.crm_network_relationships(organization_id,network_company_id,created_by)
 values('00000000-0000-4000-8000-000000000212',n,'00000000-0000-4000-8000-000000000113');
 if (select count(*) from public.crm_network_relationships)<>1
 then raise exception 'Other tenant cannot create own relationship'; end if;
end $other$;
reset role;
rollback;
select 'C4B synthetic membership, viewer and tenant acceptance PASSED with ROLLBACK' as result;
