-- NET-PRODUCERS-AUTO1-OPS1: non-fatal already-indexed product cross-links.
-- Follow-up to 20261116201000_net_pro_producers1_auto1a4_detail_queue.sql.
-- Existing first-level URLs are navigation links, not valid NEW depth-two evidence.
-- All foreign-host, malformed URL, expired SHA, role and provenance checks remain intact.
-- This migration changes only the private service-only A4 discover function.
create or replace function private.netproducers1_auto1a4_discover(
 p_parent_page_id uuid,p_parent_sha256 text,p_links jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare v_parent private.network_producer_auto1_product_pages%rowtype;
declare v_root record;
declare v_item jsonb;
declare v_url text;
declare v_considered int:=0;
declare v_recorded int:=0;
declare v_skipped_existing_product int:=0;
begin
 if p_parent_sha256 is null or p_parent_sha256 !~ '^[a-f0-9]{64}$'
    or p_links is null or jsonb_typeof(p_links)<>'array'
    or jsonb_array_length(p_links)>6 then
  raise exception 'Invalid second-level discovery payload' using errcode='22023';
 end if;
 select * into v_parent from private.network_producer_auto1_product_pages
 where id=p_parent_page_id for update;
 if not found or v_parent.last_sha256 is distinct from p_parent_sha256
    or v_parent.status not in ('processed','unchanged','candidate_review')
    or v_parent.last_checked_at < now()-interval '35 days' then
  raise exception 'Current first-level HTML snapshot required' using errcode='42501';
 end if;
 select q.source_url,q.last_sha256,q.canonical_domain,q.last_checked_at,
        c.website_url,c.website_domain,c.country_code,c.publication_status,c.archived_at
 into v_root from private.network_producer_auto1_sources q
 join public.network_companies c on c.id=q.company_id
 where q.company_id=v_parent.company_id for update of q;
 if not found or v_root.last_sha256 is distinct from v_parent.root_sha256
    or v_root.source_url is distinct from v_parent.root_source_url
    or v_root.website_url is distinct from v_root.source_url
    or v_root.website_domain is distinct from v_root.canonical_domain
    or v_parent.canonical_domain is distinct from v_root.canonical_domain
    or v_root.country_code<>'IT' or v_root.publication_status<>'published'
    or v_root.archived_at is not null
    or v_root.last_checked_at < now()-interval '35 days'
    or not exists (
     select 1 from public.network_company_role_assignments a
     join public.network_company_roles r on r.id=a.role_id
     where a.company_id=v_parent.company_id and r.canonical_key='producer' and r.status='active'
    ) then
  raise exception 'Current canonical producer required' using errcode='42501';
 end if;

 -- Any parent SHA change retires old proof, including links no longer present.
 update private.network_producer_auto1_detail_candidates c
 set evidence_status='stale',updated_at=now()
 from private.network_producer_auto1_detail_pages d
 where c.detail_page_id=d.id and d.parent_page_id=p_parent_page_id
   and d.parent_sha256 is distinct from p_parent_sha256
   and c.evidence_status<>'stale';

 for v_item in select value from jsonb_array_elements(p_links) loop
  v_url:=v_item->>'url';
  if jsonb_typeof(v_item)<>'object'
   or coalesce(v_item->>'depth','')<>'2'
   or v_item->>'parent_url' is distinct from v_parent.source_url
   or v_item->>'parent_sha256' is distinct from p_parent_sha256
   or v_url is null
   or v_url !~ '^https://[A-Za-z0-9.-]+/[A-Za-z0-9._~/%-]+$'
   or length(v_url)>1200
   or split_part(v_url,'/',3)<>split_part(v_parent.source_url,'/',3)
   or v_url=v_parent.source_url or v_url=v_root.source_url
   or lower(v_url) ~ '[.](pdf|docx?|xlsx?|zip|png|jpg|jpeg|svg|webp)
  if not exists (select 1 from private.network_producer_auto1_detail_pages d
                 where d.company_id=v_parent.company_id and d.source_url=v_url) then
   if (select count(*) from private.network_producer_auto1_detail_pages d
       where d.company_id=v_parent.company_id)>=24
      or (select count(*) from private.network_producer_auto1_detail_pages d
          where d.parent_page_id=p_parent_page_id)>=6 then
    continue;
   end if;
  end if;
  insert into private.network_producer_auto1_detail_pages
   (company_id,parent_page_id,parent_sha256,source_url,canonical_domain)
  values (v_parent.company_id,p_parent_page_id,p_parent_sha256,v_url,v_parent.canonical_domain)
  on conflict (company_id,source_url) do update set
   parent_page_id=excluded.parent_page_id,
   parent_sha256=excluded.parent_sha256,
   canonical_domain=excluded.canonical_domain,
   status='queued',next_check_at=now(),last_etag=null,last_modified=null,
   needs_reparse=true,leased_until=null,updated_at=now()
  where private.network_producer_auto1_detail_pages.parent_sha256 is distinct from excluded.parent_sha256
     or private.network_producer_auto1_detail_pages.parent_page_id is distinct from excluded.parent_page_id;
  v_recorded:=v_recorded+1;
 end loop;

 -- An empty valid link set still records the scan and prevents endless re-fetch.
 update private.network_producer_auto1_product_pages
 set detail_discovery_sha256=p_parent_sha256,detail_discovery_at=now(),updated_at=now()
 where id=p_parent_page_id;
 -- Re-parented/changed parent snapshot invalidates prior associations; never publish them.
 update private.network_producer_auto1_detail_candidates c
 set evidence_status='stale',updated_at=now()
 from private.network_producer_auto1_detail_pages d
 where c.detail_page_id=d.id and d.company_id=v_parent.company_id
   and d.parent_page_id=p_parent_page_id
   and d.parent_sha256=p_parent_sha256
   and d.last_checked_at is not null
   and d.status='queued';
 return jsonb_build_object('contract','netproducers-auto1a4-discover-v1',
                          'considered',v_considered,'recorded',v_recorded,
                          'skipped_existing_product',v_skipped_existing_product,
                          'published_capabilities',0);
end;
$body$;
  then
   raise exception 'Invalid, duplicate or foreign second-level URL' using errcode='22023';
  end if;
  -- Safe cross-links to another *already registered* first-level product page
  -- are navigation, not a fresh depth-two source. Keep all earlier URL,
  -- parent-SHA, canonical-host, rights and producer checks fail-closed.
  if exists (select 1 from private.network_producer_auto1_product_pages x
             where x.company_id=v_parent.company_id and x.source_url=v_url) then
   v_skipped_existing_product:=v_skipped_existing_product+1;
   continue;
  end if;
  v_considered:=v_considered+1;
  if not exists (select 1 from private.network_producer_auto1_detail_pages d
                 where d.company_id=v_parent.company_id and d.source_url=v_url) then
   if (select count(*) from private.network_producer_auto1_detail_pages d
       where d.company_id=v_parent.company_id)>=24
      or (select count(*) from private.network_producer_auto1_detail_pages d
          where d.parent_page_id=p_parent_page_id)>=6 then
    continue;
   end if;
  end if;
  insert into private.network_producer_auto1_detail_pages
   (company_id,parent_page_id,parent_sha256,source_url,canonical_domain)
  values (v_parent.company_id,p_parent_page_id,p_parent_sha256,v_url,v_parent.canonical_domain)
  on conflict (company_id,source_url) do update set
   parent_page_id=excluded.parent_page_id,
   parent_sha256=excluded.parent_sha256,
   canonical_domain=excluded.canonical_domain,
   status='queued',next_check_at=now(),last_etag=null,last_modified=null,
   needs_reparse=true,leased_until=null,updated_at=now()
  where private.network_producer_auto1_detail_pages.parent_sha256 is distinct from excluded.parent_sha256
     or private.network_producer_auto1_detail_pages.parent_page_id is distinct from excluded.parent_page_id;
  v_recorded:=v_recorded+1;
 end loop;

 -- An empty valid link set still records the scan and prevents endless re-fetch.
 update private.network_producer_auto1_product_pages
 set detail_discovery_sha256=p_parent_sha256,detail_discovery_at=now(),updated_at=now()
 where id=p_parent_page_id;
 -- Re-parented/changed parent snapshot invalidates prior associations; never publish them.
 update private.network_producer_auto1_detail_candidates c
 set evidence_status='stale',updated_at=now()
 from private.network_producer_auto1_detail_pages d
 where c.detail_page_id=d.id and d.company_id=v_parent.company_id
   and d.parent_page_id=p_parent_page_id
   and d.parent_sha256=p_parent_sha256
   and d.last_checked_at is not null
   and d.status='queued';
 return jsonb_build_object('contract','netproducers-auto1a4-discover-v1',
                          'considered',v_considered,'recorded',v_recorded,'published_capabilities',0);
end;
$body$;

-- Preserve least-privilege gates even if restoring from an older environment.
revoke all on function private.netproducers1_auto1a4_discover(uuid,text,jsonb)
 from public,anon,authenticated;
grant execute on function private.netproducers1_auto1a4_discover(uuid,text,jsonb)
 to service_role;
