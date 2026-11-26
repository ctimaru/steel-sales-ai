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

-- Assert the per-claim ceiling and the existing daily cap on a separate cohort.
UPDATE private.test_policy SET active=true;
TRUNCATE private.net_it_seed1_domains,private.net_it_overture_provenance;
INSERT INTO private.net_it_seed1_domains(domain,proposed_url,source_id,status,attempts,detail,claimed_at,updated_at)
SELECT 'retry'||i||'.example','https://retry'||i||'.example/',
 '00000000-0000-4000-8000-000000000001'::uuid,'unreachable',1,'ReadTimeout',
 now()-interval '48 hours',now()-interval '48 hours'
FROM generate_series(1,15) i;
INSERT INTO private.net_it_overture_provenance(source_id,domain)
 SELECT source_id,domain FROM private.net_it_seed1_domains;
DO $$ DECLARE r jsonb; BEGIN
 r:=private.net_it_seed1_claim_batch_impl(100);
 IF coalesce(jsonb_array_length(r->'items'),0)<>10 THEN RAISE EXCEPTION 'retry claim ceiling failed: %',r; END IF;
 UPDATE private.net_it_seed1_policy SET daily_crawl_cap=10 WHERE singleton;
 r:=private.net_it_seed1_claim_batch_impl(100);
 IF r->>'status'<>'daily_limit_reached' THEN RAISE EXCEPTION 'retry daily cap failed: %',r; END IF;
END $$;
