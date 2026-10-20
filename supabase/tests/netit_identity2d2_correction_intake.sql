-- NET-IT IDENTITY2D.2: role, RLS, anti-forgery and non-mutation acceptance.
begin;
do $$
declare
  v_count integer;
  v_def text := pg_get_functiondef(
    'public.netit_identity2d2_submit_correction(uuid,uuid,text,text,text,text,text)'::regprocedure
  );
begin
  if has_function_privilege('anon',
     'public.netit_identity2d2_submit_correction(uuid,uuid,text,text,text,text,text)','EXECUTE') then
    raise exception 'Anon may submit identity corrections';
  end if;
  if not has_function_privilege('authenticated',
     'public.netit_identity2d2_submit_correction(uuid,uuid,text,text,text,text,text)','EXECUTE') then
    raise exception 'Authenticated correction grant missing';
  end if;
  if has_table_privilege('authenticated','private.netit_identity_correction_requests','SELECT')
    or has_table_privilege('authenticated','private.netit_identity_correction_requests','INSERT')
    or has_table_privilege('authenticated','private.netit_identity_correction_events','SELECT')
    or has_table_privilege('anon','private.netit_identity_correction_requests','SELECT') then
    raise exception 'Private correction ledger exposed';
  end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private' and c.relname='netit_identity_correction_requests' and c.relrowsecurity) then
    raise exception 'Correction RLS disabled';
  end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private' and c.relname='netit_identity_correction_events' and c.relrowsecurity) then
    raise exception 'Correction event RLS disabled';
  end if;
  if position('auth.uid()' in v_def)=0 or
     position('private.netux11_require_active_company' in v_def)=0 or
     position('m.role=''admin''' in v_def)=0 or
     position('email_confirmed_at' in v_def)=0 or
     position('pg_advisory_xact_lock' in v_def)=0 or
     position('source must be hosted' in lower(v_def))=0 then
    raise exception 'Correction RPC security gates incomplete';
  end if;
  if v_def ~* '\b(update|delete)[[:space:]]+(private[.]netfast_discovered_records|public[.]network_companies|public[.]network_company_claims)' then
    raise exception 'Dangerous identity or claim mutation in intake RPC';
  end if;
  select count(*) into v_count from private.netit_identity_correction_requests;
  if v_count<>0 then
    raise exception 'New correction request ledger must not be seeded in migration';
  end if;
  if exists(select 1 from private.netit_identity_correction_events) then
    raise exception 'New correction event ledger must not be seeded';
  end if;
end
$$;

-- RLS is not the only boundary: JWT-less authenticated role must be denied by RPC.
set local role authenticated;
do $$
begin
  begin
    perform public.netit_identity2d2_submit_correction(
      gen_random_uuid(), gen_random_uuid(), 'company_name',
      'Unauthorized change', 'https://example.it/source',
      'This is an unauthorized correction with fabricated membership.',
      'industry_observer'
    );
    raise exception 'Unauthenticated actor bypassed RPC';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;
rollback;
