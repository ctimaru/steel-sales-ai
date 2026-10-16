-- NET-FAST3B: private service-role-only CORDIS monthly ingestion with grant gate.
create or replace function public.netfast3b_cordis_open()
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_source public.network_discovery_source_registry%rowtype;
  v_month date:=date_trunc('month',now() at time zone 'UTC')::date;
  v_run uuid;
begin
 if current_user<>'service_role' then raise exception 'Worker only' using errcode='42501';end if;
 select s.* into v_source from public.network_discovery_source_registry s
 join public.network_netfast3_feed_grants g on g.source_id=s.id
 where s.source_url='https://data.europa.eu/data/datasets/cordis-eu-research-projects-under-horizon-europe-2021-2027'
 and s.governance_status='approved'
 and s.terms_status in ('allows_reuse','allows_limited_reuse')
 and s.database_rights_status in ('licensed','low_risk')
 and s.personal_data_policy in ('company_data_only','exclude_personal_data')
 and s.reviewed_at is not null and s.reviewed_by is not null
 and g.revoked_at is null and g.expires_at>now()
 and nullif(btrim(s.rights_evidence_url),'') is not null;
 if not found then
   return jsonb_build_object('eligible',false,'reason','cordis_source_rights_not_approved');
 end if;
 -- Running/failed batches can only be resumed when stale for 24 hours.
 select r.id into v_run from public.network_netfast3b_cordis_runs r
 where r.source_id=v_source.id and r.release_month=v_month
 and r.status='running' and r.started_at<now()-interval '24 hours'
 for update skip locked;
 if found then
   update public.network_netfast3b_cordis_runs
   set started_at=now() where id=v_run;
 else
   insert into public.network_netfast3b_cordis_runs(source_id,release_month)
   values(v_source.id,v_month) on conflict(source_id,release_month) do nothing
   returning id into v_run;
 end if;
 if v_run is null then return jsonb_build_object(
   'eligible',false,'reason','monthly_run_already_claimed');end if;
 return jsonb_build_object('eligible',true,'run_id',v_run,
   'source_id',v_source.id,'monthly_limit',30000,'chunk_limit',500,
   'download_url','https://cordis.europa.eu/data/cordis-HORIZONprojects-csv.zip');
end $$;

create or replace function public.netfast3b_cordis_commit(
 p_run_id uuid,p_items jsonb)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_run public.network_netfast3b_cordis_runs%rowtype;
 v_source public.network_discovery_source_registry%rowtype;
 rec jsonb;oid text;project text;nm text;dom text;name_count integer;
 n int:=0;research_added int:=0;preview_added int:=0;invalid int:=0;
 row_added int;
begin
 if current_user<>'service_role' then raise exception 'Worker only' using errcode='42501';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 500
 then raise exception 'CORDIS chunks must be 1-500 rows' using errcode='22023';end if;
 select * into v_run from public.network_netfast3b_cordis_runs
 where id=p_run_id and status='running' for update;
 if not found or v_run.release_month<>date_trunc('month',now() at time zone 'UTC')::date
 or v_run.scanned_count+jsonb_array_length(p_items)>30000
 then raise exception 'Invalid CORDIS run or monthly budget exhausted' using errcode='42501';end if;
 select s.* into v_source from public.network_discovery_source_registry s
 join public.network_netfast3_feed_grants g on g.source_id=s.id
 where s.id=v_run.source_id and s.governance_status='approved'
 and s.source_url='https://data.europa.eu/data/datasets/cordis-eu-research-projects-under-horizon-europe-2021-2027'
 and s.terms_status in ('allows_reuse','allows_limited_reuse')
 and s.database_rights_status in ('licensed','low_risk')
 and s.personal_data_policy in ('company_data_only','exclude_personal_data')
 and g.revoked_at is null and g.expires_at>now()
 and s.reviewed_by is not null and s.reviewed_at is not null;
 if not found then raise exception 'CORDIS reuse permission revoked or expired' using errcode='42501';end if;
 for rec in select value from jsonb_array_elements(p_items) loop
   n:=n+1;
   if jsonb_typeof(rec)<>'object' or (select count(*) from jsonb_object_keys(rec))>4 then
     invalid:=invalid+1;continue;end if;
   oid:=btrim(coalesce(rec->>'organisation_id',''));
   project:=btrim(coalesce(rec->>'project_id',''));
   nm:=btrim(coalesce(rec->>'name',''));
   dom:=lower(btrim(coalesce(rec->>'domain','')));
   if oid !~ '^[0-9]{2,20}$' or project !~ '^[0-9]{2,20}$'
     or length(nm) not between 3 and 180 or nm ~* '(https?://|[@<>[:cntrl:]])'
     or (dom<>'' and (dom !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$' or dom like '%..%'))
   then invalid:=invalid+1;continue;end if;
   if exists(select 1 from public.network_netfast3_suppressed_domains x where x.domain=dom)
   then invalid:=invalid+1;continue;end if;
   insert into public.network_netfast3b_cordis_research
    (source_id,cordis_organisation_id,project_id,company_name,website_domain,status)
   values(v_source.id,oid,project,nm,nullif(dom,''),
     case when dom='' then 'needs_official_website' else 'domain_available' end)
   on conflict(source_id,cordis_organisation_id) do nothing;
   get diagnostics row_added=row_count;
   research_added:=research_added+row_added;
   if dom<>'' and nm ~* '(acciai|siderurg|metall|steel|metal|meccanic|mechanic|automotiv|veicol|carpenter|machiner|macchin|tubif|tubi|fabricat|fonder|foundr|manufactur|engineering)' and not exists(
       select 1 from public.network_companies c
       where c.archived_at is null
       and regexp_replace(lower(coalesce(c.website_domain,'')),'^www[.]','')=dom)
     and not exists(select 1 from public.network_company_discovery_candidates c where c.canonical_domain=dom)
     and not exists(select 1 from public.network_core_target_leads c where c.canonical_domain=dom)
     and not exists(select 1 from public.network_netfast2_structured_entities c where c.domain=dom)
     and not exists(select 1 from public.network_netfast3_suppressed_domains c where c.domain=dom)
   then
     insert into public.network_netfast3_entities(source_id,external_id,domain,company_name,role_hint)
      values(v_source.id,'CORDIS-HORIZON-'||oid,dom,nm,'unknown')
      on conflict do nothing;
     get diagnostics row_added=row_count;
     preview_added:=preview_added+row_added;
   end if;
 end loop;
 update public.network_netfast3b_cordis_runs set
  scanned_count=scanned_count+n,added_research=added_research+research_added,
  added_preview=added_preview+preview_added,discarded=discarded+invalid
 where id=p_run_id;
 return jsonb_build_object('status','staged_research_only',
   'received',n,'new_research',research_added,'new_unconfirmed',preview_added,
   'invalid',invalid,'canonical_published',0);
end $$;

create or replace function public.netfast3b_cordis_close(p_run_id uuid)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare r public.network_netfast3b_cordis_runs%rowtype;
begin
 if current_user<>'service_role' then raise exception 'Worker only' using errcode='42501';end if;
 update public.network_netfast3b_cordis_runs set status='completed',finished_at=now()
 where id=p_run_id and status='running' returning * into r;
 if not found then raise exception 'Active run missing' using errcode='42501';end if;
 return jsonb_build_object('status','completed','scanned',r.scanned_count,
  'new_research',r.added_research,'new_unconfirmed',r.added_preview,
  'invalid',r.discarded,'canonical_published',0);
end $$;
revoke all on function public.netfast3b_cordis_open() from public,anon,authenticated;
revoke all on function public.netfast3b_cordis_commit(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.netfast3b_cordis_close(uuid) from public,anon,authenticated;
grant execute on function public.netfast3b_cordis_open() to service_role;
grant execute on function public.netfast3b_cordis_commit(uuid,jsonb) to service_role;
grant execute on function public.netfast3b_cordis_close(uuid) to service_role;
