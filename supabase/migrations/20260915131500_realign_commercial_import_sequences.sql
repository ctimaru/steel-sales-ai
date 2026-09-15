-- P0.6 production hardening: historical archive imports inserted explicit bigint
-- primary keys without advancing the backing sequences. New worker promotions
-- rely on database-generated IDs, so sequence state must be at or above MAX(id).

create or replace function public.realign_bigint_sequence(
  p_table regclass,
  p_column name
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sequence text;
  v_max_id bigint;
  v_sql text;
begin
  v_sequence := pg_get_serial_sequence(p_table::text, p_column::text);
  if v_sequence is null then
    raise exception 'No serial sequence found for %.%', p_table, p_column;
  end if;

  v_sql := format('select max(%I)::bigint from %s', p_column, p_table);
  execute v_sql into v_max_id;

  if v_max_id is null then
    perform pg_catalog.setval(v_sequence::regclass, 1, false);
    return 0;
  end if;

  perform pg_catalog.setval(v_sequence::regclass, v_max_id, true);
  return v_max_id;
end;
$$;

select public.realign_bigint_sequence('public.commercial_observations'::regclass, 'id');
select public.realign_bigint_sequence('public.commercial_review_queue'::regclass, 'id');

revoke execute on function public.realign_bigint_sequence(regclass, name)
  from public, anon, authenticated;
grant execute on function public.realign_bigint_sequence(regclass, name)
  to service_role;

comment on function public.realign_bigint_sequence(regclass, name) is
  'P0.6 helper to realign a bigint serial sequence after explicit-ID historical imports.';
