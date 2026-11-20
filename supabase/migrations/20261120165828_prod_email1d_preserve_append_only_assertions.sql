do $$
declare
  v_def text;
  v_before text;
begin
  select pg_get_functiondef(
    'private.netcontact1_auto_review_verified_alias_channels(integer,text,boolean)'::regprocedure
  ) into v_def;
  v_before:=v_def;
  v_def:=replace(
    v_def,
    E'      update public.network_data_assertions\n      set review_state=''accepted''\n      where id=v_after.source_assertion_id and review_state=''pending'';\n\n',
    ''
  );
  if v_def=v_before or position('update public.network_data_assertions' in v_def)>0 then
    raise exception 'append-only patch did not match expected reviewer definition';
  end if;
  execute v_def;
end
$$;
