-- NET-IT IDENTITY2C: source-linked Italian discovered-company identity review.
-- Presentation only. No auto merge, company updates, claim changes or approvals.
create or replace function public.netit_identity2c_review_queue(
 p_limit integer default 25,
 p_offset integer default 0
) returns jsonb
language plpgsql stable security definer
set search_path=''
as $function$
declare v jsonb;
begin
 perform private.require_platform_permission('discovery.read');
 if p_limit is null or p_limit<1 or p_limit>25
   or p_offset is null or p_offset<0 or p_offset>10000 then
   raise exception 'Invalid bounded identity review request' using errcode='22023';
 end if;
 with base as (
  select l.id,l.relation_hint,l.proposal_status,l.source_url,l.source_note,
   l.source_reuse_rights,l.legal_identity_verified,l.merge_performed,l.created_at,
   a.company_name as name_a,a.domain as domain_a,
   b.company_name as name_b,b.domain as domain_b
  from private.netit_identity_link_proposals l
  join private.netfast_discovered_records a on a.id=l.entity_a_id
  join private.netfast_discovered_records b on b.id=l.entity_b_id
  where l.observation_batch like 'net-it-%'
 ), page as (
  select * from base order by created_at,id limit p_limit offset p_offset
 )
 select jsonb_build_object(
  'contract','net-it-identity2c-review-v1',
  'total',(select count(*) from base),
  'items',coalesce((select jsonb_agg(jsonb_build_object(
   'id',id,'name_a',name_a,'domain_a',domain_a,
   'name_b',name_b,'domain_b',domain_b,
   'relation_hint',relation_hint,'proposal_status',proposal_status,
   'source_url',source_url,'source_note',source_note,
   'source_reuse_rights',source_reuse_rights,
   'legal_identity_verified',legal_identity_verified,
   'merge_performed',merge_performed,'created_at',created_at
  ) order by created_at,id) from page),'[]'::jsonb),
  'italian_legal_entities_verified_by_this_queue',0
 ) into v;
 return v;
end
$function$;
revoke all on function public.netit_identity2c_review_queue(integer,integer) from public,anon,authenticated;
grant execute on function public.netit_identity2c_review_queue(integer,integer) to authenticated,service_role;
comment on function public.netit_identity2c_review_queue(integer,integer) is
 'Platform discovery.read only. Read-only bounded Italian discovery identity proposals with sources. Never confirms legal identity, merges, or reuse rights.';
