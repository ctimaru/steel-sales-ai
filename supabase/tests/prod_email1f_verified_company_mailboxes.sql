begin;

create or replace function pg_temp.pe1f_ok(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PROD-EMAIL1.F assertion failed: %',message;
  end if;
end $$;

select pg_temp.pe1f_ok(
  not has_function_privilege('anon',
    'private.netcontact1_verify_company_mailbox(uuid,text,text)','EXECUTE'),
  'anon cannot verify exact company mailboxes'
);
select pg_temp.pe1f_ok(
  not has_function_privilege('authenticated',
    'private.netcontact1_auto_review_verified_company_mailboxes(integer,text,boolean)','EXECUTE'),
  'authenticated cannot auto-review exact company mailboxes'
);
select pg_temp.pe1f_ok(
  (select relrowsecurity
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='private' and c.relname='netcontact1_verified_company_mailboxes'),
  'verified mailbox registry has RLS enabled'
);

set local role service_role;

do $t$
declare
  company_id constant uuid:='51100000-0000-5000-8000-000000000005';
  verified jsonb;
  staged jsonb;
  dry jsonb;
  applied jsonb;
  revoked jsonb;
begin
  verified:=private.netcontact1_verify_company_mailbox(
    company_id,'morandispa@morandispa.it','https://www.morandispa.it/contatti'
  );
  perform pg_temp.pe1f_ok(verified->>'status'='verified','exact mailbox verified');

  staged:=private.netcontact1_stage_verified_company_mailbox(
    company_id,'morandispa@morandispa.it'
  );
  perform pg_temp.pe1f_ok(staged->>'status'='staged','verified exact mailbox staged');

  dry:=private.netcontact1_auto_review_verified_company_mailboxes(25,'IT',false);
  perform pg_temp.pe1f_ok((dry->>'eligible_total')::int>=1,'dry-run sees exact mailbox');

  applied:=private.netcontact1_auto_review_verified_company_mailboxes(25,'IT',true);
  perform pg_temp.pe1f_ok((applied->>'published')::int>=1,'exact mailbox published');

  perform pg_temp.pe1f_ok(
    (private.netcontact1_auto_review_verified_company_mailboxes(25,'IT',false)->>'eligible_total')::int=0,
    'review replay idempotent'
  );

  revoked:=private.netcontact1_revoke_company_mailbox(
    company_id,'morandispa@morandispa.it','transactional test'
  );
  perform pg_temp.pe1f_ok(revoked->>'status'='revoked','exact mailbox revoked');
end
$t$;

reset role;
rollback;
