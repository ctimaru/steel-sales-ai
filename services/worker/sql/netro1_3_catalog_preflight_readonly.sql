-- NET-RO1.3 independent catalog preflight, SELECT ONLY, no writes and no import.
-- This file is safe to re-run as a snapshot. NEVER treat a zero match as proof
-- of legal company uniqueness, current source license, ONRC status or opt-out clearance.
-- Data source: the versioned 50-site qualification ledger; update values after any cohort changes.
-- It does not call netgrowth3d_stage_industrial or any RPC.
WITH research(candidate_id,domain,candidate_name,proposed_role) AS (
  VALUES
    ('NET-RO1-001', 'iasi.metinvestholding.com', 'METINVEST TUBULAR IAȘI S.A.', 'producer'),
    ('NET-RO1-002', 'artrom.com', 'ARTROM STEEL TUBES S.A.', 'producer'),
    ('NET-RO1-003', 'tenaris.com', 'SILCOTUB S.A. (TenarisSilcotub)', 'producer'),
    ('NET-RO1-004', 'hatboru.ro', 'Hatboru Romania', 'producer'),
    ('NET-RO1-005', 'vanleeuwen.com', 'Van Leeuwen Romania S.R.L.', 'trader_distributor'),
    ('NET-RO1-006', 'tevi-romania.ro', 'SC Tevi Romania SRL', 'trader_distributor'),
    ('NET-RO1-007', 'steel-tubes.ro', 'S.C. STEEL TUBES S.R.L.', 'trader_distributor'),
    ('NET-RO1-008', 'greenstal.ro', 'Green Stal', 'trader_distributor'),
    ('NET-RO1-009', 'zsofia.ro', 'Zsofia SRL', 'processor_service_provider'),
    ('NET-RO1-010', 'laser-rmc.ro', 'SC RISK MANAGEMENT COMPANY SRL (R.M.C. Debitare Laser)', 'processor_service_provider'),
    ('NET-RO1-011', 'lio-metal.ro', 'LIO-METAL', 'producer'),
    ('NET-RO1-012', 'kovostroj.ro', 'Kovostroj SRL', 'producer'),
    ('NET-RO1-013', 'avirob.eu', 'AVIROB', 'processor_service_provider'),
    ('NET-RO1-014', 'miras.ro', 'MIRAS STEEL TRADE S.R.L.', 'trader_distributor'),
    ('NET-RO1-015', 'otelstructuri.ro', 'OtelStructuri', 'trader_distributor'),
    ('NET-RO1-016', 'baurom.ro', 'Baurom', 'trader_distributor'),
    ('NET-RO1-017', 'alconind.ro', 'Alcon Ind', 'trader_distributor'),
    ('NET-RO1-018', 'konigfrankstahl.ro', 'KönigFrankStahl Romania', 'trader_distributor'),
    ('NET-RO1-019', 'metalcas.ro', 'Metalcas Grup', 'trader_distributor'),
    ('NET-RO1-020', 'produse-metalurgice.ro', 'Metalurgic 21 Plan SRL', 'trader_distributor'),
    ('NET-RO1-021', 'qcb.ro', 'Quick Comarf Business (QCB)', 'trader_distributor'),
    ('NET-RO1-022', 'intacteco.ro', 'Intact Eco', 'trader_distributor'),
    ('NET-RO1-023', 'meta-cos.ro', 'Meta Cos', 'trader_distributor'),
    ('NET-RO1-024', 'laserprocessing.ro', 'Laser Processing Romania', 'processor_service_provider'),
    ('NET-RO1-025', 'comelf.ro', 'Comelf S.A.', 'processor_service_provider'),
    ('NET-RO1-026', 'mairon-tubes.ro', 'MAIRON TUBES S.R.L.', 'producer'),
    ('NET-RO1-027', 'comtechco.ro', 'COMTECH CO S.R.L.', 'producer'),
    ('NET-RO1-028', 'isoplus.group', 'ISOPLUS ROMANIA S.R.L.', 'producer'),
    ('NET-RO1-029', 'rematbv.ro', 'REMAT BRAȘOV S.A.', 'trader_distributor'),
    ('NET-RO1-030', 'stift.ro', 'STIFT LUX DESIGN S.R.L.', 'trader_distributor'),
    ('NET-RO1-031', 'net-invest.ro', 'NETINVEST S.R.L.', 'trader_distributor'),
    ('NET-RO1-032', 'thyssenkrupp-materials.ro', 'thyssenkrupp Materials Romania S.R.L.', 'trader_distributor'),
    ('NET-RO1-033', 'groupmetal.ro', 'GROUP METAL TRADING S.R.L.', 'trader_distributor'),
    ('NET-RO1-034', 'sci-distribution.ro', 'SCI DISTRIBUTION', 'trader_distributor'),
    ('NET-RO1-035', 'ditaindustrial.ro', 'DITA INDUSTRIAL IMPORT-EXPORT S.A.', 'trader_distributor'),
    ('NET-RO1-036', 'retacom.ro', 'RETA COM S.R.L.', 'trader_distributor'),
    ('NET-RO1-037', 'h-metal.ro', 'H METAL S.R.L.', 'trader_distributor'),
    ('NET-RO1-038', 'eisen-metal.ro', 'EISEN METAL', 'trader_distributor'),
    ('NET-RO1-039', 'eurozonemetal.ro', 'EUROZONE METAL CONSTANȚA', 'trader_distributor'),
    ('NET-RO1-040', 'marola.ro', 'MAROLA', 'trader_distributor'),
    ('NET-RO1-041', 'trotusgrup.ro', 'TROTUȘ GRUP S.R.L.', 'trader_distributor'),
    ('NET-RO1-042', 'thebacons.ro', 'THEBA CONS S.R.L.', 'trader_distributor'),
    ('NET-RO1-043', 'metaldistrib.ro', 'METAL DISTRIB EXPERT SEMA S.R.L.', 'trader_distributor'),
    ('NET-RO1-044', 'arcotrust.ro', 'ARCO TRUST STEEL S.R.L.', 'trader_distributor'),
    ('NET-RO1-045', 'habaresearch.eu', 'HABA RESEARCH', 'processor_service_provider'),
    ('NET-RO1-046', 'nedtrix.ro', 'NEDTRIX', 'processor_service_provider'),
    ('NET-RO1-047', 'armetal-tech.ro', 'AR METAL TECHNOLOGY', 'processor_service_provider'),
    ('NET-RO1-048', 'technicsteel.ro', 'TECHNIC STEEL CONCEPT', 'processor_service_provider'),
    ('NET-RO1-049', 'arcgrup.ro', 'ARC GRUP S.R.L.', 'processor_service_provider'),
    ('NET-RO1-050', 'centrudebitarelaser.ro', 'QSELF TECHNOLOGY', 'processor_service_provider')
), known AS (
  SELECT 'network_companies' AS source, website_domain AS domain,
         legal_name AS name, country_code AS country FROM public.network_companies
  UNION ALL
  SELECT 'core_target_leads', canonical_domain, company_name, NULL FROM public.network_core_target_leads
  UNION ALL
  SELECT 'netfast_discovered', domain, company_name, NULL FROM private.netfast_discovered_records
  UNION ALL
  SELECT 'netfast2_structured', domain, company_name, country_code FROM public.network_netfast2_structured_entities
  UNION ALL
  SELECT 'discovery_candidates', canonical_domain,
         coalesce(legal_name,trading_name), country_code
  FROM public.network_company_discovery_candidates
  UNION ALL
  SELECT 'discovery_domain_leads', domain, domain, NULL FROM public.network_discovery_domain_leads
), normalized AS (
  SELECT r.*,lower(regexp_replace(r.domain,'^www[.]','')) AS norm_domain,
     regexp_replace(lower(r.candidate_name),'[^[:alnum:]]','','g') AS norm_name
  FROM research r
), matches AS (
  SELECT r.candidate_id,
      count(*) FILTER (WHERE regexp_replace(lower(coalesce(k.domain,'')),'^www[.]','') = r.norm_domain) AS exact_domain_matches,
      count(*) FILTER (WHERE regexp_replace(lower(coalesce(k.name,'')),'[^[:alnum:]]','','g') = r.norm_name) AS exact_name_matches,
      string_agg(DISTINCT k.source || ':' || coalesce(k.country,'?'), ', ') AS matched_catalogs
  FROM normalized r
  LEFT JOIN known k
   ON (regexp_replace(lower(coalesce(k.domain,'')),'^www[.]','') = r.norm_domain
       OR regexp_replace(lower(coalesce(k.name,'')),'[^[:alnum:]]','','g') = r.norm_name)
  GROUP BY r.candidate_id
), governance AS (
  SELECT r.candidate_id,
    EXISTS (
      SELECT 1 FROM public.network_netfast3_suppressed_domains s
      WHERE regexp_replace(lower(s.domain),'^www[.]','') = r.norm_domain
    ) AS explicit_suppression,
    EXISTS (
      SELECT 1 FROM private.net_pipeline1b2l_source_rights sr
      WHERE regexp_replace(lower(sr.domain),'^www[.]','') = r.norm_domain
    ) AS any_historic_source_rights_record,
    EXISTS (
      SELECT 1 FROM public.company_data_governance_requests gr
      WHERE gr.country_code = 'RO'
        AND regexp_replace(lower(coalesce(gr.company_name,'')),'[^[:alnum:]]','','g') = r.norm_name
    ) AS related_company_objection
  FROM normalized r
)
SELECT r.candidate_id,r.domain,r.proposed_role,m.exact_domain_matches,
       m.exact_name_matches,coalesce(m.matched_catalogs,'') AS matched_catalogs,
       g.explicit_suppression,g.any_historic_source_rights_record,
       g.related_company_objection,
       FALSE AS registry_identity_approved,
       FALSE AS legal_source_rights_approved,
       FALSE AS import_authorized
FROM research r
JOIN matches m USING(candidate_id)
JOIN governance g USING(candidate_id)
ORDER BY r.candidate_id;
