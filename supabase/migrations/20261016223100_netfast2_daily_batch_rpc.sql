-- NET-FAST2: one bounded and source-approved structured Wikidata query per UTC day.
create or replace function public.netfast2_claim_daily_batch()
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare s public.network_discovery_source_registry%rowtype;
 v_day date:=(now() at time zone 'UTC')::date; v_qid text; v_id uuid;
begin
 if current_user<>'service_role' then raise exception 'NETFAST2 worker only' using errcode='42501';end if;
 select * into s from public.network_discovery_source_registry
 where id='8425ec0f-c855-41d8-9bea-70a95fd8a6ba'::uuid;
 if not found or not s.enabled_for_discovery or s.governance_status<>'approved'
  or s.source_url<>'https://query.wikidata.org/sparql'
  or s.terms_status<>'allows_reuse' or s.database_rights_status<>'low_risk'
  or s.personal_data_policy<>'exclude_personal_data'
  or s.rights_evidence_url<>'https://www.wikidata.org/wiki/Wikidata:Licensing'
  or s.reviewed_by is null or s.reviewed_at is null or s.max_domains_per_run<100
 then return jsonb_build_object('eligible',false,'reason','wikidata_source_not_approved');end if;
 -- Rotate limited industry-specific queries. No multiple concurrent WDQS calls.
 v_qid:=(array['Q2285982','Q1924906','Q1957908','Q190117'])[1+(extract(doy from v_day)::int % 4)];
 insert into public.network_netfast2_batches(run_day,industry_qid)
 values(v_day,v_qid) on conflict(run_day) do nothing returning id into v_id;
 if v_id is null then return jsonb_build_object('eligible',false,'reason','daily_budget_used');end if;
 return jsonb_build_object('eligible',true,'run_id',v_id,'industry_qid',v_qid,
   'max_records',100,'source','wikidata_cc0','published',0);
end $$;

create or replace function public.netfast2_commit_daily_batch(p_run_id uuid,p_items jsonb)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare r public.network_netfast2_batches%rowtype;s jsonb;v_qid text;v_domain text;
v_name text;v_url text;v_industry text;n integer:=0;added integer:=0;skip integer:=0;row_added integer;
begin
 if current_user<>'service_role' then raise exception 'NETFAST2 worker only' using errcode='42501';end if;
 select * into r from public.network_netfast2_batches where id=p_run_id for update;
 if not found or r.status<>'claimed' or r.run_day<>(now() at time zone 'UTC')::date
 then raise exception 'NETFAST2: owned live daily run required' using errcode='42501';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>100
 then raise exception 'NETFAST2: max 100 CC0 records per day' using errcode='22023';end if;
 for s in select value from jsonb_array_elements(p_items) loop
   n:=n+1;
   if jsonb_typeof(s)<>'object' then skip:=skip+1;continue;end if;
   v_qid:=coalesce(s->>'qid','');v_name:=btrim(coalesce(s->>'label',''));
   v_domain:=lower(btrim(coalesce(s->>'domain','')));
   v_url:=coalesce(s->>'website','');v_industry:=coalesce(s->>'industry_qid','');
   -- The worker accepts exactly Wikidata item identifiers, not arbitrary URLs/prose.
   if v_industry<>r.industry_qid or v_qid !~ '^Q[1-9][0-9]{0,13}$'
    or length(v_name) not between 3 and 180
    or v_name ~* '(https?://|[@<>[:cntrl:]])'
    or v_domain !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
    or v_domain like '%..%'
    or v_url<>('https://'||v_domain||'/')
    or v_domain ~* '(^|[.])(facebook|linkedin|instagram|youtube|wikidata|wikipedia|google|twitter|tiktok|wordpress)[.]'
   then skip:=skip+1;continue;end if;
   if exists(select 1 from public.network_companies c where c.archived_at is null
      and regexp_replace(lower(coalesce(c.website_domain,'')),'^www[.]','')=v_domain)
   or exists(select 1 from public.network_company_discovery_candidates c
      where c.canonical_domain=v_domain)
   or exists(select 1 from public.network_core_target_leads t
      where t.canonical_domain=v_domain)
   then skip:=skip+1;continue;end if;
   insert into public.network_netfast2_structured_entities(
       source_entity_id,company_name,domain,website_url,industry_qid)
     values(v_qid,v_name,v_domain,v_url,v_industry)
     on conflict do nothing;
   get diagnostics row_added=row_count;
   added:=added+row_added;skip:=skip+1-row_added;
 end loop;
 update public.network_netfast2_batches set status='completed',finished_at=now(),
  proposed=n,inserted=added,skipped=skip where id=p_run_id;
 return jsonb_build_object('status','completed','run_id',p_run_id,
   'proposed',n,'inserted_discovered',added,'skipped',skip,'published',0);
end $$;
revoke all on function public.netfast2_claim_daily_batch() from public,anon,authenticated;
revoke all on function public.netfast2_commit_daily_batch(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.netfast2_claim_daily_batch() to service_role;
grant execute on function public.netfast2_commit_daily_batch(uuid,jsonb) to service_role;
