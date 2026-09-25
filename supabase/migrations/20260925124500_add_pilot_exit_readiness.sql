create or replace function private.p1_pilot_exit_readiness_impl(
  p_organization_id uuid,
  p_since timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_actor uuid := auth.uid();
  v_active_days integer;
  v_searches integer;
  v_search_success_rate numeric;
  v_core_surface_count integer;
  v_uploads integer;
  v_event_count integer;
  v_avg_search_ms numeric;
begin
  if v_actor is null then
    raise exception using errcode='28000', message='authentication required';
  end if;
  if p_organization_id is null or not public.is_organization_member(p_organization_id,true) then
    raise exception using errcode='42501', message='active tenant membership required';
  end if;

  select
    count(distinct occurred_at::date),
    count(*) filter (where event_name='search_completed'),
    case
      when count(*) filter (where event_name='search_completed')=0 then null
      else round(
        (count(*) filter (where event_name='search_completed' and outcome='success'))::numeric
        / nullif(count(*) filter (where event_name='search_completed'),0),4
      )
    end,
    count(distinct event_name) filter (
      where event_name in ('product_viewed','company_viewed','price_history_viewed','evidence_opened','review_viewed')
    ),
    count(*) filter (where event_name='upload_completed' and outcome='success'),
    count(*),
    round(avg(duration_ms) filter (where event_name='search_completed' and duration_ms is not null),0)
  into
    v_active_days,v_searches,v_search_success_rate,v_core_surface_count,
    v_uploads,v_event_count,v_avg_search_ms
  from public.pilot_usage_events
  where organization_id=p_organization_id
    and occurred_at>=p_since;

  return jsonb_build_object(
    'contract','PA2.35-v1',
    'since',p_since,
    'generated_at',now(),
    'metrics',jsonb_build_object(
      'active_days',coalesce(v_active_days,0),
      'searches',coalesce(v_searches,0),
      'search_success_rate',v_search_success_rate,
      'core_surface_count',coalesce(v_core_surface_count,0),
      'successful_uploads',coalesce(v_uploads,0),
      'event_count',coalesce(v_event_count,0),
      'avg_search_duration_ms',v_avg_search_ms
    ),
    'criteria',jsonb_build_object(
      'active_days',jsonb_build_object('target',3,'actual',coalesce(v_active_days,0),'passed',coalesce(v_active_days,0)>=3),
      'searches',jsonb_build_object('target',10,'actual',coalesce(v_searches,0),'passed',coalesce(v_searches,0)>=10),
      'search_success_rate',jsonb_build_object('target',0.70,'actual',v_search_success_rate,'passed',coalesce(v_search_success_rate,0)>=0.70),
      'core_surface_count',jsonb_build_object('target',4,'actual',coalesce(v_core_surface_count,0),'passed',coalesce(v_core_surface_count,0)>=4),
      'successful_uploads',jsonb_build_object('target',1,'actual',coalesce(v_uploads,0),'passed',coalesce(v_uploads,0)>=1)
    ),
    'criteria_passed_count',
      (case when coalesce(v_active_days,0)>=3 then 1 else 0 end)
      +(case when coalesce(v_searches,0)>=10 then 1 else 0 end)
      +(case when coalesce(v_search_success_rate,0)>=0.70 then 1 else 0 end)
      +(case when coalesce(v_core_surface_count,0)>=4 then 1 else 0 end)
      +(case when coalesce(v_uploads,0)>=1 then 1 else 0 end),
    'criteria_total',5,
    'pilot_evidence_ready',
      coalesce(v_active_days,0)>=3
      and coalesce(v_searches,0)>=10
      and coalesce(v_search_success_rate,0)>=0.70
      and coalesce(v_core_surface_count,0)>=4
      and coalesce(v_uploads,0)>=1,
    'time_to_answer_human_evidence_required',true
  );
end;
$$;

create or replace function public.p1_pilot_exit_readiness(
  p_organization_id uuid,
  p_since timestamptz default (now()-interval '30 days')
)
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $$
  select private.p1_pilot_exit_readiness_impl(p_organization_id,p_since);
$$;

revoke all on function private.p1_pilot_exit_readiness_impl(uuid,timestamptz) from public,anon;
grant execute on function private.p1_pilot_exit_readiness_impl(uuid,timestamptz) to authenticated,service_role,postgres;
revoke all on function public.p1_pilot_exit_readiness(uuid,timestamptz) from public,anon;
grant execute on function public.p1_pilot_exit_readiness(uuid,timestamptz) to authenticated,service_role,postgres;
