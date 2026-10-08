-- SP7 release gate is a DEFAULT-OFF dry-run, never a source approval.
begin;
create function pg_temp.sp7_assert(p_ok boolean,p_note text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok,false) then raise exception 'SP7: %',p_note; end if;
end $$;

select pg_temp.sp7_assert(
  (select count(*)=1 from steel_pulse_private.sources
    where id='ec_dg_trade'
    and status='candidate'
    and license_basis='unverified'
    and cardinality(approved_operations)=0
    and reviewer_user_id is null and legal_reviewer_user_id is null
    and approved_at is null
    and feed_url='https://policy.trade.ec.europa.eu/node/2/rss_en'
    and policy_url='https://commission.europa.eu/legal-notice_en'),
  'candidate cannot impersonate legal approval'
);
select pg_temp.sp7_assert(
  (select enabled=false from steel_pulse_private.publication_settings where singleton=true),
  'global publication flag must stay disabled in fresh rollout'
);
select pg_temp.sp7_assert(
  not has_schema_privilege('anon','steel_pulse_private','USAGE')
  and not has_schema_privilege('authenticated','steel_pulse_private','USAGE')
  and not has_table_privilege('anon','steel_pulse_private.sources','SELECT'),
  'no unauthenticated access to source-rights controls'
);
select pg_temp.sp7_assert(
  (select count(*)=0 from steel_pulse_private.editorial_cards)
  and (select count(*)=0 from steel_pulse_private.items),
  'no ghost news is staged or published during SP7 source registration'
);

set local role anon;
select pg_temp.sp7_assert(
  public.sp4_public_steel_pulse_feed(3)='[]'::jsonb,
  'anonymous feed remains empty even with an official RSS candidate'
);
rollback;
