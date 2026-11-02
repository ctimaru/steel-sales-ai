-- NET-CONTACT1B — crawl attempt ledger so the public-channel queue advances.
-- Companies where the crawler found nothing, or whose site was unavailable,
-- would otherwise be returned by netcontact1_next_batch on every run.
-- Persisting runs record one row per visited company; next_batch skips
-- companies attempted in the last 30 days. Service-only, no browser access.

create table if not exists private.netcontact1_crawl_attempts(
  company_id uuid primary key references public.network_companies(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  outcome text not null,
  attempts integer not null default 1,
  constraint netcontact1_crawl_attempts_outcome_check check (outcome in (
    'sourced_channel','no_company_channel','blocked_or_unavailable'))
);
alter table private.netcontact1_crawl_attempts enable row level security;
revoke all on table private.netcontact1_crawl_attempts from public,anon,authenticated;

create or replace function public.netcontact1_record_attempt(p_company_id uuid,p_outcome text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
begin
  if p_outcome not in ('sourced_channel','no_company_channel','blocked_or_unavailable') then
    raise exception 'Invalid crawl outcome' using errcode='22023';
  end if;
  if not exists(select 1 from public.network_companies where id=p_company_id
      and publication_status='published' and archived_at is null) then
    raise exception 'Published company not found' using errcode='P0002';
  end if;
  insert into private.netcontact1_crawl_attempts(company_id,attempted_at,outcome,attempts)
  values(p_company_id,now(),p_outcome,1)
  on conflict (company_id) do update
    set attempted_at=now(),outcome=excluded.outcome,
        attempts=private.netcontact1_crawl_attempts.attempts+1;
  return jsonb_build_object('contract','netcontact1-attempt-v1','status','recorded');
end;
$function$;

-- Same contract as NET-CONTACT1, plus the 30-day attempt exclusion.
create or replace function public.netcontact1_next_batch(p_limit integer default 25)
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  with eligible as (
    select c.id,c.legal_name,c.trading_name,c.website_url,c.website_domain
    from public.network_companies c
    where c.publication_status='published' and c.archived_at is null
      and nullif(btrim(coalesce(c.website_domain,'')),'') is not null
      and c.website_url like 'http%'
      and not exists(select 1 from public.network_contacts nc
        where nc.company_id=c.id and nc.archived_at is null
          and nc.publication_status in ('pending_review','published'))
      and not exists(select 1 from private.netcontact1_crawl_attempts t
        where t.company_id=c.id and t.attempted_at>now()-interval '30 days')
  )
  select jsonb_build_object(
    'contract','netcontact1-next-v1',
    'eligible',(select count(*) from eligible),
    'items',coalesce((select jsonb_agg(jsonb_build_object(
        'kind','canonical','company_id',e.id,'site',e.website_url,
        'domain',lower(regexp_replace(e.website_domain,'^www\.','')),
        'company_name',coalesce(e.trading_name,e.legal_name)) order by lower(e.legal_name),e.id)
      from (select * from eligible order by lower(legal_name),id
            limit least(greatest(coalesce(p_limit,25),1),25)) e),'[]'::jsonb));
$function$;

revoke all on function public.netcontact1_record_attempt(uuid,text) from public,anon,authenticated;
grant execute on function public.netcontact1_record_attempt(uuid,text) to service_role;
revoke all on function public.netcontact1_next_batch(integer) from public,anon,authenticated;
grant execute on function public.netcontact1_next_batch(integer) to service_role;
