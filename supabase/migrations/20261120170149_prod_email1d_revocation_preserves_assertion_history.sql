do $$
declare
  v_def text;
  v_before text;
begin
  select pg_get_functiondef(
    'private.netcontact1_revoke_email_domain_alias(uuid,text,text)'::regprocedure
  ) into v_def;
  v_before:=v_def;
  v_def:=replace(
    v_def,
    E'  update public.network_data_assertions a\n  set review_state=''superseded''\n  where a.id=(\n    select d.source_assertion_id\n    from private.netcontact1_verified_email_domains d\n    where d.company_id=p_company_id and d.email_domain=v_domain\n  ) and a.review_state=''accepted'';\n\n',
    ''
  );
  if v_def=v_before or position('update public.network_data_assertions' in v_def)>0 then
    raise exception 'append-only revoke patch did not match expected definition';
  end if;
  execute v_def;
end
$$;
