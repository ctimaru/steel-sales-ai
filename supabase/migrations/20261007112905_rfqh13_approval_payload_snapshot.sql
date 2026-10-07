alter table public.buyer_procurement_approvals
  add column if not exists payload_snapshot jsonb not null default '{}'::jsonb;

create or replace function private.rfqh13_request_approval_with_snapshot_impl(
  p_rfq_id uuid,
  p_action_type text,
  p_po_draft_id uuid,
  p_reason text,
  p_context jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_result jsonb;
  v_approval_id uuid;
  v_snapshot jsonb;
  v_po public.buyer_purchase_order_drafts%rowtype;
begin
  v_result := private.rfqh13_request_approval_impl(
    p_rfq_id,
    p_action_type,
    p_po_draft_id,
    p_reason,
    coalesce(p_context,'{}'::jsonb)
  );

  if coalesce((v_result->>'required')::boolean,false)
     and nullif(v_result->>'approval_id','') is not null then
    v_approval_id := (v_result->>'approval_id')::uuid;

    if p_action_type='award' then
      v_snapshot := jsonb_build_object(
        'action_type','award',
        'rfq_id',p_rfq_id,
        'reason',btrim(coalesce(p_reason,'')),
        'allocations',coalesce(p_context->'allocations','[]'::jsonb)
      );
    else
      select * into v_po
      from public.buyer_purchase_order_drafts p
      where p.id=p_po_draft_id
        and p.rfq_id=p_rfq_id;

      if not found then
        raise exception 'PO draft does not belong to RFQ';
      end if;

      v_snapshot := jsonb_build_object(
        'action_type','po_issue',
        'rfq_id',p_rfq_id,
        'po_draft_id',v_po.id,
        'po_draft_ref',v_po.po_draft_ref,
        'supplier_name',v_po.supplier_name_snapshot,
        'currency_code',v_po.currency_code,
        'total_tonnes',v_po.total_tonnes,
        'total_eur',v_po.total_eur,
        'incoterm',v_po.incoterm,
        'payment_terms',v_po.payment_terms,
        'delivery_date',v_po.delivery_date,
        'lead_time_days',v_po.lead_time_days,
        'notes',v_po.notes,
        'buyer_message',nullif(btrim(coalesce(p_context->>'buyer_message','')),''),
        'confirmation_due_at',nullif(p_context->>'confirmation_due_at','')
      );
    end if;

    update public.buyer_procurement_approvals
    set payload_snapshot=v_snapshot,
        updated_at=now()
    where id=v_approval_id;
  end if;

  return v_result;
end;
$$;

create or replace function public.rfqh13_request_approval(
  p_rfq_id uuid,
  p_action_type text,
  p_po_draft_id uuid default null,
  p_reason text default null,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language sql
set search_path=''
as $$
  select private.rfqh13_request_approval_with_snapshot_impl(
    p_rfq_id,
    p_action_type,
    p_po_draft_id,
    p_reason,
    coalesce(p_context,'{}'::jsonb)
  );
$$;

revoke all on function public.rfqh13_request_approval(uuid,text,uuid,text,jsonb)
from public,anon,authenticated;
grant execute on function public.rfqh13_request_approval(uuid,text,uuid,text,jsonb)
to authenticated;

notify pgrst,'reload schema';
