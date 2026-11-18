-- NET-RO1.AUTO2.A/B: read the existing RO evidence ledger and publish only
-- narrowly documented company facts after every independent gate has passed.
-- No company-consent inference, no website text/image copying, no claim of
-- company verification, no bypass of robots/site terms or suppression.
-- This is a service_role-only implementation; migration performs no publication.

ALTER TABLE private.net_ro1_domain_verification_evidence
  ADD COLUMN IF NOT EXISTS verified_legal_name text,
  ADD COLUMN IF NOT EXISTS public_activity_summary text,
  ADD COLUMN IF NOT EXISTS identity_checked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS role_checked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS romania_checked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rights_basis text,
  ADD COLUMN IF NOT EXISTS publisher_preview_at timestamptz,
  ADD COLUMN IF NOT EXISTS publisher_preview_fingerprint text;

-- Restrict metadata to the essential company facts; do not silently
-- turn a research observation into a company-verified technical capability.
ALTER TABLE private.net_ro1_domain_verification_evidence
  ADD CONSTRAINT net_ro1_auto2_identity_and_text_guard CHECK (
    (verified_legal_name IS NULL OR
       (char_length(btrim(verified_legal_name)) BETWEEN 3 AND 255
        AND verified_legal_name !~ '[<>@]'))
    AND (public_activity_summary IS NULL OR
       (char_length(btrim(public_activity_summary)) BETWEEN 30 AND 350
        AND public_activity_summary !~ '[<>@]'))
    AND (rights_basis IS NULL OR
       char_length(btrim(rights_basis)) BETWEEN 30 AND 1000)
    AND (NOT published OR
      (identity_checked AND role_checked AND romania_checked
       AND verified_legal_name IS NOT NULL
       AND public_activity_summary IS NOT NULL
       AND rights_basis IS NOT NULL))
  );

-- RO-AUTO2.B: stable, read-only next-candidate queue, not 93 more imports.
CREATE OR REPLACE FUNCTION private.net_ro1_auto2_unchecked_queue(p_max integer DEFAULT 15)
RETURNS TABLE (
  seed_id uuid,
  canonical_domain text,
  proposed_role text,
  source_url text,
  review_lane text
)
LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $fn$
  SELECT s.id,s.canonical_domain,s.proposed_role,s.source_url,s.review_lane
  FROM private.network_web_research_seeds s
  WHERE s.country_code='RO'
    AND s.source_kind='first_party_web'
    AND s.publication_status='not_published'
    AND s.source_url ~ '^https://'
    AND NOT EXISTS(
      SELECT 1 FROM private.net_ro1_domain_verification_evidence e
      WHERE e.seed_id=s.id
    )
    AND NOT EXISTS(
      SELECT 1 FROM public.network_companies c
      WHERE c.country_code='RO'
        AND c.publication_status='published'
        AND c.website_domain=s.canonical_domain
    )
    AND NOT EXISTS(
      SELECT 1 FROM public.network_netfast3_suppressed_domains d
      WHERE d.domain=s.canonical_domain
    )
  ORDER BY
    CASE s.proposed_role
      WHEN 'producer' THEN 0
      WHEN 'processor_service_provider' THEN 1
      WHEN 'trader_distributor' THEN 2
      WHEN 'end_user' THEN 3
      ELSE 4
    END,
    s.first_seen_at,
    s.canonical_domain
  LIMIT greatest(1,least(coalesce(p_max,15),50));
$fn$;

-- RO-AUTO2.A: preview-first, serialised, idempotent publisher.
-- A preview records a checksum on ONLY fully gated records; it never
-- creates a public profile. Commit requires an unchanged preview within 48h.
CREATE OR REPLACE FUNCTION private.net_ro1_auto2_publish_verified(
  p_max integer DEFAULT 4,
  p_commit boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
DECLARE
  v_limit integer := greatest(1,least(coalesce(p_max,4),25));
  v_ready integer := 0;
  v_inserted integer := 0;
  v_previewed integer := 0;
  v_row record;
  v_company_id uuid;
  v_role_id uuid;
  v_assertion_id uuid;
  v_fingerprint text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('NET-RO1-AUTO2-VERIFIED-PUBLISHER')
  );
  IF coalesce(p_commit,false) THEN
    LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE;
  END IF;

  FOR v_row IN
    SELECT s.id AS seed_id,s.research_id,s.canonical_domain,s.proposed_role,
           s.source_url,e.official_url,e.verified_legal_name,
           e.public_activity_summary,e.rights_basis,
           e.publisher_dry_run_passed,e.publisher_preview_at,
           e.publisher_preview_fingerprint
    FROM private.network_web_research_seeds s
    JOIN private.net_ro1_domain_verification_evidence e ON e.seed_id=s.id
    WHERE s.country_code='RO'
      AND s.source_kind='first_party_web'
      AND s.publication_status='not_published'
      AND s.claim_status='unclaimed'
      AND s.verification_status='web_sourced_unverified'
      AND s.source_url ~ '^https://'
      AND e.official_url ~ '^https://'
      AND e.verdict='evidence_supported_pending_gates'
      AND e.provenance_checked
      AND e.rights_checked
      AND e.permissions_checked
      AND e.identity_checked
      AND e.role_checked
      AND e.romania_checked
      AND NOT e.published
      AND e.verified_legal_name IS NOT NULL
      AND e.public_activity_summary IS NOT NULL
      AND e.rights_basis IS NOT NULL
      AND char_length(btrim(e.verified_legal_name)) BETWEEN 3 AND 255
      AND char_length(btrim(e.public_activity_summary)) BETWEEN 30 AND 350
      AND char_length(btrim(e.rights_basis)) BETWEEN 30 AND 1000
      AND e.verified_legal_name !~ '[<>@]'
      AND e.public_activity_summary !~ '[<>@]'
      AND s.proposed_role IN ('producer','processor_service_provider',
                              'trader_distributor','end_user')
      AND NOT EXISTS(
        SELECT 1 FROM public.network_netfast3_suppressed_domains x
        WHERE x.domain=s.canonical_domain
      )
      AND NOT EXISTS(
        SELECT 1 FROM private.network_ro14c_publication_links l
        WHERE l.seed_id=s.id OR l.research_id=s.research_id
      )
      AND NOT EXISTS(
        SELECT 1 FROM public.network_companies c
        WHERE c.country_code='RO' AND c.archived_at IS NULL
          AND (
            c.website_domain=s.canonical_domain OR
            pg_catalog.regexp_replace(pg_catalog.lower(c.legal_name),
                   '[^[:alnum:]]','','g')=
            pg_catalog.regexp_replace(pg_catalog.lower(e.verified_legal_name),
                   '[^[:alnum:]]','','g')
          )
      )
      AND NOT EXISTS(
        SELECT 1 FROM private.network_web_research_seeds other
        WHERE other.country_code='RO' AND other.id<>s.id
          AND pg_catalog.regexp_replace(pg_catalog.lower(other.display_name),
                  '[^[:alnum:]]','','g')=
              pg_catalog.regexp_replace(pg_catalog.lower(e.verified_legal_name),
                  '[^[:alnum:]]','','g')
      )
    ORDER BY CASE s.proposed_role
               WHEN 'producer' THEN 0
               WHEN 'processor_service_provider' THEN 1
               WHEN 'trader_distributor' THEN 2
               ELSE 3 END,
             s.canonical_domain
    LIMIT v_limit
  LOOP
    v_ready:=v_ready+1;
    v_fingerprint := pg_catalog.md5(pg_catalog.concat_ws('|',
      v_row.canonical_domain,v_row.verified_legal_name,
      v_row.proposed_role,v_row.official_url,
      v_row.public_activity_summary,v_row.rights_basis));

    SELECT id INTO v_role_id FROM public.network_company_roles
    WHERE canonical_key=v_row.proposed_role AND status='active';
    IF v_role_id IS NULL THEN
      RAISE EXCEPTION 'NET-RO1-AUTO2: active role missing (%)',
        v_row.proposed_role;
    END IF;

    IF NOT coalesce(p_commit,false) THEN
      UPDATE private.net_ro1_domain_verification_evidence
      SET publisher_dry_run_passed=true,
          publisher_preview_at=now(),
          publisher_preview_fingerprint=v_fingerprint
      WHERE seed_id=v_row.seed_id;
      v_previewed:=v_previewed+1;
      CONTINUE;
    END IF;

    IF NOT v_row.publisher_dry_run_passed
       OR v_row.publisher_preview_at IS NULL
       OR v_row.publisher_preview_at < now()-interval '48 hours'
       OR v_row.publisher_preview_fingerprint IS DISTINCT FROM v_fingerprint
    THEN
      RAISE EXCEPTION 'NET-RO1-AUTO2: stale or absent preview for %',
        v_row.canonical_domain;
    END IF;

    INSERT INTO public.network_companies(
      legal_name,country_code,website_url,website_domain,description,
      publication_status,claimed_status,verification_status
    ) VALUES (
      v_row.verified_legal_name,'RO',
      'https://'||v_row.canonical_domain,v_row.canonical_domain,
      v_row.public_activity_summary,'published','unclaimed','unverified'
    ) RETURNING id INTO v_company_id;

    INSERT INTO public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,
      source_type,source_reference,ownership_type,
      asserted_by,confidence,review_state
    ) VALUES (
      'company',v_company_id,'net_ro1_auto2_web_profile',
      pg_catalog.jsonb_build_object(
        'research_id',v_row.research_id,
        'role_key',v_row.proposed_role,
        'official_url',v_row.official_url,
        'rights_basis_reviewed',true,
        'company_claimed',false,
        'company_verified',false,
        'technical_capabilities_verified',false
      ),
      'public_web',v_row.official_url,'platform_curated',
      NULL,0.70,'accepted'
    ) RETURNING id INTO v_assertion_id;

    INSERT INTO public.network_company_role_assignments(
      company_id,role_id,is_primary,source_assertion_id
    ) VALUES (v_company_id,v_role_id,true,v_assertion_id);

    INSERT INTO private.network_ro14c_publication_links(
      research_id,seed_id,company_id,published_source_url,publication_wave
    ) VALUES (
      v_row.research_id,v_row.seed_id,v_company_id,
      v_row.official_url,'NET-RO1-AUTO2'
    );

    UPDATE private.net_ro1_domain_verification_evidence
    SET published=true
    WHERE seed_id=v_row.seed_id;
    v_inserted:=v_inserted+1;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object(
    'wave','NET-RO1-AUTO2',
    'mode', CASE WHEN coalesce(p_commit,false) THEN 'commit' ELSE 'preview' END,
    'eligible',v_ready,
    'previewed',v_previewed,
    'created_now',v_inserted,
    'requires_all_gates',true
  );
END;
$fn$;

REVOKE ALL ON FUNCTION private.net_ro1_auto2_unchecked_queue(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.net_ro1_auto2_unchecked_queue(integer)
  TO service_role;
REVOKE ALL ON FUNCTION private.net_ro1_auto2_publish_verified(integer,boolean)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.net_ro1_auto2_publish_verified(integer,boolean)
  TO service_role;

COMMENT ON FUNCTION private.net_ro1_auto2_publish_verified(integer,boolean)
  IS 'Service-only RO preview-first publisher. Publish only after documented rights, permission, identity, role, Romania, provenance and current deduplication gates.';
