-- PROD-EMAIL1.E — explicit role-qualified first-party mailboxes.
begin;

create or replace function pg_temp.pe1e_ok(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PROD-EMAIL1.E assertion failed: %',message;
  end if;
end $$;

select pg_temp.pe1e_ok(
  not has_function_privilege('anon',
    'private.netcontact1_stage_qualified_role_channel(uuid,text,text)','EXECUTE'),
  'anon cannot stage qualified role channels'
);
select pg_temp.pe1e_ok(
  not has_function_privilege('authenticated',
    'private.netcontact1_auto_review_qualified_role_channels(integer,text,boolean)','EXECUTE'),
  'authenticated cannot auto-review qualified role channels'
);
select pg_temp.pe1e_ok(
  private.netcontact1_qualified_role_local_part('commerciale.italia'),
  'commerciale.italia is a qualified role'
);
select pg_temp.pe1e_ok(
  private.netcontact1_qualified_role_local_part('info.mts'),
  'info.mts is a qualified role'
);
select pg_temp.pe1e_ok(
  private.netcontact1_qualified_role_local_part('commercial.dep'),
  'commercial.dep is a qualified English commercial role'
);
select pg_temp.pe1e_ok(
  not private.netcontact1_qualified_role_local_part('morandispa'),
  'brand local-part remains excluded'
);
select pg_temp.pe1e_ok(
  not private.netcontact1_qualified_role_local_part('direzione'),
  'generic management local-part remains excluded'
);

update public.network_contacts
set publication_status='archived',archived_at=now()
where company_id='51100000-0000-5000-8000-000000000005'::uuid
  and archived_at is null;

set local role service_role;

do $t$
declare
  morandi constant uuid:='51100000-0000-5000-8000-000000000005';
  staged jsonb;
  dry jsonb;
  applied jsonb;
begin
  staged:=private.netcontact1_stage_qualified_role_channel(
    morandi,'commerciale.italia@morandispa.it','https://www.morandispa.it/contatti'
  );
  perform pg_temp.pe1e_ok(staged->>'status'='staged','qualified role staged');

  dry:=private.netcontact1_auto_review_qualified_role_channels(25,'IT',false);
  perform pg_temp.pe1e_ok((dry->>'eligible_total')::int=1,'dry-run finds candidate');

  applied:=private.netcontact1_auto_review_qualified_role_channels(25,'IT',true);
  perform pg_temp.pe1e_ok((applied->>'published')::int=1,'qualified role published');

  perform pg_temp.pe1e_ok(
    (private.netcontact1_auto_review_qualified_role_channels(25,'IT',false)->>'eligible_total')::int=0,
    'replay is idempotent'
  );
end
$t$;

reset role;

select pg_temp.pe1e_ok(
  (select b.email
   from private.rfqh2_best_network_contact('51100000-0000-5000-8000-000000000005'::uuid) b)
  ='commerciale.italia@morandispa.it',
  'qualified role mailbox becomes RFQ-usable'
);

rollback;
