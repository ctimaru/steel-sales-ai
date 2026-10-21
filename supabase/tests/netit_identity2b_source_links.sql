begin;
do $$
declare n integer;
begin
 select count(*) into n from private.netit_identity_link_proposals where observation_batch='net-it-identity2b-source-v1';
 if n<>6 then raise exception 'Expected six link candidates; got %',n; end if;
 if has_table_privilege('anon','private.netit_identity_link_proposals','SELECT') or has_table_privilege('authenticated','private.netit_identity_link_proposals','SELECT') then
  raise exception 'Private source links exposed';
 end if;
 if exists(select 1 from private.netit_identity_link_proposals where proposal_status<>'candidate' or legal_identity_verified or merge_performed) then
  raise exception 'Improperly qualified source link';
 end if;
 if (select relrowsecurity from pg_class where oid='private.netit_identity_link_proposals'::regclass) is not true then
  raise exception 'RLS missing';
 end if;
end $$;
rollback;
