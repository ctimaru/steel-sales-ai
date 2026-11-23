-- PROD-CONTACT1 — verified first-party phone/form channel governance.
begin;

create or replace function pg_temp.pc1_ok(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PROD-CONTACT1 assertion failed: %',message;
  end if;
end $$;

select pg_temp.pc1_ok(
  not has_function_privilege(
    'anon',
    'private.netcontact1_auto_review_company_phones(integer,text,boolean)',
    'EXECUTE'
  ),
  'anon cannot auto-review company phones'
);

select pg_temp.pc1_ok(
  not has_function_privilege(
    'authenticated',
    'private.netcontact1_auto_review_company_phones(integer,text,boolean)',
    'EXECUTE'
  ),
  'authenticated cannot auto-review company phones'
);

select pg_temp.pc1_ok(
  not has_function_privilege(
    'anon',
    'private.netcontact1_stage_company_contact_form(uuid,text)',
    'EXECUTE'
  ),
  'anon cannot stage company contact forms'
);

select pg_temp.pc1_ok(
  not has_function_privilege(
    'authenticated',
    'private.netcontact1_stage_company_contact_form(uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot stage company contact forms'
);

select pg_temp.pc1_ok(
  not has_function_privilege(
    'authenticated',
    'private.netcontact1_auto_review_company_contact_forms(integer,text,boolean)',
    'EXECUTE'
  ),
  'authenticated cannot auto-review company contact forms'
);

select pg_temp.pc1_ok(
  has_function_privilege(
    'service_role',
    'private.netcontact1_auto_review_company_phones(integer,text,boolean)',
    'EXECUTE'
  ),
  'service_role can auto-review company phones'
);

select pg_temp.pc1_ok(
  has_function_privilege(
    'service_role',
    'private.netcontact1_stage_company_contact_form(uuid,text)',
    'EXECUTE'
  ),
  'service_role can stage company contact forms'
);

select pg_temp.pc1_ok(
  has_function_privilege(
    'service_role',
    'private.netcontact1_auto_review_company_contact_forms(integer,text,boolean)',
    'EXECUTE'
  ),
  'service_role can auto-review company contact forms'
);

select pg_temp.pc1_ok(
  not (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname='netcontact1_auto_review_company_phones'
      and pg_get_function_identity_arguments(p.oid)='p_limit integer, p_country_code text, p_apply boolean'
  ),
  'phone reviewer remains SECURITY INVOKER'
);

select pg_temp.pc1_ok(
  not (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname='netcontact1_stage_company_contact_form'
      and pg_get_function_identity_arguments(p.oid)='p_company_id uuid, p_form_url text'
  ),
  'contact-form stager remains SECURITY INVOKER'
);

select pg_temp.pc1_ok(
  not (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname='netcontact1_auto_review_company_contact_forms'
      and pg_get_function_identity_arguments(p.oid)='p_limit integer, p_country_code text, p_apply boolean'
  ),
  'contact-form reviewer remains SECURITY INVOKER'
);

set local role service_role;

do $t$
declare
  phone_dry jsonb;
  form_dry jsonb;
begin
  phone_dry:=private.netcontact1_auto_review_company_phones(10,'IT',false);
  perform pg_temp.pc1_ok(phone_dry->>'mode'='dry_run','phone reviewer supports dry-run');
  perform pg_temp.pc1_ok((phone_dry->>'published')::int=0,'phone dry-run never publishes');

  form_dry:=private.netcontact1_auto_review_company_contact_forms(10,'IT',false);
  perform pg_temp.pc1_ok(form_dry->>'mode'='dry_run','form reviewer supports dry-run');
  perform pg_temp.pc1_ok((form_dry->>'published')::int=0,'form dry-run never publishes');
end
$t$;

reset role;

rollback;
