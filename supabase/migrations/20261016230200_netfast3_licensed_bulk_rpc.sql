-- NET-FAST3: atomic business-only import of up to 1000 rows per call.
-- Rights are checked once per source, not approved separately for each company.
create or replace function private.netfast3_bulk_import_impl(
 p_source_id uuid,p_campaign text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare src public.network_discovery_source_registry%rowtype;
 rec jsonb;dom text;label text;eid text;rolekey text;
 received integer:=0;added integer:=0;dups integer:=0;skips integer:=0;changed integer;
 batch_uuid uuid;
begin
 perform private.require_platform_permission('discovery.enrich');
 if auth.uid() is null
  or length(btrim(coalesce(p_campaign,''))) not between 3 and 80
  or jsonb_typeof(p_items)<>'array'
  or jsonb_array_length(p_items) not between 1 and 1000
 then raise exception '1-1000 structured company rows and campaign required' using errcode='22023';end if;
 select s.* into src from public.network_discovery_source_registry s
 join public.network_netfast3_feed_grants g on g.source_id=s.id
 where s.id=p_source_id and g.revoked_at is null and g.expires_at>now()
 and s.source_type in ('licensed_search','curated_public_source')
 and s.governance_status='approved'
 and s.terms_status in ('allows_reuse','allows_limited_reuse')
 and s.database_rights_status in ('licensed','low_risk')
 and s.personal_data_policy in ('company_data_only','exclude_personal_data')
 and s.reviewed_at is not null and s.reviewed_by is not null
 and s.source_url<>'https://query.wikidata.org/sparql'
 and nullif(btrim(coalesce(s.rights_evidence_url,'')),'') is not null
 for share of s;
 if not found then raise exception 'Source redistribution rights not currently approved' using errcode='42501';end if;
 for rec in select value from jsonb_array_elements(p_items) loop
  received:=received+1;
  if jsonb_typeof(rec)<>'object' or not (rec ?& array['name','domain','source_id']) then
   skips:=skips+1;continue;end if;
  label:=btrim(coalesce(rec->>'name',''));
  dom:=lower(btrim(coalesce(rec->>'domain','')));
  eid:=btrim(coalesce(rec->>'source_id',''));
  rolekey:=coalesce(nullif(btrim(rec->>'role'),''),'unknown');
  if length(label) not between 3 and 180 or label ~* '(https?://|@|[<>[:cntrl:]])'
   or dom !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$' or dom like '%..%'
   or dom ~* '(^|[.])(linkedin|facebook|instagram|youtube|wikidata|wikipedia|google|twitter|tiktok|wordpress)[.]'
   or length(eid) not between 2 and 160 or eid ~ '[<>@[:cntrl:]]'
   or rolekey not in ('unknown','producer','trader_distributor','processor_service_provider','end_user')
   or (select count(*) from jsonb_object_keys(rec))>4
  then skips:=skips+1;continue;end if;
  if exists(select 1 from public.network_companies x where x.archived_at is null
     and regexp_replace(lower(coalesce(x.website_domain,'')),'^www[.]','')=dom)
  or exists(select 1 from public.network_company_discovery_candidates x
     where lower(x.canonical_domain)=dom)
  or exists(select 1 from public.network_core_target_leads x
     where x.canonical_domain=dom)
  or exists(select 1 from public.network_netfast2_structured_entities x
     where x.domain=dom)
  or exists(select 1 from public.network_netfast3_suppressed_domains x
     where x.domain=dom)
  then dups:=dups+1;continue;end if;
  insert into public.network_netfast3_entities(
   source_id,external_id,domain,company_name,role_hint)
   values(p_source_id,eid,dom,label,rolekey)
   on conflict do nothing;
  get diagnostics changed=row_count;
  added:=added+changed;dups:=dups+1-changed;
 end loop;
 insert into public.network_netfast3_import_batches(
  source_id,campaign,operator_id,rows_received,rows_added,rows_duplicate,rows_skipped)
 values(p_source_id,btrim(p_campaign),auth.uid(),received,added,dups,skips)
 returning id into batch_uuid;
 return jsonb_build_object('contract','netfast3-batch-v1',
 'batch_id',batch_uuid,'received',received,'added_unconfirmed',added,
 'duplicate',dups,'skipped',skips,'published_canonical',0,'manual_company_reviews',0);
end $$;

create or replace function public.netfast3_bulk_import(
 p_source_id uuid,p_campaign text,p_items jsonb)
returns jsonb language sql security invoker set search_path=''
as 'select private.netfast3_bulk_import_impl(p_source_id,p_campaign,p_items);';

create or replace function private.netfast3_source_status_impl()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v jsonb;
begin
 perform private.require_platform_permission('discovery.read');
 select jsonb_build_object('contract','netfast3-status-v1',
   'sources',coalesce((select jsonb_agg(jsonb_build_object(
    'source_id',s.id,'name',s.source_name,'url',s.source_url,
    'approved',s.governance_status='approved',
    'grant_active',(g.revoked_at is null and g.expires_at>now()),
    'expiry',g.expires_at,'imported',(
      select count(*) from public.network_netfast3_entities e
      where e.source_id=s.id and e.removed_at is null)
   ) order by s.source_name)
   from public.network_discovery_source_registry s
   left join public.network_netfast3_feed_grants g on g.source_id=s.id
   where s.source_type in ('licensed_search','curated_public_source')
     and s.source_url<>'https://query.wikidata.org/sparql'),'[]'::jsonb),
   'total_feed_entities',(select count(*) from public.network_netfast3_entities
     where removed_at is null),'recent_batches',
      coalesce((select jsonb_agg(jsonb_build_object('id',b.id,
       'campaign',b.campaign,'received',b.rows_received,
       'added',b.rows_added,'duplicate',b.rows_duplicate,
       'skipped',b.rows_skipped,'at',b.created_at))
       from (select * from public.network_netfast3_import_batches
         order by created_at desc limit 10)b),'[]'::jsonb)) into v;
 return v;
end $$;
create or replace function public.netfast3_source_status()
returns jsonb language sql stable security invoker set search_path=''
as 'select private.netfast3_source_status_impl();';

revoke all on function private.netfast3_bulk_import_impl(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function private.netfast3_source_status_impl() from public,anon,authenticated;
revoke all on function public.netfast3_bulk_import(uuid,text,jsonb) from public,anon;
revoke all on function public.netfast3_source_status() from public,anon;
grant execute on function private.netfast3_bulk_import_impl(uuid,text,jsonb) to authenticated;
grant execute on function private.netfast3_source_status_impl() to authenticated;
grant execute on function public.netfast3_bulk_import(uuid,text,jsonb) to authenticated;
grant execute on function public.netfast3_source_status() to authenticated;
