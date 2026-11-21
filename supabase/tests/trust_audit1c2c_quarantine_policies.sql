-- TRUST-AUDIT1C.2C — schema policy acceptance without production data.
begin;

create or replace function pg_temp.trust_c2c_assert(ok boolean, msg text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'TRUST-AUDIT1C.2C failure: %', msg;
  end if;
end;
$$;

select pg_temp.trust_c2c_assert(
  (
    select count(*)
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('knowledge_entity_mentions','knowledge_evidence')
      and p.polname in (
        'trust_no_superseded_entity_mentions',
        'trust_no_superseded_knowledge_evidence'
      )
      and not p.polpermissive
      and p.polcmd = 'r'
      and pg_get_expr(p.polqual,p.polrelid) like '%superseded%'
  ) = 2,
  'two restrictive read policies must reject superseded knowledge references'
);

select pg_temp.trust_c2c_assert(
  (
    select count(*)
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    where c.relname in ('knowledge_entity_mentions','knowledge_evidence')
      and p.polname in (
        'trust_no_superseded_entity_mentions',
        'trust_no_superseded_knowledge_evidence'
      )
      and p.polroles @> ARRAY['authenticated'::regrole::oid]
  ) = 2,
  'policies must apply to authenticated users'
);

rollback;
