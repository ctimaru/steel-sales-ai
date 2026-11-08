-- NET-IT-RELEASEBULK1 — PROPOSED migration, code review required before deployment.
-- Definition-only install: publisher commits are blocked by a default-OFF runtime flag.
-- Use reviewed migration + CI for deployment; no company is published by installing it.
-- One authenticated, attested commit publishes ONE pinned 1..100 cohort.
-- Source-rights evidence is an explicit operator input: not inferred from a URL.
-- FACTS1 facts-only path additionally requires the separate default-OFF
-- net_it_facts1_policy_proposed.sql and a real legal/Platform signoff.
-- No personal data, contact extraction, false buyer claims, or automatic RFQ.

-- E.4: Schema can be migrated ahead of public launch. Every publisher commit
-- remains independently disabled until a later authenticated release decision.
CREATE TABLE IF NOT EXISTS private.netit_releasebulk1_runtime (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.netit_releasebulk1_runtime ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.netit_releasebulk1_runtime FROM PUBLIC, anon, authenticated;
INSERT INTO private.netit_releasebulk1_runtime(singleton,enabled)
VALUES (true,false) ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS private.netit_releasebulk1_links (
    wave text NOT NULL,
    seed_id uuid NOT NULL UNIQUE REFERENCES private.network_web_research_seeds(id),
    research_id text NOT NULL UNIQUE,
    company_id uuid NOT NULL UNIQUE REFERENCES public.network_companies(id),
    fingerprint text NOT NULL,
    approved_by uuid NOT NULL,
    identity_evidence_url text NOT NULL,
    rights_reference_url text NOT NULL,
    rights_decision text NOT NULL,
    rights_note text NOT NULL,
    published_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (wave, seed_id)
);
ALTER TABLE private.netit_releasebulk1_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.netit_releasebulk1_links FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.netit_releasebulk1_impl(
    p_batch text,
    p_wave text,
    p_items jsonb,
    p_expected_fingerprint text DEFAULT NULL,
    p_attested boolean DEFAULT false,
    p_commit boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $body$
DECLARE
    v_actor uuid;
    v_expected integer;
    v_unique_seeds integer;
    v_unique_domains integer;
    v_unique_names integer;
    v_eligible integer;
    v_previous integer;
    v_good_previous integer;
    v_published integer := 0;
    v_hash text;
    v_role_id uuid;
    v_company_id uuid;
    v_assertion_id uuid;
    v_description text;
    v_item jsonb;
    v_publication_item record;
BEGIN
    -- Guard is required even for preview: no private cohort leakage to anon.
    PERFORM private.require_platform_permission('discovery.governance_review');
    PERFORM private.require_platform_permission('discovery.run');
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authenticated Platform operator required' USING ERRCODE='42501';
    END IF;
    -- A governance reviewer may preview, but may not publish.
    -- Enforce the separate Platform publication grant before replay, locks,
    -- or any canonical write; never rely on attestations for authorization.
    IF coalesce(p_commit,false) THEN
        PERFORM private.require_platform_permission('discovery.publish');
    END IF;
    -- Schema presence is not publication permission: migration stays safe
    -- even when legal work is deferred to pre-launch.
    IF coalesce(p_commit,false) AND NOT EXISTS (
       SELECT 1 FROM private.netit_releasebulk1_runtime rt
       WHERE rt.singleton=true AND rt.enabled=true
    ) THEN
       RAISE EXCEPTION 'Publisher installed but public release not enabled'
         USING ERRCODE='42501';
    END IF;
    IF p_batch IS NULL OR p_batch !~ '^NET-IT-[A-Za-z0-9_.:-]{4,110}$'
       OR p_wave IS NULL OR p_wave !~ '^NET-IT-[A-Za-z0-9_.:-]{4,110}$'
       OR p_batch = p_wave THEN
        RAISE EXCEPTION 'Valid, distinct batch and publication wave required'
            USING ERRCODE='22023';
    END IF;
    IF pg_catalog.jsonb_typeof(p_items) IS DISTINCT FROM 'array'
       OR pg_catalog.jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
        RAISE EXCEPTION 'Cohort must contain 1 to 100 reviewed company entries'
            USING ERRCODE='22023';
    END IF;

    -- Exactly these eight fields. The source-rights decision is operator
    -- evidence, not a value automatically created from a public homepage.
    FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_items)
    LOOP
        IF pg_catalog.jsonb_typeof(v_item) <> 'object'
           OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(v_item)) <> 8
           OR NOT (v_item ?& ARRAY[
               'seed_id','domain','role','legal_name',
               'identity_evidence_url','rights_reference_url',
               'rights_decision','rights_note'
           ]) THEN
            RAISE EXCEPTION 'Exact 8-field reviewed manifest required'
                USING ERRCODE='22023';
        END IF;
    END LOOP;

    SELECT count(*), count(DISTINCT m.seed_id), count(DISTINCT m.domain),
           count(DISTINCT pg_catalog.regexp_replace(
             lower(m.legal_name),'[^a-z0-9]','','g'
           ))
    INTO v_expected, v_unique_seeds, v_unique_domains, v_unique_names
    FROM pg_catalog.jsonb_to_recordset(p_items) AS m(
      seed_id uuid, domain text, role text, legal_name text,
      identity_evidence_url text, rights_reference_url text,
      rights_decision text, rights_note text
    );
    IF v_unique_seeds <> v_expected OR v_unique_domains <> v_expected
       OR v_unique_names <> v_expected THEN
        RAISE EXCEPTION 'Duplicate cohort identity' USING ERRCODE='22023';
    END IF;

    -- Serialize two publication waves that would touch the same table.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtext('NET-IT-RELEASEBULK1')
    );
    IF coalesce(p_commit,false) THEN
        -- Serialize against other privileged publishers, rechecking inside
        -- this transaction before changing canonical public rows.
        LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE;
        LOCK TABLE private.network_web_research_seeds IN SHARE ROW EXCLUSIVE MODE;
        LOCK TABLE private.netit_facts1_policy IN SHARE ROW EXCLUSIVE MODE;
        -- Disallow concurrent staging/suppression that could invalidate a
        -- clean preflight before the canonical insert within this transaction.
        LOCK TABLE public.network_core_target_leads IN SHARE ROW EXCLUSIVE MODE;
        LOCK TABLE public.network_company_discovery_candidates IN SHARE ROW EXCLUSIVE MODE;
        LOCK TABLE public.network_netfast3_suppressed_domains IN SHARE ROW EXCLUSIVE MODE;
        LOCK TABLE public.network_discovery_domain_leads IN SHARE ROW EXCLUSIVE MODE;
        LOCK TABLE public.network_netfast2_structured_entities IN SHARE ROW EXCLUSIVE MODE;
        LOCK TABLE public.network_netfast3_entities IN SHARE ROW EXCLUSIVE MODE;
        LOCK TABLE private.netfast_discovered_records IN SHARE ROW EXCLUSIVE MODE;
        LOCK TABLE public.network_bulk_intake_rows IN SHARE ROW EXCLUSIVE MODE;
        LOCK TABLE public.network_netfast3b_cordis_research IN SHARE ROW EXCLUSIVE MODE;
    END IF;

    SELECT count(*) INTO v_previous
    FROM private.netit_releasebulk1_links WHERE wave=p_wave;

    -- Fingerprint covers submitted reviews AND the stored seed snapshot.
    -- Repeat preview after any source, identity, role or status change.
    SELECT pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          coalesce(pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'seed_id',m.seed_id,'domain',m.domain,'role',m.role,
              'legal_name',m.legal_name,
              'identity_url',m.identity_evidence_url,
              'rights_url',m.rights_reference_url,
              'rights_decision',m.rights_decision,
              'rights_note',m.rights_note,
              -- A change/revocation of the FACTS1 policy invalidates the preview SHA.
              'facts1_policy_revision',(
                SELECT CASE WHEN m.rights_decision='factual_metadata_only_reviewed'
                   THEN p.revision::text || ':' || p.enabled::text
                   ELSE 'not_applicable' END
                FROM private.netit_facts1_policy p WHERE p.singleton=true
              ),
              'source_url',s.source_url,'source_summary',s.source_summary,
              'source_updated_at',s.updated_at,
              'source_lane',s.review_lane,
              'source_status',s.publication_status,
              'source_role',s.proposed_role
            ) ORDER BY m.domain
          )::text,'[]'),'UTF8')
        ),'hex')
    INTO v_hash
    FROM pg_catalog.jsonb_to_recordset(p_items) AS m(
      seed_id uuid, domain text, role text, legal_name text,
      identity_evidence_url text, rights_reference_url text,
      rights_decision text, rights_note text
    )
    LEFT JOIN private.network_web_research_seeds s ON s.id=m.seed_id;

    IF v_previous>0 THEN
        SELECT count(*) INTO v_good_previous
        FROM private.netit_releasebulk1_links l
        JOIN public.network_companies c ON c.id=l.company_id
        JOIN pg_catalog.jsonb_to_recordset(p_items) AS m(
          seed_id uuid, domain text, role text, legal_name text,
          identity_evidence_url text, rights_reference_url text,
          rights_decision text, rights_note text
        ) ON m.seed_id=l.seed_id AND m.domain=c.website_domain
        WHERE l.wave=p_wave
          AND l.fingerprint=p_expected_fingerprint
          AND c.country_code='IT' AND c.publication_status='published'
          AND c.archived_at IS NULL;
        -- Idempotence must only acknowledge the *identical* approved
        -- manifest and unchanged source snapshot. A caller-supplied stale
        -- digest must never be accepted as a successful replay.
        IF v_previous=v_expected AND v_good_previous=v_expected
           AND p_expected_fingerprint IS NOT NULL
           AND p_expected_fingerprint = v_hash THEN
            RETURN pg_catalog.jsonb_build_object(
              'status','already_published','wave',p_wave,
              'published_count',v_expected,'created_now',0);
        END IF;
        RAISE EXCEPTION 'Partial, inconsistent or reused wave; manual reconciliation required'
            USING ERRCODE='22023';
    END IF;

    SELECT count(*) INTO v_eligible
    FROM pg_catalog.jsonb_to_recordset(p_items) AS m(
      seed_id uuid, domain text, role text, legal_name text,
      identity_evidence_url text, rights_reference_url text,
      rights_decision text, rights_note text
    )
    JOIN private.network_web_research_seeds s
      ON s.id=m.seed_id AND s.country_code='IT'
      AND s.batch_key=p_batch AND s.canonical_domain=m.domain
      AND s.proposed_role=m.role AND s.display_name=m.legal_name
    JOIN public.network_company_roles r
      ON r.canonical_key=m.role AND r.status='active' AND r.searchable=true
    WHERE s.source_kind='first_party_web'
      AND s.review_lane='web_profile_review_pending'
      AND s.verification_status='web_sourced_unverified'
      AND s.claim_status='unclaimed'
      AND s.publication_status='not_published'
      AND s.source_url ~ '^https://'
      AND length(btrim(s.display_name)) BETWEEN 3 AND 255
      AND length(btrim(s.source_summary)) BETWEEN 30 AND 1000
      AND m.domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
      AND m.role IN ('producer','trader_distributor',
                     'processor_service_provider','end_user')
      AND m.identity_evidence_url ~ '^https://'
      AND m.rights_reference_url ~ '^https://'
      AND (
        m.rights_decision IN ('allows_limited_reuse','licensed','allows_reuse')
        OR (
          m.rights_decision='factual_metadata_only_reviewed'
          AND length(btrim(m.rights_note)) BETWEEN 80 AND 2000
          -- Restrict the facts-only path to obvious incorporated legal persons;
          -- do not treat sole-trader names or natural-person contact details as company data.
          AND m.legal_name ~* '(^|[^[:alpha:]])(s[.]?r[.]?l[.]?|s[.]?p[.]?a[.]?)([^[:alpha:]]|$)'
          AND EXISTS (
            SELECT 1 FROM private.netit_facts1_policy p
            WHERE p.singleton=true AND p.enabled=true
              AND p.approved_by IS NOT NULL AND p.approved_at IS NOT NULL
              AND p.legal_review_url=m.rights_reference_url
          )
        )
      )
      AND length(btrim(m.rights_note)) BETWEEN 30 AND 2000
      AND pg_catalog.regexp_replace(
          lower(pg_catalog.split_part(m.identity_evidence_url,'/',3)),
          '^www[.]',''
      )=m.domain
      AND pg_catalog.regexp_replace(
          lower(pg_catalog.split_part(s.source_url,'/',3)),
          '^www[.]',''
      )=m.domain
      AND NOT EXISTS (
         SELECT 1 FROM public.network_netfast3_suppressed_domains d
         WHERE d.domain=m.domain
      )
      AND NOT EXISTS (
         SELECT 1 FROM public.network_companies c
         WHERE (lower(c.website_domain)=m.domain OR
               (c.country_code='IT' AND
                pg_catalog.regexp_replace(lower(c.legal_name),
                   '[^a-z0-9]','','g')
                 = pg_catalog.regexp_replace(lower(m.legal_name),
                   '[^a-z0-9]','','g')))
      )
      AND NOT EXISTS (
         SELECT 1 FROM public.network_core_target_leads c
         WHERE c.canonical_domain=m.domain
      )
      AND NOT EXISTS (
         SELECT 1 FROM public.network_company_discovery_candidates c
         WHERE c.canonical_domain=m.domain
      )
      AND NOT EXISTS (
         SELECT 1 FROM public.network_discovery_domain_leads c
         WHERE c.domain=m.domain
      )
      AND NOT EXISTS (
         SELECT 1 FROM public.network_discovery_domain_leads c
         WHERE c.domain=m.domain
      )
      AND NOT EXISTS (
         SELECT 1 FROM public.network_netfast2_structured_entities c
         WHERE c.domain=m.domain
      )
      AND NOT EXISTS (
         SELECT 1 FROM public.network_netfast3_entities c
         WHERE c.domain=m.domain
      )
      AND NOT EXISTS (
         SELECT 1 FROM private.netfast_discovered_records c
         WHERE c.domain=m.domain
      )
      AND NOT EXISTS (
         SELECT 1 FROM public.network_bulk_intake_rows c
         WHERE c.website_domain=m.domain
      )
      AND NOT EXISTS (
         SELECT 1 FROM public.network_netfast3b_cordis_research c
         WHERE c.website_domain=m.domain
      )
      AND NOT EXISTS (
         SELECT 1 FROM private.netit_releasebulk1_links l
         WHERE l.seed_id=m.seed_id OR l.research_id=s.research_id
      )
      AND NOT EXISTS (
         SELECT 1 FROM private.network_web_research_seeds other
         WHERE other.id<>s.id AND other.country_code='IT'
           AND pg_catalog.regexp_replace(lower(other.display_name),
                   '[^a-z0-9]','','g')
             = pg_catalog.regexp_replace(lower(s.display_name),
                   '[^a-z0-9]','','g')
      );

    IF NOT coalesce(p_commit,false) THEN
        RETURN pg_catalog.jsonb_build_object(
          'status',CASE WHEN v_eligible=v_expected
                        THEN 'ready_for_attested_commit'
                        ELSE 'blocked' END,
          'country_code','IT','batch',p_batch,'wave',p_wave,
          'requested',v_expected,'eligible',v_eligible,
          'blocked',v_expected-v_eligible,'manifest_fingerprint',v_hash,
          'would_publish',CASE WHEN v_eligible=v_expected
                              THEN v_expected ELSE 0 END,
          'published_now',0,'requires_authenticated_attestation',true
        );
    END IF;

    IF v_eligible<>v_expected THEN
        RAISE EXCEPTION 'Fail-closed: % eligible of % selected; none published',
            v_eligible,v_expected USING ERRCODE='22023';
    END IF;
    IF coalesce(p_attested,false) IS DISTINCT FROM true
       OR p_expected_fingerprint IS NULL
       OR p_expected_fingerprint<>v_hash THEN
        RAISE EXCEPTION 'Authentic attestation and unchanged preview fingerprint required'
            USING ERRCODE='42501';
    END IF;

    FOR v_publication_item IN
      SELECT m.*,s.research_id,s.id AS source_seed_id,s.source_url
      FROM pg_catalog.jsonb_to_recordset(p_items) AS m(
        seed_id uuid, domain text, role text, legal_name text,
        identity_evidence_url text, rights_reference_url text,
        rights_decision text, rights_note text
      )
      JOIN private.network_web_research_seeds s ON s.id=m.seed_id
      ORDER BY m.domain
    LOOP
        -- The transaction holds the canonical write lock; no partial publish.
        SELECT id INTO STRICT v_role_id
        FROM public.network_company_roles
        WHERE canonical_key=v_publication_item.role AND status='active' AND searchable=true;

        v_description := CASE v_publication_item.role
          WHEN 'producer' THEN
            'Azienda della produzione industriale individuata da fonte aziendale. Gamma e qualifiche da confermare.'
          WHEN 'trader_distributor' THEN
            'Azienda commerciale industriale individuata da fonte aziendale. Disponibilità e gamma da confermare.'
          WHEN 'processor_service_provider' THEN
            'Azienda di lavorazioni industriali individuata da fonte aziendale. Servizi e capacità da confermare.'
          ELSE
            'Azienda utilizzatrice industriale individuata da fonte aziendale. Materiali e approvvigionamenti da confermare.'
        END;

        INSERT INTO public.network_companies(
          legal_name,country_code,website_url,website_domain,description,
          publication_status,claimed_status,verification_status
        ) VALUES (
          v_publication_item.legal_name,'IT','https://'||v_publication_item.domain,v_publication_item.domain,v_description,
          'published','unclaimed','unverified'
        ) RETURNING id INTO v_company_id;

        INSERT INTO public.network_data_assertions(
          entity_type,entity_id,field_path,asserted_value,
          source_type,source_reference,ownership_type,asserted_by,
          confidence,review_state
        ) VALUES (
          'company',v_company_id,'netit_releasebulk1_company_profile',
          pg_catalog.jsonb_build_object(
            'research_id',v_publication_item.research_id,'source_url',v_publication_item.source_url,
            'identity_evidence_url',v_publication_item.identity_evidence_url,
            -- Keep legal review URL and reviewer note in the PRIVATE ledger only;
            -- public assertions must not expose internal legal-memo material.
            'rights_decision',v_publication_item.rights_decision,
            'role_key_proposed',v_publication_item.role,
            'role_confirmed_by_company',false,
            'company_verified',false,
            'buyer_confirmed',false,
            'tube_procurement_confirmed',false
          ),'public_web',v_publication_item.source_url,'platform_curated',v_actor,
          0.50,'accepted'
        ) RETURNING id INTO v_assertion_id;

        INSERT INTO public.network_company_role_assignments(
          company_id,role_id,is_primary,source_assertion_id
        ) VALUES (v_company_id,v_role_id,true,v_assertion_id);

        INSERT INTO private.netit_releasebulk1_links(
          wave,seed_id,research_id,company_id,fingerprint,
          approved_by,identity_evidence_url,rights_reference_url,
          rights_decision,rights_note
        ) VALUES (
          p_wave,v_publication_item.source_seed_id,v_publication_item.research_id,v_company_id,v_hash,
          v_actor,v_publication_item.identity_evidence_url,v_publication_item.rights_reference_url,
          v_publication_item.rights_decision,v_publication_item.rights_note
        );
        v_published := v_published+1;
    END LOOP;

    IF v_published<>v_expected THEN
        RAISE EXCEPTION 'Atomic count mismatch %/%',v_published,v_expected;
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'status','published','wave',p_wave,'published_count',v_published,
      'created_now',v_published,'verified_companies',0,'claimed_companies',0,
      'fingerprint',v_hash
    );
END;
$body$;

REVOKE ALL ON FUNCTION private.netit_releasebulk1_impl(
    text,text,jsonb,text,boolean,boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.netit_releasebulk1_impl(
    text,text,jsonb,text,boolean,boolean
) TO authenticated;

CREATE OR REPLACE FUNCTION public.netit_releasebulk1(
    p_batch text,p_wave text,p_items jsonb,
    p_expected_fingerprint text DEFAULT NULL,
    p_attested boolean DEFAULT false,p_commit boolean DEFAULT false
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER
SET search_path TO ''
AS $fn$
    SELECT private.netit_releasebulk1_impl(
      p_batch,p_wave,p_items,p_expected_fingerprint,p_attested,p_commit
    );
$fn$;

REVOKE ALL ON FUNCTION public.netit_releasebulk1(
    text,text,jsonb,text,boolean,boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.netit_releasebulk1(
    text,text,jsonb,text,boolean,boolean
) TO authenticated;
