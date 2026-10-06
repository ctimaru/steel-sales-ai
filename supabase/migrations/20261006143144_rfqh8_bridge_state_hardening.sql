create or replace function private.rfqh8_bridge_state_impl(
  p_rfq_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_bridge public.buyer_rfq_marketplace_bridges%rowtype;
  v_request public.marketplace_requests%rowtype;
  v_responses jsonb:='[]'::jsonb;
  v_suggestions jsonb;
  v_match_summary jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into v_campaign
  from public.buyer_rfq_campaigns r
  where r.id=p_rfq_id and r.owner_user_id=v_user_id;

  if not found then
    raise exception 'RFQ not found or not accessible' using errcode='42501';
  end if;

  select * into v_bridge
  from public.buyer_rfq_marketplace_bridges b
  where b.rfq_id=p_rfq_id;

  if not found then
    return jsonb_build_object(
      'contract','RFQH8-bridge-state-v1',
      'rfq_id',p_rfq_id,
      'bridge_ready',false,
      'suggestions',private.rfqh8_supplier_suggestions_impl(p_rfq_id,12),
      'responses','[]'::jsonb
    );
  end if;

  select * into v_request
  from public.marketplace_requests r
  where r.id=v_bridge.marketplace_request_id;

  v_suggestions:=private.rfqh8_supplier_suggestions_impl(p_rfq_id,12);

  if v_request.status='published' then
    v_match_summary:=private.p5_5_buyer_match_summary_impl(
      v_campaign.organization_id,v_request.id
    );
  else
    v_match_summary:=jsonb_build_object(
      'total_matches',
      jsonb_array_length(coalesce(v_suggestions->'candidates','[]'::jsonb)),
      'contactable_matches',
      (
        select count(*)::int
        from jsonb_array_elements(coalesce(v_suggestions->'candidates','[]'::jsonb)) c
        where coalesce((c->>'direct_invite_ready')::boolean,false)
      ),
      'state','draft_preview'
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'response_id',r.id,
    'supplier_organization_id',r.supplier_organization_id,
    'supplier_name',o.name,
    'response_kind',r.response_kind,
    'status',r.status,
    'message',r.message,
    'valid_until',r.valid_until,
    'submitted_at',r.submitted_at,
    'priced_line_count',(
      select count(*)::int
      from public.marketplace_response_lines rl
      where rl.response_id=r.id and rl.unit_price is not null
    ),
    'line_count',(
      select count(*)::int
      from public.marketplace_response_lines rl
      where rl.response_id=r.id
    ),
    'imported',(i.id is not null),
    'imported_quote_id',i.quote_id,
    'imported_at',i.imported_at
  ) order by r.submitted_at desc nulls last,r.created_at desc),'[]'::jsonb)
  into v_responses
  from public.marketplace_responses r
  join public.organizations o on o.id=r.supplier_organization_id
  left join public.buyer_rfq_marketplace_response_imports i
    on i.marketplace_response_id=r.id
  where r.request_id=v_request.id
    and r.status in('submitted','acknowledged','declined','closed');

  return jsonb_build_object(
    'contract','RFQH8-bridge-state-v1',
    'rfq_id',p_rfq_id,
    'bridge_ready',true,
    'bridge',jsonb_build_object(
      'bridge_id',v_bridge.id,
      'marketplace_request_id',v_bridge.marketplace_request_id,
      'bridge_status',v_bridge.status,
      'marketplace_status',v_request.status,
      'product_family_key',v_bridge.product_family_key,
      'visibility_mode',v_bridge.visibility_mode,
      'delivery_country_code',v_bridge.delivery_country_code,
      'delivery_region',v_bridge.delivery_region,
      'published_at',v_request.published_at,
      'closes_at',v_request.closes_at
    ),
    'suggestions',v_suggestions,
    'match_summary',v_match_summary,
    'responses',v_responses
  );
end;
$$;

notify pgrst,'reload schema';
