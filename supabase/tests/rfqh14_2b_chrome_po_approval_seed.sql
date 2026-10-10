-- RFQH14.2b — disposable local Supabase ONLY. Runs AFTER both DEMOTEST2.3 and RFQH14.2 Chrome.
-- Uses existing GoTrue buyer and buyerViewer accounts; no new user or external supplier.
-- Converts the test viewer to an admin/approver only AFTER earlier viewer-role regressions finish.
\set ON_ERROR_STOP on
begin;
update public.organization_memberships set role='admin', business_role='sales_director'
where organization_id='00000000-0000-0000-0000-000000023301'::uuid
  and user_id=:'buyerViewer_user_id'::uuid
  and role='viewer';
do $guard$
begin
  if (select count(*) from public.organization_memberships
        where organization_id='00000000-0000-0000-0000-000000023301'::uuid
        and role='admin' and status='active')<>2
    then raise exception 'RFQH14.2b requires precisely two independent active buyer admins'; end if;
  if (select count(*) from public.buyer_rfq_quotes
        where rfq_id='00000000-0000-0000-0000-000000023321'::uuid
        and status='submitted')<>1
    then raise exception 'RFQH14.2b requires RFQH14.2 Chrome producer quote'; end if;
end $guard$;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'buyer_user_id',true);

-- Important: PO approval is enabled; award is made from the actually submitted
-- producer quote only, and does not bypass any company policy requiring approval.
select public.rfqh13_set_governance(
  '00000000-0000-0000-0000-000000023301'::uuid,false,true
);
select public.rfqh13_set_team_member(
  '00000000-0000-0000-0000-000000023321'::uuid,
  :'buyerViewer_user_id'::uuid,
  'approver','active'
);
select public.rfqh7_confirm_award(
  '00000000-0000-0000-0000-000000023321'::uuid,
  'Local Chrome PO approval and supplier confirmation test only',
  (
    select jsonb_agg(
      jsonb_build_object('line_id',l.id,'supplier_id',s.id,'awarded_tonnes',l.line_tonnes)
      order by l.line_position
    )
    from public.buyer_distinta_lines l
    join public.buyer_rfq_suppliers s
      on s.rfq_id='00000000-0000-0000-0000-000000023321'::uuid
     and s.supplier_organization_id='00000000-0000-0000-0000-000000023302'::uuid
    where l.distinta_id='00000000-0000-0000-0000-000000023311'::uuid
  )
);

select public.rfqh9_update_po_terms(p.id,'EXW','Net 30',current_date+25,18,
  'RFQH14.2b LOCAL ONLY — no provider email')
from public.buyer_purchase_order_drafts p
where p.rfq_id='00000000-0000-0000-0000-000000023321'::uuid;

select public.rfqh13_request_approval(
  '00000000-0000-0000-0000-000000023321'::uuid,
  'po_issue',p.id,'Emissione Purchase Order',
  jsonb_build_object('buyer_message',null::text,'confirmation_due_at',null::text)
)
from public.buyer_purchase_order_drafts p
where p.rfq_id='00000000-0000-0000-0000-000000023321'::uuid;

reset role;
do $verify$
begin
  if (select count(*) from public.buyer_purchase_order_drafts
      where rfq_id='00000000-0000-0000-0000-000000023321'::uuid and status='draft')<>1
    then raise exception 'RFQH14.2b requires one untouched PO draft'; end if;
  if (select count(*) from public.buyer_procurement_approvals a
      where a.rfq_id='00000000-0000-0000-0000-000000023321'::uuid
        and a.action_type='po_issue' and a.status='pending')<>1
    then raise exception 'RFQH14.2b requires precisely one pending PO approval'; end if;
  if (select count(*) from public.buyer_purchase_order_versions
      where rfq_id='00000000-0000-0000-0000-000000023321'::uuid)<>0
    then raise exception 'RFQH14.2b forbids pre-issued PO versions'; end if;
end $verify$;
commit;
select 'RFQH14.2b LOCAL ONLY: buyer award, pending second-user PO approval, zero PO versions/provider sends' as result;
