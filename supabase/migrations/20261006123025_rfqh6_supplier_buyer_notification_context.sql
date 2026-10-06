
create or replace function rfqh_secure.rfqh6_supplier_notification_context_impl(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_supplier public.buyer_rfq_suppliers%rowtype;
  v_buyer_email text;
  v_organization_name text;
begin
  select * into v_dispatch
  from public.buyer_rfq_dispatches d
  where d.token_hash=p_token_hash
    and d.status not in('cancelled','failed','bounced','complained','declined')
  limit 1;

  if not found then
    return jsonb_build_object('valid',false);
  end if;

  select * into v_campaign
  from public.buyer_rfq_campaigns r
  where r.id=v_dispatch.rfq_id;

  if not found or v_campaign.status not in('launched','collecting') then
    return jsonb_build_object('valid',false);
  end if;

  select * into v_supplier
  from public.buyer_rfq_suppliers s
  where s.id=v_dispatch.supplier_id;

  select u.email into v_buyer_email
  from auth.users u
  where u.id=v_dispatch.owner_user_id;

  select o.name into v_organization_name
  from public.organizations o
  where o.id=v_dispatch.organization_id;

  return jsonb_build_object(
    'valid',true,
    'rfq_id',v_dispatch.rfq_id,
    'buyer_email',v_buyer_email,
    'buyer_organization_name',coalesce(v_organization_name,'Buyer Smart Steel Sales'),
    'supplier_name',v_supplier.supplier_name,
    'rfq_title',v_campaign.title
  );
end;
$$;

revoke all on function rfqh_secure.rfqh6_supplier_notification_context_impl(text) from public;
grant execute on function rfqh_secure.rfqh6_supplier_notification_context_impl(text) to anon,authenticated;

create or replace function public.rfqh6_supplier_notification_context(
  p_token_hash text
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select rfqh_secure.rfqh6_supplier_notification_context_impl(p_token_hash)
$$;

revoke all on function public.rfqh6_supplier_notification_context(text) from public,anon,authenticated;
grant execute on function public.rfqh6_supplier_notification_context(text) to anon,authenticated;

notify pgrst,'reload schema';
