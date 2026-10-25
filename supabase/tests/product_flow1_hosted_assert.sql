-- Actual UI must have created two private buyer-A drafts; no supplier sends.
\set ON_ERROR_STOP on
\if :{?flow1_auth_users_before}
\else
 \quit 1
\endif
\if :{?flow1_legal_acceptances_before}
\else
 \quit 1
\endif
SELECT (SELECT count(*) FROM auth.users)=:'flow1_auth_users_before'::bigint
 AND (SELECT count(*) FROM public.user_legal_acceptances)=:'flow1_legal_acceptances_before'::bigint AS flow1_audit_unchanged \gset
\if :flow1_audit_unchanged
\else
 \quit 1
\endif
DO $$ DECLARE r record; BEGIN
 IF (SELECT count(*) FROM public.buyer_rfq_campaigns WHERE organization_id IN ('00000000-0000-4000-8000-000000072201','00000000-0000-4000-8000-000000072202'))<>2
  OR (SELECT count(DISTINCT source_distinta_id) FROM public.buyer_rfq_campaigns WHERE organization_id='00000000-0000-4000-8000-000000072201')<>2
  OR (SELECT count(DISTINCT title) FROM public.buyer_rfq_campaigns WHERE organization_id='00000000-0000-4000-8000-000000072201' AND title IN ('FLOW1 HOSTED 390','FLOW1 HOSTED 1440'))<>2
  OR (SELECT count(*) FROM public.buyer_distintas WHERE organization_id IN ('00000000-0000-4000-8000-000000072201','00000000-0000-4000-8000-000000072202'))<>2
 THEN RAISE EXCEPTION 'FLOW1 must create exactly two distinct buyer-A RFQs and snapshots'; END IF;
 FOR r IN SELECT * FROM public.buyer_rfq_campaigns WHERE organization_id='00000000-0000-4000-8000-000000072201' LOOP
  IF r.owner_user_id<>'c8f21e9b-a1b8-4ab6-abc8-c07c81356bb5'::uuid OR r.status<>'draft' OR r.launched_at IS NOT NULL OR r.marketplace_request_id IS NOT NULL
   OR NOT EXISTS (SELECT 1 FROM public.buyer_distintas d WHERE d.id=r.source_distinta_id AND d.owner_user_id=r.owner_user_id AND d.organization_id=r.organization_id AND d.title=r.title AND d.line_count=2 AND d.total_meters=42)
   OR (SELECT count(*) FROM public.buyer_distinta_lines WHERE distinta_id=r.source_distinta_id)<>2
   OR (SELECT count(*) FROM public.buyer_distinta_lines WHERE distinta_id=r.source_distinta_id AND grade_code='S355J2H' AND quantity_mode='bars' AND description ~ '60[.,]3' AND description ~ '3[.,]2' AND
     ((line_position=1 AND standard_code='EN 10219' AND quantity=3 AND bar_length_m=6 AND line_meters=18) OR (line_position=2 AND standard_code='EN 10210' AND quantity=2 AND bar_length_m=12 AND line_meters=24)))<>2
  THEN RAISE EXCEPTION 'FLOW1 RFQ content, ownership, quantities or private draft invariant failed'; END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM public.buyer_rfq_dispatches WHERE organization_id IN ('00000000-0000-4000-8000-000000072201','00000000-0000-4000-8000-000000072202'))
  OR EXISTS (SELECT 1 FROM public.buyer_rfq_quotes WHERE organization_id IN ('00000000-0000-4000-8000-000000072201','00000000-0000-4000-8000-000000072202'))
  OR EXISTS (SELECT 1 FROM public.buyer_distinta_deliveries x JOIN public.buyer_distintas d ON d.id=x.distinta_id WHERE d.organization_id IN ('00000000-0000-4000-8000-000000072201','00000000-0000-4000-8000-000000072202'))
 THEN RAISE EXCEPTION 'FLOW1 hosted draft acceptance must have zero dispatches, deliveries and quotes'; END IF;
END $$;
SELECT 'FLOW1 hosted acceptance PASS: two private RFQs, 42m each, zero sends, unchanged Auth/legal counts' AS result;
