-- NET-COV2 — scalable, operator-controlled first-party industrial prospect staging.
-- No source authorization, crawling, candidate promotion, publication or automatic company merge.
-- Uses NET-COV1 validation, normalized domain dedupe and private lead pool unchanged.

create or replace function private.netcov2_operator_batch_stage_impl(
 p_items jsonb, p_campaign text, p_attested boolean
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 v_item jsonb;
 v_result jsonb;
 v_results jsonb := '[]'::jsonb;
 v_staged integer := 0;
 v_duplicates integer := 0;
 v_already integer := 0;
 v_campaign text := btrim(coalesce(p_campaign,''));
begin
 perform private.require_platform_permission('discovery.enrich');
 if auth.uid() is null or coalesce(p_attested,false) is not true then
   raise exception 'Authenticated Platform review and first-party evidence attestation required' using errcode='42501';
 end if;
 if length(v_campaign) not between 4 and 90
   or v_campaign !~ '^[[:alnum:] ]+[[:alnum:] _.:-]*$' then
   raise exception 'A short campaign label is required' using errcode='22023';
 end if;
 if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 40 then
   raise exception 'One campaign import may contain 1 to 40 official-site company records' using errcode='22023';
 end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
   if jsonb_typeof(v_item) <> 'object'
      or (select count(*) from jsonb_object_keys(v_item)) <> 7
      or not (v_item ?& array['name','domain','evidence_url','summary','segment','material_signal','role'])
   then
     raise exception 'Only the seven company-evidence fields are allowed' using errcode='22023';
   end if;
   -- Reuses the same exact-domain official HTTPS evidence, domain uniqueness,
   -- company/candidate dedupe and private staging as NET-COV1.
   v_result := private.netcov1_stage_core(
     v_item->>'name',v_item->>'domain',v_item->>'evidence_url',
     v_item->>'summary',v_item->>'segment',v_item->>'material_signal',
     v_campaign,v_item->>'role'
   );
   v_results := v_results || jsonb_build_array(v_result);
   if v_result->>'status' = 'needs_review' then v_staged := v_staged + 1;
   elsif v_result->>'status' = 'duplicate_existing' then v_duplicates := v_duplicates + 1;
   else v_already := v_already + 1; end if;
 end loop;
 return jsonb_build_object(
   'contract','netcov2-stage-v1','campaign',v_campaign,'requested',jsonb_array_length(p_items),
   'staged_needs_review',v_staged,'duplicate_existing',v_duplicates,
   'already_staged',v_already,'items',v_results,
   'crawler_runs',0,'published_companies',0
 );
end;
$$;

create or replace function public.netcov2_operator_batch_stage(
 p_items jsonb,p_campaign text,p_attested boolean default false
) returns jsonb
language sql security invoker set search_path=''
as 'select private.netcov2_operator_batch_stage_impl(p_items,p_campaign,p_attested);';

create or replace function private.netcov2_campaign_metrics_impl()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_result jsonb;
begin
 perform private.require_platform_permission('discovery.read');
 select jsonb_build_object(
   'contract','netcov2-campaign-metrics-v1',
   'campaigns',coalesce((
     select jsonb_agg(jsonb_build_object(
       'campaign',x.intake_batch,'total',x.total,
       'needs_review',x.needs_review,'ready_for_crawler',x.ready_for_crawler,
       'enqueued_for_crawler',x.enqueued,
       'duplicates',x.duplicates,'rejected',x.rejected,
       'end_users',x.end_users,'traders',x.traders
     ) order by x.latest desc,x.intake_batch)
     from (
       select intake_batch,max(created_at) latest,count(*) total,
         count(*) filter(where status='needs_review') needs_review,
         count(*) filter(where status='ready_for_crawler') ready_for_crawler,
         count(*) filter(where status='enqueued_for_crawler') enqueued,
         count(*) filter(where status='duplicate_existing') duplicates,
         count(*) filter(where status='rejected') rejected,
         count(*) filter(where proposed_role='end_user') end_users,
         count(*) filter(where proposed_role='trader_distributor') traders
       from public.network_core_target_leads
       where intake_batch <> 'platform-manual'
       group by intake_batch
       order by latest desc,intake_batch
       limit 25
     ) x
   ),'[]'::jsonb),
   'published_by_campaign',0
 ) into v_result;
 return v_result;
end;
$$;

create or replace function public.netcov2_campaign_metrics()
returns jsonb language sql stable security invoker set search_path=''
as 'select private.netcov2_campaign_metrics_impl();';

revoke all on function private.netcov2_operator_batch_stage_impl(jsonb,text,boolean) from public,anon,authenticated;
revoke all on function private.netcov2_campaign_metrics_impl() from public,anon,authenticated;
revoke all on function public.netcov2_operator_batch_stage(jsonb,text,boolean) from public,anon;
revoke all on function public.netcov2_campaign_metrics() from public,anon;
grant execute on function private.netcov2_operator_batch_stage_impl(jsonb,text,boolean) to authenticated;
grant execute on function private.netcov2_campaign_metrics_impl() to authenticated;
grant execute on function public.netcov2_operator_batch_stage(jsonb,text,boolean) to authenticated;
grant execute on function public.netcov2_campaign_metrics() to authenticated;
