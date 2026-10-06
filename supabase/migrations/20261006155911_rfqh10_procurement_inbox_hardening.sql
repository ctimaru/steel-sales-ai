create or replace function private.rfqh10_procurement_inbox_impl(
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_limit integer:=least(greatest(coalesce(p_limit,100),1),200);
  v_items jsonb;
  v_summary jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  with
  my_rfq as (
    select r.id,r.title,r.status,r.due_at,r.created_at,r.launched_at,r.awarded_at,
           r.owner_user_id,r.organization_id
    from public.buyer_rfq_campaigns r
    where r.owner_user_id=v_user_id
      and r.status not in('closed','cancelled')
  ),
  supplier_stats as (
    select s.rfq_id,
           count(*)::int supplier_count,
           count(*) filter(where s.status in('responded','awarded'))::int responded_count
    from public.buyer_rfq_suppliers s
    join my_rfq r on r.id=s.rfq_id
    group by s.rfq_id
  ),
  quote_stats as (
    select q.rfq_id,
           count(*) filter(where q.status='submitted')::int submitted_quote_count,
           max(q.submitted_at) filter(where q.status='submitted') last_quote_at
    from public.buyer_rfq_quotes q
    join my_rfq r on r.id=q.rfq_id
    group by q.rfq_id
  ),
  dispatch_stats as (
    select d.rfq_id,
           count(*) filter(where d.status in('failed','bounced','complained'))::int failed_count,
           count(*) filter(where d.status in('sent','delivered','opened'))::int awaiting_count,
           max(coalesce(d.opened_at,d.delivered_at,d.sent_at)) last_dispatch_activity
    from public.buyer_rfq_dispatches d
    join my_rfq r on r.id=d.rfq_id
    group by d.rfq_id
  ),
  negotiation_items as (
    select
      'negotiation:'||n.id::text item_id,
      'negotiation'::text kind,
      'negotiation'::text stage,
      r.id rfq_id,
      r.title rfq_title,
      n.supplier_id,
      coalesce(s.supplier_name,s.supplier_email_normalized,'Fornitore') supplier_name,
      n.id source_id,
      n.status source_status,
      n.request_due_at due_at,
      case
        when n.status in('awaiting_buyer','bafo_received')
          and n.request_due_at is not null and n.request_due_at<now() then 'urgent'
        when n.status in('awaiting_buyer','bafo_received') then 'high'
        when n.status in('awaiting_supplier','bafo_requested')
          and n.request_due_at is not null and n.request_due_at<now() then 'high'
        else 'waiting'
      end priority,
      case
        when n.status in('awaiting_buyer','bafo_received') then true
        when n.status in('awaiting_supplier','bafo_requested')
          and n.request_due_at is not null and n.request_due_at<now() then true
        else false
      end requires_action,
      case
        when n.status='bafo_received' then 'Valuta BAFO ricevuta'
        when n.status='awaiting_buyer' then 'Rispondi al supplier'
        when n.status='bafo_requested' and n.request_due_at<now() then 'BAFO scaduta: fai follow-up'
        when n.status='awaiting_supplier' and n.request_due_at<now() then 'Richiesta scaduta: fai follow-up'
        when n.status='bafo_requested' then 'In attesa BAFO'
        else 'In attesa supplier'
      end headline,
      case
        when n.active_request_type='clarification' then 'Chiarimento'
        when n.active_request_type='revision' then 'Revisione'
        when n.active_request_type='counter_target' then 'Counter target'
        when n.active_request_type='bafo' then 'Best & Final Offer'
        else 'Negoziazione'
      end detail,
      case
        when n.status in('awaiting_buyer','bafo_received') then 'Apri negoziazione'
        when n.request_due_at is not null and n.request_due_at<now() then 'Apri e fai follow-up'
        else 'Apri RFQ'
      end action_label,
      case
        when n.status='bafo_received' then 'review_bafo'
        when n.status='awaiting_buyer' then 'respond_negotiation'
        when n.request_due_at is not null and n.request_due_at<now() then 'follow_up_negotiation'
        else 'monitor_negotiation'
      end action_code,
      case
        when n.status in('awaiting_buyer','bafo_received') and n.request_due_at is not null and n.request_due_at<now() then 10
        when n.status in('awaiting_buyer','bafo_received') then 20
        when n.request_due_at is not null and n.request_due_at<now() then 30
        else 80
      end sort_rank,
      n.updated_at activity_at
    from public.buyer_rfq_negotiation_threads n
    join my_rfq r on r.id=n.rfq_id
    left join public.buyer_rfq_suppliers s on s.id=n.supplier_id
    where n.status in('awaiting_buyer','awaiting_supplier','bafo_requested','bafo_received')
  ),
  po_items as (
    select
      'po:'||p.id::text item_id,
      'purchase_order'::text kind,
      'po'::text stage,
      r.id rfq_id,
      r.title rfq_title,
      p.supplier_id,
      coalesce(p.supplier_name_snapshot,p.supplier_email_snapshot,'Fornitore') supplier_name,
      p.id source_id,
      p.status source_status,
      v.confirmation_due_at due_at,
      case
        when p.status in('change_requested','supplier_rejected') then 'urgent'
        when v.delivery_status='failed' then 'urgent'
        when p.status='issued' and v.confirmation_due_at is not null and v.confirmation_due_at<now() then 'urgent'
        when p.status='issued' and v.confirmation_due_at is not null and v.confirmation_due_at<=now()+interval '24 hours' then 'high'
        when p.status='draft' then 'high'
        when p.status='issued' then 'waiting'
        else 'normal'
      end priority,
      case
        when p.status in('change_requested','supplier_rejected','draft') then true
        when v.delivery_status='failed' then true
        when p.status='issued' and v.confirmation_due_at is not null and v.confirmation_due_at<now() then true
        else false
      end requires_action,
      case
        when p.status='change_requested' then 'Supplier ha richiesto una modifica PO'
        when p.status='supplier_rejected' then 'Supplier ha rifiutato il PO'
        when v.delivery_status='failed' then 'Invio PO non riuscito'
        when p.status='draft' then 'PO pronto da emettere'
        when p.status='issued' and v.confirmation_due_at is not null and v.confirmation_due_at<now() then 'Conferma PO scaduta'
        when p.status='issued' and v.confirmation_due_at is not null and v.confirmation_due_at<=now()+interval '24 hours' then 'Conferma PO in scadenza'
        else 'PO in attesa di conferma'
      end headline,
      p.po_draft_ref ||
        case when v.version_no is not null then ' · V'||v.version_no::text else '' end ||
        ' · € '||to_char(p.total_eur,'FM9999999990.00') detail,
      case
        when p.status in('change_requested','supplier_rejected') then 'Rivedi e riemetti PO'
        when v.delivery_status='failed' then 'Apri PO e recupera invio'
        when p.status='draft' then 'Emetti PO'
        when p.status='issued' and v.confirmation_due_at is not null and v.confirmation_due_at<now() then 'Apri PO e fai follow-up'
        else 'Apri PO'
      end action_label,
      case
        when p.status='change_requested' then 'review_po_change'
        when p.status='supplier_rejected' then 'review_po_rejection'
        when v.delivery_status='failed' then 'recover_po_delivery'
        when p.status='draft' then 'issue_po'
        when p.status='issued' and v.confirmation_due_at is not null and v.confirmation_due_at<now() then 'follow_up_po'
        else 'monitor_po'
      end action_code,
      case
        when p.status='change_requested' then 5
        when p.status='supplier_rejected' then 8
        when v.delivery_status='failed' then 12
        when p.status='issued' and v.confirmation_due_at is not null and v.confirmation_due_at<now() then 15
        when p.status='draft' then 25
        when p.status='issued' and v.confirmation_due_at is not null and v.confirmation_due_at<=now()+interval '24 hours' then 35
        else 85
      end sort_rank,
      coalesce(v.supplier_responded_at,v.issued_at,p.updated_at) activity_at
    from public.buyer_purchase_order_drafts p
    join my_rfq r on r.id=p.rfq_id
    left join lateral (
      select pv.*
      from public.buyer_purchase_order_versions pv
      where pv.po_draft_id=p.id
      order by pv.version_no desc
      limit 1
    ) v on true
    where p.status in('draft','issued','change_requested','supplier_rejected')
  ),
  rfq_items as (
    select
      'rfq:'||r.id::text item_id,
      'rfq'::text kind,
      'rfq'::text stage,
      r.id rfq_id,
      r.title rfq_title,
      null::uuid supplier_id,
      null::text supplier_name,
      r.id source_id,
      r.status source_status,
      r.due_at due_at,
      case
        when coalesce(ds.failed_count,0)>0 then 'urgent'
        when r.status in('launched','collecting') and coalesce(qs.submitted_quote_count,0)=0 and r.due_at is not null and r.due_at<now() then 'urgent'
        when r.status in('launched','collecting') and coalesce(qs.submitted_quote_count,0)>0 and r.due_at is not null and r.due_at<now() then 'high'
        when r.status in('launched','collecting') and r.due_at is not null and r.due_at<=now()+interval '24 hours' then 'high'
        when r.status in('launched','collecting') and coalesce(qs.submitted_quote_count,0)>0 then 'high'
        when r.status in('draft','ready') then 'normal'
        else 'waiting'
      end priority,
      case
        when coalesce(ds.failed_count,0)>0 then true
        when r.status in('draft','ready') then true
        when r.status in('launched','collecting') and r.due_at is not null and r.due_at<now() then true
        when r.status in('launched','collecting') and coalesce(qs.submitted_quote_count,0)>0 then true
        else false
      end requires_action,
      case
        when coalesce(ds.failed_count,0)>0 then 'Invii supplier da recuperare'
        when r.status in('draft','ready') and coalesce(ss.supplier_count,0)=0 then 'Aggiungi supplier alla RFQ'
        when r.status in('draft','ready') then 'RFQ pronta per il lancio'
        when coalesce(qs.submitted_quote_count,0)=0 and r.due_at is not null and r.due_at<now() then 'RFQ scaduta senza offerte'
        when coalesce(qs.submitted_quote_count,0)>0 and r.due_at is not null and r.due_at<now() then 'Scadenza raggiunta: valuta award'
        when coalesce(qs.submitted_quote_count,0)>0 then 'Offerte ricevute da valutare'
        when r.due_at is not null and r.due_at<=now()+interval '24 hours' then 'RFQ in scadenza senza offerte'
        else 'In attesa di offerte'
      end headline,
      coalesce(ss.supplier_count,0)::text||' supplier · '||
      coalesce(qs.submitted_quote_count,0)::text||' offerte · '||
      coalesce(ds.failed_count,0)::text||' invii critici' detail,
      case
        when coalesce(ds.failed_count,0)>0 then 'Apri dispatch'
        when r.status in('draft','ready') and coalesce(ss.supplier_count,0)=0 then 'Aggiungi supplier'
        when r.status in('draft','ready') then 'Apri e lancia RFQ'
        when coalesce(qs.submitted_quote_count,0)>0 then 'Confronta offerte'
        when r.due_at is not null and r.due_at<=now() then 'Apri e fai follow-up'
        else 'Apri RFQ'
      end action_label,
      case
        when coalesce(ds.failed_count,0)>0 then 'recover_dispatch'
        when r.status in('draft','ready') and coalesce(ss.supplier_count,0)=0 then 'add_suppliers'
        when r.status in('draft','ready') then 'launch_rfq'
        when coalesce(qs.submitted_quote_count,0)>0 then 'review_quotes'
        when r.due_at is not null and r.due_at<=now() then 'follow_up_rfq'
        else 'monitor_rfq'
      end action_code,
      case
        when coalesce(ds.failed_count,0)>0 then 18
        when r.status in('launched','collecting') and coalesce(qs.submitted_quote_count,0)=0 and r.due_at is not null and r.due_at<now() then 22
        when r.status in('launched','collecting') and coalesce(qs.submitted_quote_count,0)>0 and r.due_at is not null and r.due_at<now() then 28
        when r.status in('launched','collecting') and r.due_at is not null and r.due_at<=now()+interval '24 hours' then 38
        when r.status in('launched','collecting') and coalesce(qs.submitted_quote_count,0)>0 then 45
        when r.status in('draft','ready') then 60
        else 90
      end sort_rank,
      coalesce(qs.last_quote_at,ds.last_dispatch_activity,r.launched_at,r.created_at) activity_at
    from my_rfq r
    left join supplier_stats ss on ss.rfq_id=r.id
    left join quote_stats qs on qs.rfq_id=r.id
    left join dispatch_stats ds on ds.rfq_id=r.id
    where r.status in('draft','ready','launched','collecting')
  ),
  all_items as (
    select * from negotiation_items
    union all
    select * from po_items
    union all
    select * from rfq_items
  ),
  ranked as (
    select *
    from all_items
    order by sort_rank asc,
             due_at asc nulls last,
             activity_at desc nulls last,
             item_id
    limit v_limit
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'item_id',item_id,
      'kind',kind,
      'stage',stage,
      'priority',priority,
      'requires_action',requires_action,
      'rfq_id',rfq_id,
      'rfq_title',rfq_title,
      'supplier_id',supplier_id,
      'supplier_name',supplier_name,
      'source_id',source_id,
      'source_status',source_status,
      'headline',headline,
      'detail',detail,
      'action_label',action_label,
      'action_code',action_code,
      'due_at',due_at,
      'activity_at',activity_at,
      'sort_rank',sort_rank
    )
    order by sort_rank asc,due_at asc nulls last,activity_at desc nulls last,item_id
  ),'[]'::jsonb)
  into v_items
  from ranked;

  with items as (
    select *
    from jsonb_to_recordset(v_items) as x(
      item_id text,
      kind text,
      stage text,
      priority text,
      requires_action boolean,
      rfq_id uuid,
      rfq_title text,
      supplier_id uuid,
      supplier_name text,
      source_id uuid,
      source_status text,
      headline text,
      detail text,
      action_label text,
      action_code text,
      due_at timestamptz,
      activity_at timestamptz,
      sort_rank integer
    )
  )
  select jsonb_build_object(
    'attention_total',count(*) filter(where requires_action),
    'urgent',count(*) filter(where priority='urgent'),
    'due_24h',count(*) filter(where due_at is not null and due_at>now() and due_at<=now()+interval '24 hours'),
    'overdue',count(*) filter(where due_at is not null and due_at<now()),
    'awaiting_buyer',count(*) filter(where action_code in('respond_negotiation','review_bafo','review_po_change','review_po_rejection')),
    'waiting_supplier',count(*) filter(where not requires_action and priority='waiting'),
    'po_attention',count(*) filter(where kind='purchase_order' and requires_action),
    'active_rfqs',(
      select count(*)::int
      from public.buyer_rfq_campaigns r
      where r.owner_user_id=v_user_id
        and r.status not in('closed','cancelled')
    )
  )
  into v_summary
  from items;

  return jsonb_build_object(
    'contract','RFQH10-procurement-inbox-v1',
    'generated_at',now(),
    'summary',coalesce(v_summary,'{}'::jsonb),
    'items',v_items
  );
end;
$$;

notify pgrst,'reload schema';