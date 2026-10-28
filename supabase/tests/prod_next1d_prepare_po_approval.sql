-- PROD-NEXT1.D — same BD15 Chrome-created buyer RFQ, producer quote already UI-submitted.
-- Only disposable localhost PostgreSQL in GitHub runner. No email/marketplace sends.
\set ON_ERROR_STOP on
begin;
select id as next1d_rfq_id,source_distinta_id as next1d_distinta_id
from public.buyer_rfq_campaigns where title='BD15 E2E LOCAL 1440'
\gset
select set_config('prod_next1d.rfq_id',:'next1d_rfq_id',true);
do $guard$
declare v_rfq uuid := current_setting('prod_next1d.rfq_id')::uuid;
begin
 if (select count(*) from public.buyer_rfq_quotes
     where rfq_id=v_rfq and status='submitted')<>1
   then raise exception 'Single-RFQ must have one browser-submitted producer quote'; end if;
 if (select count(*) from public.buyer_rfq_dispatch_messages where rfq_id=v_rfq)<>0
   then raise exception 'Single-RFQ unexpectedly sent outbound RFQ email'; end if;
 if (select count(*) from public.organization_memberships
      where organization_id='00000000-0000-0000-0000-000000023301'::uuid
      and user_id=:'buyerViewer_user_id'::uuid and role='admin' and status='active')<>1
   then raise exception 'Prior browser PO test must have promoted separate viewer to admin approver'; end if;
end $guard$;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'buyer_user_id',true);
-- Existing public application RPCs with real signed buyer identity, not direct
-- insert or bypass RLS/approval checks.
select public.rfqh13_set_governance(
  '00000000-0000-0000-0000-000000023301'::uuid,false,true
);
select public.rfqh13_set_team_member(
  :'next1d_rfq_id'::uuid,:'buyerViewer_user_id'::uuid,'approver','active'
);
select public.rfqh7_confirm_award(
  :'next1d_rfq_id'::uuid,
  'PROD-NEXT1.D same browser-created RFQ — local-only approved award test',
  (
    select jsonb_agg(
      jsonb_build_object(
        'line_id',l.id,
        'supplier_id',s.id,
        'awarded_tonnes',l.line_tonnes
      ) order by l.line_position
    )
    from public.buyer_distinta_lines l
    join public.buyer_rfq_suppliers s
      on s.rfq_id=:'next1d_rfq_id'::uuid
     and s.supplier_organization_id='00000000-0000-0000-0000-000000023302'::uuid
    where l.distinta_id=:'next1d_distinta_id'::uuid
  )
);
select public.rfqh9_update_po_terms(p.id,'EXW','Net 30',current_date+25,18,
  'PROD-NEXT1.D local test only: no provider email')
from public.buyer_purchase_order_drafts p where p.rfq_id=:'next1d_rfq_id'::uuid;
select public.rfqh13_request_approval(
  :'next1d_rfq_id'::uuid,'po_issue',p.id,
  'Emissione Purchase Order',
  jsonb_build_object('buyer_message',null::text,'confirmation_due_at',null::text)
) from public.buyer_purchase_order_drafts p where p.rfq_id=:'next1d_rfq_id'::uuid;
reset role;
do $verify$
declare v_id uuid := current_setting('prod_next1d.rfq_id')::uuid;
begin
 if (select count(*) from public.buyer_purchase_order_drafts
     where rfq_id=v_id and status='draft')<>1
   then raise exception 'Single-RFQ no PO draft after buyer award'; end if;
 if (select count(*) from public.buyer_procurement_approvals
     where rfq_id=v_id and action_type='po_issue' and status='pending')<>1
   then raise exception 'Single-RFQ must require another member approval'; end if;
 if (select count(*) from public.buyer_purchase_order_versions where rfq_id=v_id)<>0
   then raise exception 'Single-RFQ PO cannot pre-issue'; end if;
end $verify$;
commit;
select 'PROD-NEXT1.D PASS: browser-created RFQ awarded, separate approval pending, 0 provider sends' as result;
