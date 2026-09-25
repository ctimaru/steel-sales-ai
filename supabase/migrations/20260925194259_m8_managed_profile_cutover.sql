create or replace function private.m8_my_network_company_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_result jsonb;
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'organization_id', l.organization_id,
    'network_company_id', c.id,
    'claim_status', cl.status,
    'link_status', l.link_status,
    'company', jsonb_build_object(
      'id', c.id,
      'legal_name', c.legal_name,
      'trading_name', c.trading_name,
      'country_code', c.country_code,
      'website_url', c.website_url,
      'description', c.description,
      'publication_status', c.publication_status,
      'claimed_status', c.claimed_status,
      'verification_status', c.verification_status
    )
  )
  into v_result
  from public.organization_memberships om
  join public.organization_network_company_links l
    on l.organization_id=om.organization_id
   and l.link_status='active'
  join public.network_company_claims cl
    on cl.organization_id=l.organization_id
   and cl.network_company_id=l.network_company_id
   and cl.status='approved'
  join public.network_companies c on c.id=l.network_company_id
  where om.user_id=v_user
    and om.status='active'
    and om.role='admin'
  order by om.is_default desc,om.updated_at desc
  limit 1;

  return v_result;
end;
$function$;

revoke all on function private.m8_my_network_company_impl() from public,anon;
grant execute on function private.m8_my_network_company_impl() to authenticated,service_role;

create or replace function public.m8_my_network_company()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.m8_my_network_company_impl();
$function$;

revoke all on function public.m8_my_network_company() from public,anon;
grant execute on function public.m8_my_network_company() to authenticated,service_role;

create or replace function private.m8_update_managed_network_company_impl(
  p_network_company_id uuid,
  p_trading_name text default null,
  p_website_url text default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_before public.network_companies%rowtype;
  v_after public.network_companies%rowtype;
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if not private.m7_user_can_manage_network_company(p_network_company_id,v_user) then
    raise exception 'approved company claim and active organization admin membership required'
      using errcode='42501';
  end if;

  select * into v_before
  from public.network_companies
  where id=p_network_company_id
  for update;

  if not found or v_before.publication_status='archived' then
    raise exception 'network company not found or archived' using errcode='P0002';
  end if;

  if p_trading_name is not null and char_length(btrim(p_trading_name))>255 then
    raise exception 'trading name exceeds 255 characters' using errcode='22023';
  end if;
  if p_website_url is not null and char_length(btrim(p_website_url))>500 then
    raise exception 'website url exceeds 500 characters' using errcode='22023';
  end if;
  if p_description is not null and char_length(p_description)>4000 then
    raise exception 'description exceeds 4000 characters' using errcode='22023';
  end if;

  update public.network_companies
  set trading_name=nullif(btrim(p_trading_name),''),
      website_url=nullif(btrim(p_website_url),''),
      description=nullif(btrim(p_description),'')
  where id=p_network_company_id
  returning * into v_after;

  if v_before.trading_name is distinct from v_after.trading_name then
    insert into public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
      ownership_type,asserted_by,confidence,review_state
    ) values(
      'company',p_network_company_id,'trading_name',to_jsonb(v_after.trading_name),
      'company_declared','managed_profile:m8','company_managed',v_user,1.0000,'accepted'
    );
  end if;

  if v_before.website_url is distinct from v_after.website_url then
    insert into public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
      ownership_type,asserted_by,confidence,review_state
    ) values(
      'company',p_network_company_id,'website_url',to_jsonb(v_after.website_url),
      'company_declared','managed_profile:m8','company_managed',v_user,1.0000,'accepted'
    );
  end if;

  if v_before.description is distinct from v_after.description then
    insert into public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
      ownership_type,asserted_by,confidence,review_state
    ) values(
      'company',p_network_company_id,'description',to_jsonb(v_after.description),
      'company_declared','managed_profile:m8','company_managed',v_user,1.0000,'accepted'
    );
  end if;

  return jsonb_build_object(
    'network_company_id',v_after.id,
    'trading_name',v_after.trading_name,
    'website_url',v_after.website_url,
    'description',v_after.description,
    'publication_status',v_after.publication_status,
    'verification_status',v_after.verification_status
  );
end;
$function$;

revoke all on function private.m8_update_managed_network_company_impl(uuid,text,text,text) from public,anon;
grant execute on function private.m8_update_managed_network_company_impl(uuid,text,text,text) to authenticated,service_role;

create or replace function public.m8_update_managed_network_company(
  p_network_company_id uuid,
  p_trading_name text default null,
  p_website_url text default null,
  p_description text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.m8_update_managed_network_company_impl(
    p_network_company_id,p_trading_name,p_website_url,p_description
  );
$function$;

revoke all on function public.m8_update_managed_network_company(uuid,text,text,text) from public,anon;
grant execute on function public.m8_update_managed_network_company(uuid,text,text,text) to authenticated,service_role;
