create or replace function private.rfqh2_verified_network_match_for_private_company(
  p_organization_id uuid,
  p_company_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_vat text;
  v_match uuid;
  v_count integer;
begin
  if not private.pa1_3_network_access_allowed_for(p_organization_id) then
    return null;
  end if;

  select nullif(private.hp4_normalize_identifier(v.identity_value),'')
  into v_vat
  from public.commercial_company_identity_verifications v
  where v.organization_id=p_organization_id
    and v.company_id=p_company_id
    and v.identity_type='vat_number'
  order by v.created_at desc,v.id desc
  limit 1;

  if v_vat is null then
    return null;
  end if;

  select
    count(*)::integer,
    (array_agg(nc.id order by nc.id))[1]
  into v_count,v_match
  from public.network_companies nc
  where nc.publication_status='published'
    and nc.archived_at is null
    and private.hp4_normalize_identifier(nc.vat_id)=v_vat;

  if v_count=1 then
    return v_match;
  end if;

  return null;
end;
$$;

revoke all on function private.rfqh2_verified_network_match_for_private_company(uuid,uuid)
from public, anon, authenticated;
