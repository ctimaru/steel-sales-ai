-- NET-DATA1-EU TRADER1B.2 — complete the 20-research-item desk-research pilot.
-- Exactly 15 source-referenced additional cases. NO LICENSE CLEARANCE asserted.
-- Existing five-record migration `20261020160500` must execute first.
-- All entries are private research-only / explicit identity-hold, NOT public Network.
BEGIN;
INSERT INTO private.netdata1eu_trader_research(
 research_batch,display_name,target_country_code,domain,official_website,
 role_evidence_url,product_evidence_url,product_evidence_summary,
 research_state,source_rights,role_assertion,review_note
)
SELECT 'netdata1eu-trader1b-firstparty-20261020',
 q.name,q.market,q.domain,q.website,q.role_url,q.product_url,q.summary,
 q.state,'not_assessed','source_observed',q.note
FROM (VALUES
 ('Hoberg & Driesch','DE','hoberg-driesch.com','https://www.hoberg-driesch.com/en/','https://www.hoberg-driesch.com/en/','https://www.hoberg-driesch.com/en/products-solutions/','Official tube wholesaler offering seamless and welded steel tubes and structural hollow sections.','research_only','Group identity: Pouchard Tubes et Barres is an explicitly listed subsidiary; keep both separate until legal-entity review.'),
 ('CARL SPAETER','DE','spaeter.de','https://www.spaeter.de/produkte','https://www.spaeter.de/produkte','https://www.spaeter.de/standorte/spaeter-oberhausen/produkte/rohre','Official steel stockholder assortment includes seamless and welded tubes and cold-/hot-formed hollow sections.','research_only','Group/location-level product assortment; exact legal subsidiary must be established separately.'),
 ('thyssenkrupp Schulte','DE','thyssenkrupp-schulte.de','https://www.thyssenkrupp-schulte.de/de','https://www.thyssenkrupp-schulte.de/de','https://www.thyssenkrupp-schulte.de/de/produkte/stahl/stahl-rohre','German metals distributor lists welded, seamless and precision steel tubes plus structural hollow sections.','research_only','Corporate brand may change; verify current legal sales entity and relation to thyssenkrupp Materials.'),
 ('KDI','FR','kdi.fr','https://kdi.fr/nos-produits/','https://kdi.fr/nos-produits/','https://kdi.fr/nos-produits/tubes_canalisation/','Official assortment includes steel welded and seamless line pipe, structural tubes and pipe fittings.','research_only','Corporate entity and individual French depots need separate legal and location verification.'),
 ('Pouchard Tubes et Barres','FR','pouchard.fr','https://www.pouchard.fr/','https://www.pouchard.fr/entreprise/notre-societe/','https://www.pouchard.fr/entreprise/nos-engagements/','French specialist trading steel tubes and bars from stock; source describes warehouse in Mitry-Mory.','research_only','Subsidiary of Hoberg & Driesch; review parent/child entity linkage before any promotion.'),
 ('SOPROMET','FR','sopromet.fr','https://www.sopromet.fr/','https://www.sopromet.fr/','https://www.sopromet.fr/','Official tube trading business lists welded and seamless steel/stainless tube and fittings.','research_only','Commercial identity and rights not yet reviewed; no operational locations inferred.'),
 ('Royal Van Leeuwen','NL','vanleeuwen.com','https://www.vanleeuwen.com/','https://www.vanleeuwen.com/','https://www.vanleeuwen.com/','Official multinational steel-pipe distribution group with multiple separately named legal entities.','identity_hold','IDENTITY HOLD: existing Italian discovered + lead Van Leeuwen Italia S.p.A. already use vanleeuwen.com; no automatic merge.'),
 ('Solines B.V.','NL','solines.nl','https://www.solines.nl/','https://www.solines.nl/stalen-buizen-kopen/','https://www.solines.nl/koker-profielen/','Stockholding steel tube and hollow-section supplier, including tubes from Moerdijk and Dortmund.','research_only','Official group locations are research observations, not confirmed Network facilities.'),
 ('BOWIM','PL','bowim.pl','https://www.bowim.pl/','https://www.bowim.pl/profile-stalowe/','https://www.bowim.pl/profile-stalowe/','Steel offer includes hollow steel sections EN 10210 and EN 10219 in S235JRH and S355J2H.','research_only','Mixed distributor/manufacturer evidence including own production: review roles independently.'),
 ('Konsorcjum Stali','PL','konsorcjumstali.pl','https://www.konsorcjumstali.pl/kategorie/rury','https://www.konsorcjumstali.pl/kategorie/rury','https://www.konsorcjumstali.pl/kategorie/rury','Official distributor and processor offers black/galvanized welded and seamless steel tubes.','research_only','Company-level distribution confirmed from own catalog; no inferred regional NUTS.'),
 ('Hierros Mora Antón','ES','hierrosmoraanton.com','https://hierrosmoraanton.com/','https://hierrosmoraanton.com/hierros-mora-anton-tu-aliado-en-siderurgia-y-construccion/','https://hierrosmoraanton.com/productos/productos-largos/tubos-estructurales/','Spanish distributor markets round, square and rectangular structural tubes from multiple depots.','research_only','Business label within Grupo Mora; legal entity and individual depot ownership pending review.'),
 ('Tubos Paris','ES','tubosparis.es','https://tubosparis.es/empresa/','https://tubosparis.es/empresa/','https://tubosparis.es/empresa/','Spanish iron and steel warehouse distributor lists structural, galvanized, precision and line tubes.','research_only','Website and business label documented; legal entity and stock addresses not yet reconciled.'),
 ('EHG Stahlzentrum','AT','ehg-stahl.com','https://www.ehg-stahl.com/de','https://www.ehg-stahl.com/de','https://www.ehg-stahl.com/de','Austrian stocked steel and metal distributor offers tubular profiles and round tubes with processing.','research_only','Source explicitly names EHG Stahlzentrum GmbH & CO OG at Dornbirn; license/reuse still not assessed.'),
 ('Metalunion','BE','metalunion.be','https://metalunion.be/','https://metalunion.be/staalproducten/','https://metalunion.be/staalproducten/buisprofielen/','Belgian steel stockholder supplies EN 10219 S235JRH welded square, rectangular and round tubes.','research_only','Official product page describes cutting and coatings; verify legal identity independently.'),
 ('Claessens-Wettstein','BE','claessens-wettstein.be','https://www.claessens-wettstein.be/home-fr','https://www.claessens-wettstein.be/home-fr','https://www.claessens-wettstein.be/home-fr','Belgian steel wholesaler lists round, square, rectangular and welded steel tubes in stock.','research_only','Official page names s.a. Claessens-Wettstein & Fils, a wholesale business in Visé; legal identity not yet approved.')
) AS q(name,market,domain,website,role_url,product_url,summary,state,note)
ON CONFLICT DO NOTHING;

-- Precise, first-party-observed locations. This migration does not claim
-- NUTS regions, verified legal owner, company verification or published stock.
-- Office / warehouse claims below must be checked again at human approval.
INSERT INTO private.netdata1eu_trader_facility_evidence(
 trader_research_id,country_code,city,facility_type,evidence_url
)
SELECT r.id,f.country,f.city,f.type,f.url
FROM (VALUES
 ('pouchard.fr','FR','Mitry-Mory','warehouse','https://www.pouchard.fr/entreprise/notre-societe/'),
 ('kdi.fr','FR','Aubervilliers','warehouse','https://kdi.fr/qui-sommes-nous/nos-agences/kdi-aubervilliers/'),
 ('solines.nl','NL','Moerdijk','warehouse','https://www.solines.nl/stalen-buizen-kopen/'),
 ('konsorcjumstali.pl','PL','Kraków','facility_unspecified','https://www.konsorcjumstali.pl/oddzialy/krakow'),
 ('metalunion.be','BE','Brugge','office','https://metalunion.be/'),
 ('ehg-stahl.com','AT','Dornbirn','office','https://www.ehg-stahl.com/de')
) AS f(domain,country,city,type,url)
JOIN private.netdata1eu_trader_research r ON r.domain=f.domain
 AND r.research_batch='netdata1eu-trader1b-firstparty-20261020'
ON CONFLICT DO NOTHING;
COMMIT;
