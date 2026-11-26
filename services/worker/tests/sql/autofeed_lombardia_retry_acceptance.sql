DO $$ DECLARE r jsonb; BEGIN
 r:=private.net_it_seed1_claim_batch_impl(1);
 IF r->'items'->0->>'domain'<>'fresh.example' THEN RAISE EXCEPTION 'fresh priority failed: %',r; END IF;
 r:=private.net_it_seed1_claim_batch_impl(100);
 IF jsonb_array_length(r->'items')<>2 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'items') i WHERE i->>'domain'='retry.example') OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'items') i WHERE i->>'domain'='retry2.example') THEN RAISE EXCEPTION 'retry gate failed: %',r; END IF;
 IF EXISTS(SELECT 1 FROM private.net_it_seed1_domains WHERE domain IN ('retry.example','retry2.example') AND (status<>'claimed' OR attempts NOT BETWEEN 2 AND 3)) THEN RAISE EXCEPTION 'attempt count failed'; END IF;
 r:=private.net_it_seed1_claim_batch_impl(100);
 IF r->>'status'<>'queue_empty' THEN RAISE EXCEPTION 'ineligible retry claimed: %',r; END IF;
 UPDATE private.test_policy SET active=false;
 r:=private.net_it_seed1_claim_batch_impl(100);
 IF r->>'status'<>'policy_disabled' THEN RAISE EXCEPTION 'policy bypass: %',r; END IF;
END $$;
