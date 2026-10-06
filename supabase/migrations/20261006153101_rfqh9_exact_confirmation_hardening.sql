create or replace function rfqh_secure.rfqh9_supplier_decide_impl(
  p_token_hash text,
  p_decision text,
  p_message text,
  p_confirmed_delivery_date date,
  p_supplier_reference text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_version public.buyer_purchase_order_versions%rowtype;
  v_existing public.buyer_purchase_order_supplier_responses%rowtype;
  v_decision text:=lower(btrim(coalesce(p_decision,'')));
  v_message text:=nullif(btrim(coalesce(p_message,'')),'');
  v_reference text:=nullif(btrim(coalesce(p_supplier_reference,'')),'');
begin
  if v_decision not in('confirmed','rejected','change_requested') then
    raise exception 'Invalid supplier PO decision';
  end if;

  if v_message is not null and char_length(v_message)>4000 then
    raise exception 'Supplier message exceeds maximum length';
  end if;

  if v_reference is not null and char_length(v_reference)>200 then
    raise exception 'Supplier reference exceeds maximum length';
  end if;

  if v_decision in('rejected','change_requested') and v_message is null then
    raise exception 'Supplier message is required for rejection or change request';
  end if;

  select * into v_version
  from public.buyer_purchase_order_versions v
  where v.token_hash=p_token_hash
  for update;

  if not found then
    raise exception 'PO link is invalid' using errcode='42501';
  end if;

  if v_version.status<>'issued' then
    select * into v_existing
    from public.buyer_purchase_order_supplier_responses r
    where r.po_version_id=v_version.id;

    if found then
      return jsonb_build_object(
        'po_version_id',v_version.id,
        'decision',v_existing.decision,
        'already_responded',true
      );
    end if;

    raise exception 'PO version is not open for supplier response';
  end if;

  if v_version.confirmation_due_at is not null and v_version.confirmation_due_at<=now() then
    raise exception 'PO confirmation deadline has passed';
  end if;

  if v_decision='confirmed'
     and p_confirmed_delivery_date is not null
     and v_version.delivery_date is distinct from p_confirmed_delivery_date then
    raise exception 'Confirmed delivery date must match issued PO; request a change instead';
  end if;

  insert into public.buyer_purchase_order_supplier_responses(
    po_version_id,po_draft_id,rfq_id,supplier_id,owner_user_id,organization_id,
    decision,message,confirmed_delivery_date,supplier_reference
  ) values(
    v_version.id,v_version.po_draft_id,v_version.rfq_id,v_version.supplier_id,
    v_version.owner_user_id,v_version.organization_id,
    v_decision,v_message,
    case
      when v_decision='confirmed' then coalesce(p_confirmed_delivery_date,v_version.delivery_date)
      else p_confirmed_delivery_date
    end,
    v_reference
  )
  returning * into v_existing;

  update public.buyer_purchase_order_versions
  set status=case
        when v_decision='confirmed' then 'supplier_confirmed'
        when v_decision='rejected' then 'supplier_rejected'
        else 'change_requested'
      end,
      supplier_responded_at=now(),
      updated_at=now()
  where id=v_version.id;

  update public.buyer_purchase_order_drafts
  set status=case
        when v_decision='confirmed' then 'supplier_confirmed'
        when v_decision='rejected' then 'supplier_rejected'
        else 'change_requested'
      end,
      delivery_date=case
        when v_decision='confirmed' then coalesce(p_confirmed_delivery_date,v_version.delivery_date)
        else delivery_date
      end,
      updated_at=now()
  where id=v_version.po_draft_id;

  perform private.rfqh3_log_event(
    v_version.rfq_id,v_version.supplier_id,v_version.owner_user_id,v_version.organization_id,
    case when v_decision='confirmed' then 'purchase_order_supplier_confirmed'
         when v_decision='rejected' then 'purchase_order_supplier_rejected'
         else 'purchase_order_supplier_change_requested' end,
    jsonb_build_object(
      'po_draft_id',v_version.po_draft_id,
      'po_version_id',v_version.id,
      'version_no',v_version.version_no,
      'decision',v_decision,
      'message',v_message,
      'confirmed_delivery_date',
        case when v_decision='confirmed'
          then coalesce(p_confirmed_delivery_date,v_version.delivery_date)
          else p_confirmed_delivery_date end,
      'supplier_reference',v_reference
    ),
    null
  );

  return jsonb_build_object(
    'po_version_id',v_version.id,
    'decision',v_decision,
    'already_responded',false
  );
end;
$$;

notify pgrst,'reload schema';