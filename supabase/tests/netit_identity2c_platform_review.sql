-- Italian discovery identity review: safe read-only Platform surface.
begin;
do $$
declare n integer;
begin
 if has_function_privilege('anon','public.netit_identity2c_review_queue(integer,integer)','EXECUTE') then
  raise exception 'Anon may invoke Platform identity review';
 end if;
 if not has_function_privilege('authenticated','public.netit_identity2c_review_queue(integer,integer)','EXECUTE') then
  raise exception 'Authenticated Platform RPC grant missing';
 end if;
 if not position('private.require_platform_permission' in pg_get_functiondef('public.netit_identity2c_review_queue(integer,integer)'::regprocedure))>0 then
  raise exception 'Platform access guard missing';
 end if;
 if has_table_privilege('authenticated','private.netit_identity_link_proposals','SELECT') then
  raise exception 'Private relation table exposed';
 end if;
 select count(*) into n from private.netit_identity_link_proposals where observation_batch='net-it-identity2b-source-v1';
 if n<>6 then raise exception 'Expected six candidate identities found %',n; end if;
 if exists(select 1 from private.netit_identity_link_proposals
   where proposal_status<>'candidate' or merge_performed or legal_identity_verified or source_reuse_rights<>'not_assessed') then
  raise exception 'Unsafe identity proposal lifecycle';
 end if;
end $$;
rollback;
