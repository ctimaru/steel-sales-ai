-- CRAWL-IT2 structural acceptance, use only on disposable local Supabase.
begin;
do $$
declare v uuid;
begin
  insert into public.network_discovery_source_registry(source_name,source_url,source_type)
  values ('Fixture Directory','https://example.org/directory','industry_directory')
  returning id into v;
  if not exists(
    select 1 from public.network_discovery_source_registry
    where id=v and country_code='IT' and governance_status='unreviewed'
      and enabled_for_discovery=false and minimum_interval_hours>=24
  ) then raise exception 'CRAWL-IT2 defaults are not fail closed'; end if;
  begin
    update public.network_discovery_source_registry
      set enabled_for_discovery=true where id=v;
    raise exception 'unsafe enable unexpectedly accepted';
  exception when check_violation then null;
  end;
  begin
    update public.network_discovery_source_registry
      set country_code='US' where id=v;
    raise exception 'non-Italian scope unexpectedly accepted';
  exception when check_violation then null;
  end;
end $$;
rollback;
