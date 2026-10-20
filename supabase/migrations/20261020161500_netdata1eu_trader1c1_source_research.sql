-- NETDATA1-EU TRADER1C.1: 15 first-party research candidates, no public publication.
-- Run only AFTER the three approved TRADER1A/B migrations in Issue #771.
-- Target market != verified legal domicile. Source URLs != reuse rights.
BEGIN;
INSERT INTO private.netdata1eu_trader_research(
 research_batch,display_name,target_country_code,domain,official_website,
 role_evidence_url,product_evidence_url,product_evidence_summary,
 research_state,source_rights,role_assertion,review_note)
SELECT 'netdata1eu-trader1c1-firstparty-20261020',q.name,q.market,q.domain,q.site,
 q.role_source,q.product_source,q.summary,q.state,'not_assessed','source_observed',q.note
FROM (VALUES
('Ferona a.s.','CZ','ferona.cz','https://www.ferona.cz/ferona-a.s','https://www.ferona.cz/ferona-a.s','https://online.ferona.cz/','Wholesale steel with tubes and hollow sections, warehouses and processing.','research_only','Czech official company identity source; license pending'),
('Weyland','AT','weyland.at','https://www.weyland.at/produkte/stahl/rohre/','https://www.weyland.at/produkte/stahl/rohre/','https://www.weyland.at/produkte/stahl/rohre/','Stocked EN10219 cold-formed and EN10210 hot-formed structural hollow profiles.','research_only','Trading label: confirm legal entity'),
('BE Group','SE','begroup.com','https://www.begroup.com/about-be-group','https://www.begroup.com/about-be-group','https://www.begroup.com/about-be-group/products-and-services','Steel stockholder with structural tubes, sections and processing in Nordic countries.','research_only','GROUP HOLD: Swedish and Finnish subsidiaries share site'),
('STALPROFIL S.A.','PL','stalprofil.com.pl','https://www.stalprofil.com.pl/dystrybucja','https://www.stalprofil.com.pl/dystrybucja','https://www.stalprofil.com.pl/dystrybucja','Distributor with stocked metallurgical products, steel depots and service processing.','research_only','Tube-specific assortment remains to be checked'),
('rff Rohr Flansch Fitting','DE','rff.de','https://www.rff.de/de/','https://www.rff.de/de/','https://www.rff.de/de/unternehmen/','German pipe, flange and fitting distributor with logistics centers.','research_only','Pressure-pipe specialist, do not infer structural hollow sections'),
('Klöckner & Co','DE','kloeckner.com','https://www.kloeckner.com/en/','https://www.kloeckner.com/en/','https://www.kloeckner.com/en/','Steel and metals distributor with warehouse and digital sales channels.','identity_hold','GROUP HOLD: confirm local company and tube-specific assortment'),
('Lemvigh-Müller','DK','lemu.dk','https://www.lemu.dk/da/om-lemvigh-mueller/om-os','https://www.lemu.dk/da/om-lemvigh-mueller/om-os','https://www.lemu.dk/da/viden-inspiration/udvalgt-sortiment/staal-og-metal','Danish metal wholesaler offering steel pipes, profiles and stainless fittings.','research_only','Technical wholesaler; product evidence is company-wide'),
('Damstahl a/s','DK','damstahl.com','https://www.damstahl.com/en/','https://www.damstahl.com/en/','https://www.damstahl.com/en/shop/stainless-steel-66370/tubes-82979/','Stainless tube, fitting and bar stockholder active across Europe.','research_only','NEUMO group: do not merge country subsidiaries'),
('Arabesque','RO','arabesque.ro','https://arabesque.ro/','https://arabesque.ro/','https://arabesque.ro/public/servicii/portofoliu-complet','Romanian building materials distributor lists metallic tubes and steel profiles.','research_only','Broad construction distribution: check tubular specialization'),
('Heiton Steel','IE','heitonsteel.ie','https://www.heitonsteel.ie/','https://www.heitonsteel.ie/','https://www.heitonsteel.ie/product-category/tube/unpainted-square/','Irish stockholder sells square and rectangular hollow tubes S235 and S355.','research_only','Trading brand and depot ownership require identity review'),
('STAPPERT Fleischmann GmbH','AT','fleischmann.stappert.biz','https://fleischmann.stappert.biz/','https://fleischmann.stappert.biz/','https://fleischmann.stappert.biz/','Austrian stainless-steel wholesaler supplying long products and pipe fittings.','research_only','STAPPERT group: same-root-domain subsidiaries must remain distinct'),
('MAIRON Group','RO','mairon.ro','https://www.mairon.ro/','https://www.mairon.ro/','https://www.mairon.ro/wp-content/uploads/2024/09/CatalogMaironeng2024.pdf','Romanian steel group with distribution and own welded tube manufacturing.','identity_hold','DUAL-ROLE HOLD: production versus distribution and legal entities'),
('Tibnor','SE','tibnor.se','https://www.tibnor.se/','https://www.tibnor.se/','https://www.tibnor.se/stal/stalror/konstruktionsror/c/50_r%C3%B6_kr','Nordic steel stockholder offers EN10210 S355J2H structural tubes.','research_only','SSAB group: check company entity per country'),
('Stena Stål','SE','stenastal.se','https://www.stenastal.se/vad-vi-erbjuder/stal/','https://www.stenastal.se/vad-vi-erbjuder/stal/','https://www.stenastal.se/vad-vi-erbjuder/stal/ror/','Swedish steel wholesaler with round and hollow steel sections and cutting.','research_only','Stena group relationship and facility-level capabilities under review'),
('Hierros Gil','ES','hierrosgil.com','https://hierrosgil.com/','https://hierrosgil.com/','https://hierrosgil.com/producto/tubos-din-2440/','Spanish steel merchant product listing non-alloy carbon steel pipes DIN2440.','research_only','Do not assign EN10210/EN10219 without direct evidence')
) AS q(name,market,domain,site,role_source,product_source,summary,state,note)
ON CONFLICT DO NOTHING;
-- These are privately sourced places, not public facilities or NUTS codes.
INSERT INTO private.netdata1eu_trader_facility_evidence(
 trader_research_id,country_code,city,facility_type,evidence_url)
SELECT r.id,l.country,l.city,l.kind,l.evidence
FROM (VALUES
('ferona.cz','CZ','Prague','office','https://www.ferona.cz/ferona-a.s'),
('begroup.com','SE','Malmö','office','https://www.begroup.com/contact'),
('stalprofil.com.pl','PL','Dąbrowa Górnicza','warehouse','https://www.stalprofil.com.pl/dystrybucja'),
('lemu.dk','DK','Kolding','warehouse','https://www.lemu.dk/da/kontakt/find-os/centrallagre'),
('damstahl.com','DK','Skanderborg','office','https://www.damstahl.com/en/contact/'),
('arabesque.ro','RO','Brașov','warehouse','https://arabesque.ro/public/depozite-si-magazine-arabesque'),
('heitonsteel.ie','IE','Dublin','office','https://www.heitonsteel.ie/'),
('fleischmann.stappert.biz','AT','Teesdorf','office','https://fleischmann.stappert.biz/'),
('stenastal.se','SE','Göteborg','office','https://www.stenastal.se/om-oss/kontakta-oss/')
) AS l(domain,country,city,kind,evidence)
JOIN private.netdata1eu_trader_research r ON r.domain=l.domain
 AND r.research_batch='netdata1eu-trader1c1-firstparty-20261020'
ON CONFLICT DO NOTHING;
COMMIT;
