-- L27.1 — Release Controls & Database Readiness
-- Disposable schema acceptance. No persisted changes.

begin;

create or replace function pg_temp.l271_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'L27.1 assertion failed: %', message;
  end if;
end;
$$;

-- The duplicate conversations index must remain removed.
select pg_temp.l271_assert(
  to_regclass('public.conversations_org_external_thread_uq') is null,
  'redundant conversations_org_external_thread_uq must stay removed'
);

-- The surviving index must keep the unique partial identity contract.
select pg_temp.l271_assert(
  exists (
    select 1
    from pg_index x
    join pg_class i on i.oid=x.indexrelid
    where i.oid=to_regclass('public.conversations_org_external_thread_uidx')
      and x.indisunique
      and pg_get_expr(x.indpred,x.indrelid)='(external_thread_id IS NOT NULL)'
  ),
  'surviving conversations identity index must remain unique and partial'
);

-- HP18 registration grant repair must remain narrow.
select pg_temp.l271_assert(
  has_table_privilege(
    'authenticated',
    'public.company_registration_applications',
    'SELECT'
  )
  and has_table_privilege(
    'authenticated',
    'public.company_registration_applications',
    'INSERT'
  )
  and has_table_privilege(
    'authenticated',
    'public.company_registration_applications',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.company_registration_applications',
    'DELETE'
  ),
  'registration grants must remain SELECT+INSERT+UPDATE with DELETE denied'
);

-- The critical production-journey acceptance function surface must still exist.
select pg_temp.l271_assert(
  to_regprocedure('public.p0a_activate_registration_application(uuid)') is not null
  and to_regprocedure('public.hp7_company_setup_state(uuid)') is not null
  and to_regprocedure('public.hp8_team_state(uuid)') is not null
  and to_regprocedure('public.p5_4_submit_response(uuid,uuid)') is not null,
  'critical launch journey RPCs must remain present'
);

rollback;
