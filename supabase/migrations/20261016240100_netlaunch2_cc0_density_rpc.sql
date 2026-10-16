-- NET-LAUNCH2: bound daily discovery to two independently tagged sector pages.
create or replace function public.netlaunch2_claim_daily()
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare s public.network_discovery_source_registry%rowtype;
 day_utc date:=(now() at time zone 'UTC')::date;
 sectors text[];v_offsets jsonb;run_id uuid;
begin
 if current_user<>'service_role' then raise exception 'NET-LAUNCH2 worker only' using errcode='42501';end if;
 select * into s from public.network_discovery_source_registry
 where id='8425ec0f-c855-41d8-9bea-70a95fd8a6ba'::uuid;
 if not found or not s.enabled_for_discovery or s.governance_status<>'approved'
 or s.source_url<>'https://query.wikidata.org/sparql'
 or s.terms_status<>'allows_reuse' or s.database_rights_status<>'low_risk'
 or s.personal_data_policy<>'exclude_personal_data'
 or s.rights_evidence_url<>'https://www.wikidata.org/wiki/Wikidata:Licensing'
 or s.reviewed_by is null or s.reviewed_at is null or s.max_domains_per_run<200
 then return jsonb_build_object('eligible',false,'reason','wikidata_cc0_rights_not_approved');end if;
 sectors:=case when extract(doy from day_utc)::integer % 2=1
 then array['Q190117','Q1957908']::text[]
 else array['Q2285982','Q1924906']::text[] end;
 select jsonb_object_agg(c.industry_qid,c.next_offset) into v_offsets
 from public.network_netlaunch2_cursors c where c.industry_qid=any(sectors);
 if v_offsets is null or jsonb_object_length(v_offsets)<>2
 then raise exception 'NET-LAUNCH2 cursor corruption' using errcode='22023';end if;
 insert into public.network_netlaunch2_runs(run_day,industry_ids,offsets)
 values(day_utc,sectors,v_offsets) on conflict(run_day) do nothing returning id into run_id;
 if run_id is null then return jsonb_build_object('eligible',false,'reason','daily_budget_used');end if;
 return jsonb_build_object('eligible',true,'run_id',run_id,'industries',sectors,
 'offsets',v_offsets,'page_size',100,'max_records',200,'published',0);
end $$;

create or replace function public.netlaunch2_commit_daily(
 p_run_id uuid,p_items jsonb,p_counts jsonb)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare r public.network_netlaunch2_runs%rowtype;
 src public.network_discovery_source_registry%rowtype;
 itm jsonb;sector text;qid text;nm text;dom text;web text;
 claimed_count integer;accepted integer:=0;added integer:=0;skipped integer:=0;
 seen_count integer:=0;delta integer;v_day date:=(now() at time zone 'UTC')::date;
begin
 if current_user<>'service_role' then raise exception 'NET-LAUNCH2 worker only' using errcode='42501';end if;
 select * into r from public.network_netlaunch2_runs
 where id=p_run_id and status='claimed' and run_day=v_day for update;
 if not found then raise exception 'NET-LAUNCH2 daily run not found' using errcode='42501';end if;
 select * into src from public.network_discovery_source_registry
 where id='8425ec0f-c855-41d8-9bea-70a95fd8a6ba'::uuid;
 if not found or src.governance_status<>'approved' or not src.enabled_for_discovery
 or src.source_url<>'https://query.wikidata.org/sparql'
 or src.terms_status<>'allows_reuse' or src.database_rights_status<>'low_risk'
 or src.personal_data_policy<>'exclude_personal_data'
 or src.rights_evidence_url<>'https://www.wikidata.org/wiki/Wikidata:Licensing'
 or src.reviewed_by is null or src.reviewed_at is null or src.max_domains_per_run<200
 then raise exception 'NET-LAUNCH2 source approval revoked' using errcode='42501';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>200
  or jsonb_typeof(p_counts)<>'object' or
  (select count(*) from jsonb_object_keys(p_counts))<>2
 then raise exception 'NET-LAUNCH2 invalid batch' using errcode='22023';end if;
 foreach sector in array r.industry_ids loop
  if not p_counts ? sector or (p_counts->>sector) !~ '^[0-9]{1,3}$'
   then raise exception 'NET-LAUNCH2 missing sector count' using errcode='22023';end if;
  claimed_count:=(p_counts->>sector)::integer;
  if claimed_count not between 0 and 100 then raise exception 'NET-LAUNCH2 raw count exceeds source budget' using errcode='22023';end if;
  seen_count:=seen_count+claimed_count;
 end loop;
 for itm in select value from jsonb_array_elements(p_items) loop
   accepted:=accepted+1;
   if jsonb_typeof(itm)<>'object' or (select count(*) from jsonb_object_keys(itm))<>5
   or not (itm ?& array['qid','label','domain','website','industry_qid'])
   then skipped:=skipped+1;continue;end if;
   sector:=itm->>'industry_qid';qid:=itm->>'qid';
   nm:=btrim(coalesce(itm->>'label',''));
   dom:=lower(btrim(coalesce(itm->>'domain','')));
   web:=coalesce(itm->>'website','');
   if not sector=any(r.industry_ids) or qid !~ '^Q[1-9][0-9]{0,13}$'
    or length(nm) not between 3 and 180 or nm ~* '(https?://|[@<>[:cntrl:]])'
    or dom !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
    or dom like '%..%' or web<>('https://'||dom||'/')
    or dom ~* '(^|[.])(facebook|linkedin|instagram|youtube|wikidata|wikipedia|google|twitter|tiktok|wordpress)[.]'
   then skipped:=skipped+1;continue;end if;
   if exists(select 1 from public.network_companies c where c.archived_at is null
      and regexp_replace(lower(coalesce(c.website_domain,'')),'^www[.]','')=dom)
   or exists(select 1 from public.network_company_discovery_candidates c where c.canonical_domain=dom)
   or exists(select 1 from public.network_core_target_leads t where t.canonical_domain=dom)
   or exists(select 1 from public.network_netfast3_entities e where e.domain=dom)
   or exists(select 1 from public.network_netfast3_suppressed_domains x where x.domain=dom)
   then skipped:=skipped+1;continue;end if;
   insert into public.network_netfast2_structured_entities(
     source_entity_id,company_name,domain,website_url,industry_qid)
   values(qid,nm,dom,web,sector) on conflict do nothing;
   get diagnostics delta=row_count;
   added:=added+delta;skipped:=skipped+1-delta;
 end loop;
 if accepted>seen_count then raise exception 'More records than downloaded from Wikidata' using errcode='22023';end if;
 foreach sector in array r.industry_ids loop
   claimed_count:=(p_counts->>sector)::integer;
   update public.network_netlaunch2_cursors
   set next_offset=case when claimed_count<100 then 0
       when ((r.offsets->>sector)::integer+claimed_count)>2000 then 0
       else (r.offsets->>sector)::integer+claimed_count end,
       updated_at=now()
   where industry_qid=sector and next_offset=(r.offsets->>sector)::integer;
   get diagnostics delta=row_count;
   if delta<>1 then raise exception 'NET-LAUNCH2 cursor changed: concurrent run' using errcode='42501';end if;
 end loop;
 update public.network_netlaunch2_runs
 set status='completed',finished_at=now(),
 queried=seen_count,accepted=accepted,inserted=added,skipped=skipped where id=p_run_id;
 return jsonb_build_object('status','completed','queried',seen_count,
 'accepted',accepted,'new_unconfirmed',added,'duplicate_or_rejected',skipped,'canonical_published',0);
end $$;

revoke all on function public.netlaunch2_claim_daily() from public,anon,authenticated;
revoke all on function public.netlaunch2_commit_daily(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.netlaunch2_claim_daily() to service_role;
grant execute on function public.netlaunch2_commit_daily(uuid,jsonb,jsonb) to service_role;
