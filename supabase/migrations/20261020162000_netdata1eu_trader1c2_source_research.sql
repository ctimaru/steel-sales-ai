-- NETDATA1-EU TRADER1C.2 — complete the 60 research-only EU trader dossier target.
-- Requires authorized private schema migrations TRADER1A, B, B.2, C.1 in order.
-- Research markets are NOT verified legal countries; first-party links DO NOT
-- grant mass redistribution/publication rights. No public company mutations.
BEGIN;
INSERT INTO private.netdata1eu_trader_research(
 research_batch,display_name,target_country_code,domain,official_website,
 role_evidence_url,product_evidence_url,product_evidence_summary,
 research_state,source_rights,role_assertion,review_note
)
SELECT 'netdata1eu-trader1c2-firstparty-20261020',x.name,x.country,x.domain,x.website,
 x.role_evidence,x.product_evidence,x.summary,x.state,'not_assessed','source_observed',x.note
FROM (VALUES
('STAD','FR','stad.fr','https://stad.fr/','https://www.stad.fr/stock-tubes','https://www.stad.fr/stock-tubes','French stockholder supplies welded and seamless steel tubes, including EN 10219.','research_only','Stock and tube ranges documented; sourcing and publication rights not assessed.'),
('LTB France','FR','ltbfrance.com','https://ltbfrance.com/','https://www.ltbfrance.com/contactez-nous/','https://www.ltbfrance.com/contactez-nous/','Purchases, stores and distributes pressure-fluid pipes and accessories.','research_only','Fluid-system pipe stockholder, not automatically structural hollow sections.'),
('De Neuve Tubes','FR','deneuve.fr','https://deneuve.fr/','https://www.deneuve.fr/distributeur-de-tubes-et-verins/','https://www.deneuve.fr/distributeur-de-tubes-et-verins/','Industrial distributor of mechanical steel tubes, hydraulic cylinder tubes and line pipe.','research_only','Mechanical/pressure lines; tube grade availability requires separate verification.'),
('Salzgitter Mannesmann Stahlhandel GmbH','DE','salzgitter-mannesmann-stahlhandel.de','https://salzgitter-mannesmann-stahlhandel.de/','https://www.salzgitter-mannesmann-stahlhandel.de/de/produkte-leistungen/lieferprogramm-rohre/rohrprodukte.html','https://www.salzgitter-mannesmann-stahlhandel.de/de/produkte-leistungen/lieferprogramm-rohre/rohrprodukte.html','German steel stockholder supplies hot/cold-formed hollow sections EN 10210 and EN 10219.','research_only','Member of Salzgitter group; legal operating-entity and location review pending.'),
('Heitmann Stahlhandel','DE','heitmann-stahl.de','https://heitmann-stahl.de/','https://www.heitmann-stahl.de/produkte/stahlrohre/','https://www.heitmann-stahl.de/produkte/stahlrohre/','Steel wholesaler lists EN 10219/EN 10210 hollow sections and welded/seamless tubes.','research_only','No company-wide claim of stocked quantity or all facilities.'),
('IMS Polska','PL','polska.ims-group.com','https://polska.ims-group.com/','https://polska.ims-group.com/','https://polska.ims-group.com/','Polish special steel distributor stocks tubes, profiles, bars and related processing.','research_only','IMS group: exact Polish legal company to review, group subsidiaries distinct.'),
('thyssenkrupp Materials Poland','PL','thyssenkrupp-materials.pl','https://thyssenkrupp-materials.pl/','https://www.thyssenkrupp-materials.pl/pl/stal-weglowa','https://www.thyssenkrupp-materials.pl/pl/stal-weglowa','Polish steel distributor lists welded/seamless tubes and structural hollow profiles.','research_only','Separate Polish operating entity, not the same as NL or other group companies.'),
('Drozapol-Profil S.A.','PL','drozapol.pl','https://drozapol.pl/','https://drozapol.pl/','https://drozapol.pl/','Trading and service center lists tubes and hollow sections, with own rebar processing.','research_only','DUAL-ROLE REVIEW: distribution and fabrication, separate capabilities.'),
('KönigStahl Poland','PL','koenigstahl.pl','https://koenigstahl.pl/','https://www.koenigstahl.pl/pl/','https://www.koenigstahl.pl/pl/','Polish steel wholesaler stocks welded tubes and structural hollow sections.','research_only','GROUP REVIEW: König holding relationships with Czech Königfrankstahl.'),
('Coopra Buis B.V.','NL','cooprabuis.nl','https://cooprabuis.nl/','https://cooprabuis.nl/stalen_buizen/en/','https://cooprabuis.nl/stalen_buizen/en/','Dutch stockholder of steel tubes and hollow sections for construction uses.','research_only','Office address published; do not infer stockyard location from office.'),
('thyssenkrupp Materials Nederland','NL','thyssenkrupp-materials.nl','https://thyssenkrupp-materials.nl/','https://www.thyssenkrupp-materials.nl/nl/producten/staal/kokerprofielen','https://www.thyssenkrupp-materials.nl/nl/producten/staal/kokerprofielen','Dutch metals wholesaler stocks EN 10210 S355J2H and EN 10219 hollow sections.','research_only','Separate Dutch operating entity; group relation to Poland requires review.'),
('Teham Pongers','NL','teham-pongers.nl','https://teham-pongers.nl/','https://www.teham-pongers.nl/grote-magazijnvoorraad/','https://www.teham-pongers.nl/grote-magazijnvoorraad/','Wholesaler stocks steel pipes, hollow profiles, stainless and specials.','research_only','Warehouse in Hengelo described in first-party source; no automated location mapping.'),
('Precision Steel International','NL','psi-steel.nl','https://psi-steel.nl/','https://psi-steel.nl/','https://psi-steel.nl/','Precision steel tube and shaft wholesaler, including hydraulic cylinder tubes.','research_only','Precision/hydraulics rather than EN 10219 structural tube specialization.'),
('León Tubos','ES','leontubos.com','https://leontubos.com/','https://www.leontubos.com/','https://www.leontubos.com/','Spanish structural-steel distributor with tube stock and processing services.','research_only','Parent or historical Van Leeuwen relationship to review; no automatic group merge.'),
('Marceliano Martín','ES','marcelianomartin.com','https://marcelianomartin.com/','https://marcelianomartin.com/','https://marcelianomartin.com/','Spanish steel stockholder offers structural tubes and steel profiles.','research_only','Site reports multiple distribution centers; no individual facilities inferred.'),
('Globalmetal Aceros','ES','globalmetal.es','https://globalmetal.es/','https://globalmetal.es/','https://globalmetal.es/','Spanish trader and distributor supplies EN 10219 structural tubes and profiles.','research_only','Trading/broker role; do not infer own warehouses from logistics descriptions.'),
('Eduardo Cortina','ES','eduardocortina.com','https://eduardocortina.com/','https://www.eduardocortina.com/','https://www.eduardocortina.com/','Spanish distributor of welded/seamless carbon-steel pipes and fittings.','research_only','Main warehouse Erandio explicitly published; verified legal name still pending.'),
('Grupo VALSTEEL','PT','valsteel.pt','https://valsteel.pt/','https://valsteel.pt/','https://valsteel.pt/','Portuguese stainless-steel stockholder distributes tubes, flanges and accessories.','research_only','Group comprises separate legal companies; needs identity reconciliation.'),
('ABC Steel s.r.o.','CZ','abcsteel.cz','https://abcsteel.cz/','https://www.abcsteel.cz/','https://www.abcsteel.cz/','Czech trader sells steel tubes, sections and metallurgical materials.','research_only','Reported Czech identity must be checked against business register.'),
('IMPEX TB s.r.o.','CZ','impextb.cz','https://impextb.cz/','https://www.impextb.cz/cs','https://www.impextb.cz/cs','Czech trader of precision welded steel tubes, galvanized tubes and profiles.','research_only','Factory and warehouse locations listed; distinct from manufacturing.'),
('Weyland Stahlhandel s.r.o.','CZ','weylandstahlhandel.cz','https://weylandstahlhandel.cz/','https://weylandstahlhandel.cz/','https://weylandstahlhandel.cz/','Czech steel trader offers seamless and hollow tubes, profiles and cutting.','research_only','GROUP REVIEW: subsidiary of Weyland Austria already in prior research.'),
('Königfrankstahl s.r.o.','CZ','koenigfrankstahl.cz','https://koenigfrankstahl.cz/','https://www.koenigfrankstahl.cz/','https://www.koenigfrankstahl.cz/','Czech warehouse distributor stocks EN 10219/EN 10210 profiles and seamless tubes.','research_only','GROUP REVIEW: related to KönigStahl Poland, distinct legal company.'),
('FERRUM s.r.o.','CZ','ferrum-mb.cz','https://ferrum-mb.cz/','https://ferrum-mb.cz/prodej-hutniho-materialu/','https://ferrum-mb.cz/prodej-hutniho-materialu/','Czech metal stockholder lists tubes, hollow profiles, sheet and bars.','research_only','Mixes trader and metal processing; separate role-level evidence.'),
('H Metal','RO','h-metal.ro','https://h-metal.ro/','https://www.h-metal.ro/ro/','https://www.h-metal.ro/ro/','Romanian steel distributor offers round steel pipes, profiles and cutting.','research_only','Broad construction supplies; ownership, license and site rights pending.'),
('S.C. STEEL TUBES S.R.L.','RO','steel-tubes.ro','https://steel-tubes.ro/','https://steel-tubes.ro/despre-noi','https://steel-tubes.ro/despre-noi','Romanian distributor of seamless carbon and low-alloy steel tubes.','research_only','Legal designation appears first-party; independent registry check required.')
) AS x(name,country,domain,website,role_evidence,product_evidence,summary,state,note)
ON CONFLICT DO NOTHING;

-- Ten source-observed locations. Not NUTS boundaries, registered entities,
-- promoted company facilities or a proof of current inventory.
INSERT INTO private.netdata1eu_trader_facility_evidence(
 trader_research_id,country_code,city,facility_type,evidence_url
)
SELECT r.id,loc.country,loc.city,loc.kind,loc.source
FROM (VALUES
('stad.fr','FR','Avrigny','warehouse','https://www.stad.fr/stock-tubes'),
('cooprabuis.nl','NL','Rijswijk','office','https://cooprabuis.nl/stalen_buizen/en/'),
('polska.ims-group.com','PL','Mysłowice','office','https://polska.ims-group.com/'),
('koenigstahl.pl','PL','Warszawa','office','https://www.koenigstahl.pl/pl/'),
('eduardocortina.com','ES','Erandio','warehouse','https://www.eduardocortina.com/'),
('valsteel.pt','PT','Vila Nova de Gaia','warehouse','https://valsteel.pt/'),
('impextb.cz','CZ','Plchovice','warehouse','https://www.impextb.cz/cs'),
('koenigfrankstahl.cz','CZ','Praha-Modletice','warehouse','https://www.koenigfrankstahl.cz/'),
('ferrum-mb.cz','CZ','Moravské Budějovice','warehouse','https://ferrum-mb.cz/prodej-hutniho-materialu/'),
('h-metal.ro','RO','București','office','https://www.h-metal.ro/ro/')
) AS loc(domain,country,city,kind,source)
JOIN private.netdata1eu_trader_research r ON r.domain=loc.domain
 AND r.research_batch='netdata1eu-trader1c2-firstparty-20261020'
ON CONFLICT DO NOTHING;
COMMIT;
