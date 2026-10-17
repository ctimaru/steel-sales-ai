-- NET-CONNECT2C: conversion of actual submitted applications into active businesses.
-- Weekly cohorts use UTC submission dates; stages are current outcomes, not event dates.
-- Aggregates only; no email, identity re-assignment, invitation or write side effects.
create or replace function private.netconnect2c_growth_impl()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not private.is_platform_superadmin() then
  raise exception 'Platform owner required' using errcode='42501';
 end if;
 with owner_ready as materialized (
  select distinct l.network_company_id,l.organization_id
  from public.organization_network_company_links l
  join public.network_companies nc on nc.id=l.network_company_id
   and nc.publication_status='published' and nc.archived_at is null
  join public.network_company_claims cl on cl.network_company_id=nc.id
   and cl.organization_id=l.organization_id and cl.status='approved'
  where l.link_status='active'
   and exists(select 1 from public.organization_memberships m
    where m.organization_id=l.organization_id and m.status='active')
 ), cohort as materialized (
  select a.id,a.submitted_at,
   date_trunc('week',a.submitted_at at time zone 'UTC')::date week_start,
   (a.application_status='activated' and a.activated_organization_id is not null) activated,
   exists(select 1 from owner_ready o where o.organization_id=a.activated_organization_id) owned,
   exists(select 1 from public.network_connection_requests r
     where r.sender_organization_id=a.activated_organization_id) requested,
   exists(select 1 from public.network_connection_requests r
     where r.sender_organization_id=a.activated_organization_id and r.status='accepted') accepted
  from public.company_registration_applications a
  where a.submitted_at is not null and a.application_status<>'draft'
 ), week_rows as (
  select w.week_start,
   count(c.id)::integer submitted,
   count(c.id) filter(where c.activated)::integer activated,
   count(c.id) filter(where c.activated and c.owned)::integer owned,
   count(c.id) filter(where c.activated and c.owned and c.requested)::integer requested,
   count(c.id) filter(where c.activated and c.owned and c.accepted)::integer accepted
  from (select generate_series(
    date_trunc('week',now() at time zone 'UTC')::date-interval '7 weeks',
    date_trunc('week',now() at time zone 'UTC')::date,
    interval '1 week')::date week_start) w
  left join cohort c on c.week_start=w.week_start
  group by w.week_start
 )
 select jsonb_build_object(
  'contract','netconnect2c-growth-v1',
  'period','rolling_30_days',
  'time_basis','UTC',
  'current_state_cohorts',true,
  'cohort_30d',(select jsonb_build_object(
   'submitted',count(*)::integer,
   'activated',count(*) filter(where activated)::integer,
   'owned',count(*) filter(where activated and owned)::integer,
   'requested',count(*) filter(where activated and owned and requested)::integer,
   'accepted',count(*) filter(where activated and owned and accepted)::integer)
   from cohort where submitted_at>=now()-interval '30 days'),
  'weeks',(select coalesce(jsonb_agg(jsonb_build_object(
   'week_start',to_char(week_start,'YYYY-MM-DD'),
   'submitted',submitted,'activated',activated,'owned',owned,
   'requested',requested,'accepted',accepted) order by week_start),'[]'::jsonb)
   from week_rows),
  'network',jsonb_build_object(
   'owned_companies',(select count(distinct network_company_id) from owner_ready),
   'owned_without_outreach',(select count(distinct o.network_company_id)
    from owner_ready o where not exists(select 1 from public.network_connection_requests r
      where r.sender_organization_id=o.organization_id)),
   'approved_applications_pending_activation',(select count(*) from public.company_registration_applications
    where application_status='approved'),
   'requests_last_30d',(select count(*) from public.network_connection_requests
    where created_at>=now()-interval '30 days'),
   'accepted_last_30d',(select count(*) from public.network_connection_requests
    where status='accepted' and decided_at>=now()-interval '30 days'),
   'companies_with_accepted_connection',(select count(distinct o.network_company_id)
    from owner_ready o join public.network_connection_requests r
    on r.sender_organization_id=o.organization_id and r.status='accepted')
  ),
  'snapshot_at',now()
 ) into v_result;
 return v_result;
end $$;
revoke all on function private.netconnect2c_growth_impl() from public,anon,authenticated;

create or replace function public.netconnect2c_growth_overview()
returns jsonb language sql stable security definer set search_path='' as $$
 select private.netconnect2c_growth_impl();
$$;
revoke all on function public.netconnect2c_growth_overview() from public,anon;
grant execute on function public.netconnect2c_growth_overview() to authenticated;
