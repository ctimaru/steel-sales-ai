-- NET-PIPELINE1B.2F. Technical worker endpoint, production installed DISABLED.
-- Invoke only from trusted server using a server-side service-role credential.
-- Never expose the service-role credential in browser/client code.
-- Schedule after acceptance; no cron is installed by this migration.
create or replace function public.net_pipeline1b2_technical_batch(p_max integer default 1, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_enabled boolean; v_cap integer; v record; v_eval jsonb;
        v_new_id uuid; v_done integer:=0; v_skipped integer:=0;
        v_results jsonb:='[]'::jsonb;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'server-side service role required' using errcode='42501';
  end if;
  if p_max is null or p_max<1 or p_max>10 then
    raise exception 'batch limit must be between 1 and 10' using errcode='22023';
  end if;
  select enabled,batch_limit into v_enabled,v_cap from private.net_pipeline1b2_settings where singleton=true;
  if not found then raise exception 'publisher settings missing'; end if;
  if not p_dry_run and not v_enabled then
    raise exception 'publisher kill-switch OFF' using errcode='42501';
  end if;
  if not p_dry_run and p_max>v_cap then
    raise exception 'batch exceeds configured cap' using errcode='22023';
  end if;
  -- One publisher transaction at a time; also shares the lock with the user RPC.
  perform pg_advisory_xact_lock(810021,20262);
  for v in
    select d.* from public.network_company_discovery_candidates d
    where d.review_status='pending_review'
      and d.governance_status='approved_company_data'
    order by d.created_at,d.id limit p_max
  loop
    v_eval:=private.net_pipeline1b2_eligibility(v.id);
    if (v_eval->>'eligible')::boolean is not true then
      v_skipped:=v_skipped+1;
      v_results:=v_results||jsonb_build_array(jsonb_build_object(
        'candidate_id',v.id,'status','held','reason',v_eval->>'reason'));
      continue;
    end if;
    if p_dry_run then
      v_results:=v_results||jsonb_build_array(jsonb_build_object(
        'candidate_id',v.id,'status','eligible_dry_run'));
      continue;
    end if;
    -- Safeguard: only source website identity, no names/contacts/capabilities from other sites.
    -- Restrict automation to reviewed candidates; unrelated datasets remain untouched.
    insert into public.network_companies(
      legal_name,country_code,website_url,website_domain,
      publication_status,claimed_status,verification_status
    ) values (
      trim(v.legal_name),v.country_code,v.website_url,lower(trim(v.canonical_domain)),
      'published','unclaimed','unverified'
    ) returning id into v_new_id;
    insert into private.net_pipeline1b2_publication_ledger(
      candidate_id,company_id,source_url,source_domain,classification,executed_by
    ) values (
      v.id,v_new_id,v.source_url,lower(trim(v.canonical_domain)),
      'minimal_unverified',null
    );
    update public.network_company_discovery_candidates
       set review_status='published',promoted_company_id=v_new_id,
           reviewed_at=now(),
           review_note='NET-PIPELINE1B.2F service-role governed automatic publisher'
     where id=v.id;
    v_done:=v_done+1;
    v_results:=v_results||jsonb_build_array(jsonb_build_object(
      'candidate_id',v.id,'status','published','company_id',v_new_id));
  end loop;
  return jsonb_build_object('dry_run',p_dry_run,'published',v_done,
    'held',v_skipped,'results',v_results);
end;$$;
revoke all on function public.net_pipeline1b2_technical_batch(integer,boolean)
  from public,anon,authenticated;
grant execute on function public.net_pipeline1b2_technical_batch(integer,boolean)
  to service_role;
