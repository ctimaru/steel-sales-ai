-- IDENTITY2D.3: verified ownership, privacy, append-only, no edits.
begin;
do $$
declare
 v_owner text:=pg_get_functiondef('private.netit_identity2d3_owner_company(uuid,uuid)'::regprocedure);
 v_queue text:=pg_get_functiondef('public.netit_identity2d3_correction_queue(uuid,uuid,integer)'::regprocedure);
 v_attest text:=pg_get_functiondef('public.netit_identity2d3_owner_attest(uuid,uuid,text,text)'::regprocedure);
begin
 if has_function_privilege('anon','public.netit_identity2d3_owner_attest(uuid,uuid,text,text)','EXECUTE')
   or has_function_privilege('anon','public.netit_identity2d3_correction_queue(uuid,uuid,integer)','EXECUTE') then
   raise exception 'Anon must never see correction queue or owner attest';
 end if;
 if not has_function_privilege('authenticated','public.netit_identity2d3_owner_attest(uuid,uuid,text,text)','EXECUTE')
   or not has_function_privilege('authenticated','public.netit_identity2d3_correction_queue(uuid,uuid,integer)','EXECUTE') then
   raise exception 'Authenticated caller grants are absent';
 end if;
 if has_function_privilege('authenticated','private.netit_identity2d3_owner_company(uuid,uuid)','EXECUTE')
   or has_table_privilege('authenticated','private.netit_identity_correction_resolutions','SELECT')
   or has_table_privilege('authenticated','private.netit_identity_correction_resolutions','INSERT')
   or has_table_privilege('anon','private.netit_identity_correction_resolutions','SELECT') then
   raise exception 'Private owner helper/decisions leaked to clients';
 end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private' and c.relname='netit_identity_correction_resolutions' and c.relrowsecurity) then
   raise exception 'Resolution RLS missing';
 end if;
 if not exists (select 1 from pg_trigger where tgname='netit_identity2d3_resolution_immutable'
    and not tgisinternal) then
   raise exception 'Append-only resolution trigger missing';
 end if;
 if position('private.hp4_normalize_domain' in v_owner)=0
   or position('cl.status=''approved''' in v_owner)=0
   or position('cl.proof_status=''verified''' in v_owner)=0
   or position('l.link_status=''active''' in v_owner)=0
   or position('c.country_code=''IT''' in v_owner)=0
   or position('count(*)' in v_owner)=0 then
   raise exception 'Unique Italian canonical approved-claim boundary missing';
 end if;
 if position('auth.uid()' in v_queue)=0
   or position('m.role=''admin''' in v_queue)=0
   or position('r.organization_id=p_organization_id or v_owner_company is not null' in v_queue)=0
   or position('auth.uid()' in v_attest)=0
   or position('email_confirmed_at' in v_attest)=0
   or position('private.netit_identity2d3_owner_company' in v_attest)=0 then
   raise exception 'Org visibility or authorization missing';
 end if;
 if position('changes_published'',0' in v_queue)=0
   or position('claim_created'',false' in v_attest)=0
   or position('legal_identity_verified'',false' in v_attest)=0
   or position('published'',false' in v_attest)=0 then
   raise exception 'No-publish or no-claim contract missing';
 end if;
 if (select count(*) from private.netit_identity_correction_resolutions)<>0 then
   raise exception 'Owner decisions should not be silently seeded';
 end if;
end $$;
set local role authenticated;
do $$
begin
 begin
  perform public.netit_identity2d3_correction_queue(gen_random_uuid(),gen_random_uuid(),10);
  raise exception 'Unauthenticated queue bypass';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.netit_identity2d3_owner_attest(gen_random_uuid(),gen_random_uuid(),
   'owner_supported','This is an invalid unauthenticated company statement');
  raise exception 'Unauthenticated owner attest bypass';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
