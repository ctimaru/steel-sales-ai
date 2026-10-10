-- CRAWL-IT3: isolated local verification of default-deny autonomous harvesting.
begin;
do $$
declare v uuid;
begin
  insert into public.network_discovery_source_registry(source_name,source_url,source_type)
  values ('Italy Test Directory','https://approved-test.example/directory','industry_directory')
  returning id into v;
  if exists(select 1 from public.network_discovery_source_registry where id=v and enabled_for_discovery) then
    raise exception 'unreviewed source unexpectedly enabled';
  end if;
  begin
    update public.network_discovery_source_registry set enabled_for_discovery=true where id=v;
    raise exception 'enabled without approval';
  exception when check_violation then null;
  end;
  insert into public.network_discovery_domain_leads(source_id,domain,proposed_url,evidence_url)
  values(v,'azienda-tubi.example','https://azienda-tubi.example/','https://approved-test.example/directory');
  if (select status from public.network_discovery_domain_leads where source_id=v) <> 'pending_review' then
    raise exception 'lead bypassed manual review';
  end if;
end $$;
rollback;
