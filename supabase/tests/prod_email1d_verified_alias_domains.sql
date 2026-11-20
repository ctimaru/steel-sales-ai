-- PROD-EMAIL1.D — verified corporate email-domain aliases.
-- Disposable transaction: no persistent fixture changes.
begin;

create or replace function pg_temp.pe1d_ok(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PROD-EMAIL1.D assertion failed: %',message;
  end if;
end $$;

select pg_temp.pe1d_ok(
  not has_function_privilege('anon',
    'private.netcontact1_verify_email_domain_alias(uuid,text,text)','EXECUTE'),
  'anon cannot verify aliases'
);
select pg_temp.pe1d_ok(
  not has_function_privilege('authenticated',
    'private.netcontact1_stage_verified_alias_channel(uuid,text,text)','EXECUTE'),
  'authenticated cannot stage alias contacts'
);
select pg_temp.pe1d_ok(
  has_function_privilege('service_role',
    'private.netcontact1_auto_review_verified_alias_channels(integer,text,boolean)','EXECUTE'),
  'service_role may review aliases'
);

update public.network_contacts
set publication_status='archived',archived_at=now()
where company_id='51100000-0000-5000-8000-000000000005'::uuid
  and archived_at is null;

set local role service_role;

do $t$
declare
  morandi constant uuid:='51100000-0000-5000-8000-000000000005';
  verified jsonb;
  staged jsonb;
  dry jsonb;
  applied jsonb;
begin
  verified:=private.netcontact1_verify_email_domain_alias(
    morandi,'morandi-sales.it','https://www.morandispa.it/contatti'
  );
  perform pg_temp.pe1d_ok(verified->>'status'='verified','alias verified');

  staged:=private.netcontact1_stage_verified_alias_channel(
    morandi,'vendite@morandi-sales.it','https://www.morandispa.it/contatti'
  );
  perform pg_temp.pe1d_ok(staged->>'status'='staged','alias email staged');

  dry:=private.netcontact1_auto_review_verified_alias_channels(25,'IT',false);
  perform pg_temp.pe1d_ok((dry->>'eligible_total')::int=1,'dry-run finds alias candidate');

  applied:=private.netcontact1_auto_review_verified_alias_channels(25,'IT',true);
  perform pg_temp.pe1d_ok((applied->>'published')::int=1,'alias candidate published');
end
$t$;

reset role;

select pg_temp.pe1d_ok(
  (select b.email
   from private.rfqh2_best_network_contact('51100000-0000-5000-8000-000000000005'::uuid) b)
  ='vendite@morandi-sales.it',
  'alias channel becomes RFQ-usable'
);

set local role service_role;

do $t$
declare
  morandi constant uuid:='51100000-0000-5000-8000-000000000005';
  revoked jsonb;
begin
  revoked:=private.netcontact1_revoke_email_domain_alias(
    morandi,'morandi-sales.it','transactional test'
  );
  perform pg_temp.pe1d_ok(
    (revoked->>'contacts_unpublished')::int=1,
    'revocation archives alias contact'
  );
  perform pg_temp.pe1d_ok(
    not private.netcontact1_alias_domain_is_active(morandi,'vendite@morandi-sales.it'),
    'revoked alias is inactive'
  );
end
$t$;

reset role;

select pg_temp.pe1d_ok(
  not exists(
    select 1
    from private.rfqh2_best_network_contact('51100000-0000-5000-8000-000000000005'::uuid)
  ),
  'revoked alias channel is no longer RFQ-usable'
);

rollback;
