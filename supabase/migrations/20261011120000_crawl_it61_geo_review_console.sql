-- CRAWL-IT6.1: permission-controlled geographic evidence review; never publishes facilities.
create or replace function public.crawl_it61_geo_review_queue()
returns table(id uuid,company_id uuid,legal_name text,city text,province_code text,region text,address_line_1 text,source_url text,source_kind text,evidence_snippet text,created_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
begin
 perform private.require_platform_permission('discovery.read');
 return query
 select e.id,e.company_id,c.legal_name,e.city,e.province_code,e.region,
 e.address_line_1,e.source_url,e.source_kind,e.evidence_snippet,e.created_at
 from public.network_it_geo_evidence_candidates e
 join public.network_companies c on c.id=e.company_id
 where e.status='pending_review'
 order by e.created_at asc limit 100;
end $$;
create or replace function public.crawl_it61_review_geo_evidence(p_id uuid,p_decision text,p_note text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v public.network_it_geo_evidence_candidates%rowtype;
begin
 perform private.require_platform_permission('discovery.governance_review');
 if p_decision not in ('approved_for_facility_review','rejected','conflict')
 or char_length(btrim(coalesce(p_note,''))) < 12 or char_length(p_note)>2000
 then raise exception 'invalid geographic review decision' using errcode='22023'; end if;
 select * into v from public.network_it_geo_evidence_candidates where id=p_id for update;
 if not found then raise exception 'geographic evidence not found' using errcode='P0002'; end if;
 if v.status <> 'pending_review' then raise exception 'geographic evidence already reviewed' using errcode='22023'; end if;
 if p_decision='approved_for_facility_review' and not exists(
 select 1 from public.network_companies c where c.id=v.company_id and c.archived_at is null
 ) then raise exception 'company identity is inactive' using errcode='22023'; end if;
 update public.network_it_geo_evidence_candidates
 set status=p_decision,review_note=btrim(p_note),reviewed_by=auth.uid(),reviewed_at=now()
 where id=p_id;
 return jsonb_build_object('id',p_id,'status',p_decision,'facility_published',false);
end $$;
revoke all on function public.crawl_it61_geo_review_queue() from public,anon;
revoke all on function public.crawl_it61_review_geo_evidence(uuid,text,text) from public,anon;
grant execute on function public.crawl_it61_geo_review_queue() to authenticated;
grant execute on function public.crawl_it61_review_geo_evidence(uuid,text,text) to authenticated;
