-- NET-DENS3: high-throughput first-party discovery import (source evidence, never auto-publication).
-- Preserve NET-COV1 canonical-domain dedup, tenant isolation and review status.
create or replace function public.netdensity3_seed_first_party(
 p_items jsonb, p_batch text
) returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
 rec jsonb;
 result jsonb;
 responses jsonb:='[]'::jsonb;
 added integer:=0;
 duplicate_count integer:=0;
 rejected integer:=0;
 attempted integer:=0;
 outcome text;
 input_domain text;
begin
 if current_user<>'service_role' then
   raise exception 'Service-only first-party bulk acquisition' using errcode='42501';
 end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200
   or length(btrim(coalesce(p_batch,''))) not between 3 and 90
 then
   raise exception 'Expected 1..200 sourced companies and batch key' using errcode='22023';
 end if;
 for rec in select value from jsonb_array_elements(p_items) loop
   attempted:=attempted+1;
   input_domain:=case when jsonb_typeof(rec)='object' then
     left(coalesce(rec->>'domain',''),255) else '' end;
   if jsonb_typeof(rec)<>'object'
      or (select count(*) from jsonb_object_keys(rec))<>7
      or not (rec ?& array['name','domain','evidence_url','summary','segment','material_signal','role'])
   then
     rejected:=rejected+1;
     responses:=responses||jsonb_build_array(jsonb_build_object(
       'index',attempted,'domain',input_domain,'status','invalid_data'));
     continue;
   end if;
   begin
     -- Original proven NET-COV1 source-domain equality, minimum evidence,
     -- material-status and duplicate guard remain authoritative.
     result:=private.netcov1_stage_core(
       rec->>'name',rec->>'domain',rec->>'evidence_url',
       rec->>'summary',rec->>'segment',rec->>'material_signal',
       p_batch,rec->>'role'
     );
     outcome:=coalesce(result->>'status','invalid_data');
     if outcome='needs_review' then
       added:=added+1;
     elsif outcome in ('duplicate_existing','already_staged') then
       duplicate_count:=duplicate_count+1;
     else
       rejected:=rejected+1;
     end if;
     responses:=responses||jsonb_build_array(jsonb_build_object(
       'index',attempted,'domain',input_domain,'status',outcome));
   exception when others then
     -- Per-row subtransaction: a stale/malformed source must never block
     -- the rest of the imported cohort. Do not leak SQL errors or PII.
     rejected:=rejected+1;
     responses:=responses||jsonb_build_array(jsonb_build_object(
       'index',attempted,'domain',input_domain,'status','invalid_data'));
   end;
 end loop;
 return jsonb_build_object(
   'contract','netdensity3-bulk-v1','status','completed',
   'requested',attempted,'new_unconfirmed',added,
   'duplicates',duplicate_count,'invalid',rejected,
   'published',0,'verified_buyers',0,'items',responses
 );
end $$;
revoke all on function public.netdensity3_seed_first_party(jsonb,text) from public,anon,authenticated;
grant execute on function public.netdensity3_seed_first_party(jsonb,text) to service_role;
