-- NET-DATA1-EU TRADER1B · tiny first-party research pilot (5/20 target).
-- Internal review only, no permission to scrape or redistribute source content.
-- Brand labels are not verified corporate legal entities. EU country is research
-- MARKET focus, NOT legal domicile or a published facility country.
BEGIN;
INSERT INTO private.netdata1eu_trader_research (
 research_batch,display_name,target_country_code,domain,official_website,
 role_evidence_url,product_evidence_url,product_evidence_summary,
 source_rights,research_state,role_assertion
)
SELECT 'netdata1eu-trader1b-firstparty-20261020',
       src.name,src.country,src.domain,src.site,src.role_source,
       src.product_source,src.summary,'not_assessed','research_only','source_observed'
FROM (VALUES
  ('BUHLMANN Group','DE','buhlmann-group.com','https://buhlmann-group.com/en/who-we-are/','https://buhlmann-group.com/en/who-we-are/','https://buhlmann-group.com/en/who-we-are/','Official corporate site describes stockholding and trading of steel pipes and fittings.'),
  ('MCB','NL','mcb.eu','https://www.mcb.eu/en/steel-construction','https://www.mcb.eu/en/steel-construction','https://www.mcb.eu/en/steel-construction','Official distributor documents hot-formed hollow sections EN 10210 and cold-formed EN 10219.'),
  ('ArcelorMittal Distribution Solutions France','FR','distribution.arcelormittal.com','https://distribution.arcelormittal.com/fr-FR/services/specialiste-du-tube','https://distribution.arcelormittal.com/fr-FR/services/specialiste-du-tube','https://distribution.arcelormittal.com/fr-FR/services/specialiste-du-tube','Official distribution page documents tube cutting, round square rectangular sections and grades.'),
  ('Wuppermann Stahl GmbH','DE','wuppermann.com','https://www.wuppermann.com/en/locations/wuppermann-stahl-gmbh/','https://www.wuppermann.com/en/locations/wuppermann-stahl-gmbh/','https://www.wuppermann.com/en/locations/wuppermann-stahl-gmbh/','Official sales company page states distribution and purchasing of flat steel, tubes and profiles.'),
  ('Kovintrade d.d. Celje','SI','kovintrade.com','https://kovintrade.com/en/sales-program','https://kovintrade.com/en/sales-program','https://kovintrade.com/en/sales-program/metallurgy/tubes','Official metallurgy sales program and tube assortment for welded and seamless pipes.')
) AS src(name,country,domain,site,role_source,product_source,summary)
ON CONFLICT DO NOTHING;

-- These are first-party documented locations. No NUTS assignment nor
-- public facility mutation; BUHLMANN's site explicitly says incl. warehouse.
INSERT INTO private.netdata1eu_trader_facility_evidence(
 trader_research_id,country_code,city,facility_type,evidence_url
)
SELECT r.id,f.country,f.city,f.facility_type,f.source
FROM (VALUES
 ('buhlmann-group.com','DE','Bremen','warehouse','https://buhlmann-group.com/en/contact/'),
 ('buhlmann-group.com','DE','Duisburg','warehouse','https://buhlmann-group.com/en/contact/'),
 ('wuppermann.com','DE','Leverkusen','office','https://www.wuppermann.com/en/locations/wuppermann-stahl-gmbh/'),
 ('kovintrade.com','SI','Celje','facility_unspecified','https://kovintrade.com/en/sales-program')
) AS f(domain,country,city,facility_type,source)
JOIN private.netdata1eu_trader_research r ON r.domain=f.domain
 AND r.research_batch='netdata1eu-trader1b-firstparty-20261020'
ON CONFLICT DO NOTHING;
COMMIT;
