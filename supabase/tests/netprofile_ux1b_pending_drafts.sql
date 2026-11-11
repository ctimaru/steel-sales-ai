-- NET-PROFILE-UX1.B2: management of private drafts is allowed during review.
-- Public stock still requires the canonical company to be published.
begin;
do $test$
begin
  if position('pending_review' in pg_get_functiondef('private.netprofile_ux1b_can_manage(uuid,uuid)'::regprocedure))=0 then
    raise exception 'Private stock drafts must be available to approved company admins under review';
  end if;
  if position('m7_user_can_manage_network_company' in pg_get_functiondef('private.netprofile_ux1b_can_manage(uuid,uuid)'::regprocedure))=0 then
    raise exception 'Private draft author must remain tied to approved claim';
  end if;
  if not exists (select 1 from pg_trigger
    where tgrelid='private.netprofile_ux1b_inventory'::regclass
      and tgname='netprofile_ux1b_before_publish' and tgenabled='O') then
    raise exception 'Publication guard trigger must be enabled';
  end if;
  if position('c.publication_status=''published''' in pg_get_functiondef('private.netprofile_ux1b_publication_guard()'::regprocedure))=0 then
    raise exception 'Inventory publication must require company publication';
  end if;
  if has_function_privilege('anon','private.netprofile_ux1b_publication_guard()','EXECUTE')
    or has_function_privilege('authenticated','private.netprofile_ux1b_publication_guard()','EXECUTE') then
    raise exception 'Trigger implementation must not be callable from browser clients';
  end if;
  if position('c.publication_status=''published''' in pg_get_functiondef('private.netprofile_ux1b_public_impl(uuid,uuid)'::regprocedure))=0 then
    raise exception 'Public inventory reader must still require published company';
  end if;
end;
$test$;
rollback;
