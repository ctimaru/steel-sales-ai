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
    E'  update public.network_contacts nc\n  set publication_status=''pending_review'',\n      privacy_review_expires_at=least(coalesce(nc.privacy_review_expires_at,now()),now())\n',
    E'  update public.network_contacts nc\n  set publication_status=''archived'',\n      archived_at=now()\n'
  );
  if v_def=v_before or position('privacy_review_expires_at=least' in v_def)>0 then
    raise exception 'revocation archive patch did not match expected definition';
  end if;
  execute v_def;
end
$$;
