-- PA1.2 — public company lookup acceptance.
begin;

create temp table pa12_state(
  key text primary key,
  value jsonb not null
) on commit drop;

grant select,insert,update,delete on table pa12_state to anon,authenticated;

create or replace function pg_temp.pa12_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA1.2 assertion failed: %',message;
  end if;
end;
$$;

grant execute on function pg_temp.pa12_assert(boolean,text) to anon,authenticated;

select pg_temp.pa12_assert(
  not has_table_privilege('anon','public.network_companies','SELECT'),
  'anon must not gain direct Network table access'
);

select pg_temp.pa12_assert(
  not has_function_privilege(
    'anon',
    'public.m6_search_network(text,text[],text[],text[],text[],text[],integer,integer)',
    'EXECUTE'
  ),
  'anon must not gain rich Network search'
);

select pg_temp.pa12_assert(
  not has_function_privilege(
    'anon',
    'public.m6_network_company_profile(uuid)',
    'EXECUTE'
  ),
  'anon must not gain rich Network profiles'
);

select pg_temp.pa12_assert(
  has_function_privilege('anon','public.pa1_2_company_lookup(text)','EXECUTE'),
  'anon must be allowed to call minimal company lookup'
);

insert into public.network_companies(
  legal_name,country_code,vat_id,publication_status,claimed_status,verification_status
)
values
('PA12 Alpha Steel S.r.l.','IT','99999000001','published','unclaimed','unverified'),
('PA12 Beta Tubes S.r.l.','IT','99999000002','published','pending','unverified'),
('PA12 Claimed Metals S.r.l.','IT','99999000003','published','claimed','verified');

set local role anon;
select set_config('request.jwt.claim.role','anon',true);

insert into pa12_state(key,value)
values
('name',public.pa1_2_company_lookup('PA12')),
('vat',public.pa1_2_company_lookup('IT99999000001')),
('short',public.pa1_2_company_lookup('ab')),
('missing',public.pa1_2_company_lookup('PA12 does not exist'));

select pg_temp.pa12_assert(
  (select (value->>'ok')::boolean from pa12_state where key='name'),
  'name lookup must succeed'
);

select pg_temp.pa12_assert(
  (select jsonb_array_length(value->'items') from pa12_state where key='name')=3,
  'name lookup must return the three matching test identities'
);

select pg_temp.pa12_assert(
  not exists(
    select 1
    from pa12_state s,
         jsonb_array_elements(s.value->'items') item,
         jsonb_object_keys(item) as object_keys(key_name)
    where s.key='name'
      and key_name not in ('legal_name','trading_name','country_code','vat_hint','claim_state')
  ),
  'public lookup must expose only minimal identity fields'
);

select pg_temp.pa12_assert(
  (select value->>'mode' from pa12_state where key='vat')='vat'
  and (select jsonb_array_length(value->'items') from pa12_state where key='vat')=1
  and (select value->'items'->0->>'claim_state' from pa12_state where key='vat')='claimable',
  'VAT lookup must be exact and return claim state'
);

select pg_temp.pa12_assert(
  not (select (value->>'ok')::boolean from pa12_state where key='short')
  and (select value->>'code' from pa12_state where key='short')='invalid_query',
  'short queries must be rejected'
);

select pg_temp.pa12_assert(
  (select value->>'code' from pa12_state where key='missing')='not_found'
  and (select jsonb_array_length(value->'items') from pa12_state where key='missing')=0,
  'missing company must return not_found without directory data'
);

rollback;
