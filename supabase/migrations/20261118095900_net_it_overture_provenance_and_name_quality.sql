-- NET-IT-OVERTURE2-PROV1 + NET-IT-AUTO2-NAME1 (2026-11-18)
-- Private Overture GERS provenance; first-party identity remains the only
-- legal-name evidence. Never copy Overture Places' names/PII into profiles.
CREATE TABLE IF NOT EXISTS private.net_it_overture_provenance (
  source_id uuid NOT NULL REFERENCES private.net_it_seed1_index_sources(id) ON DELETE RESTRICT,
  domain text NOT NULL,
  overture_gers_id uuid NOT NULL,
  dataset_release text NOT NULL,
  source_license text NOT NULL,
  regional_bucket text,
  place_taxonomy text,
  source_audit_url text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT net_it_overture_provenance_pk PRIMARY KEY (source_id, domain),
  CONSTRAINT net_it_overture_domain_check CHECK (domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'),
  CONSTRAINT net_it_overture_license_check CHECK (source_license IN ('CDLA-Permissive-2.0','Apache-2.0','CC0-1.0'))
);
ALTER TABLE private.net_it_overture_provenance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_overture_provenance FROM PUBLIC, anon, authenticated;
-- Private, not exposed in PostgREST. Only service-role/DB maintenance may inspect.
GRANT SELECT ON private.net_it_overture_provenance TO service_role;

-- First canary's six GERS IDs are already in the source registry.
INSERT INTO private.net_it_overture_provenance (
  source_id,domain,overture_gers_id,dataset_release,source_license,
  regional_bucket,place_taxonomy,source_audit_url
)
SELECT d.source_id,d.domain,
  (s.last_result->'selected_place_ids'->>d.domain)::uuid,
  '2026-10-21.0','CDLA-Permissive-2.0', 'lombardia',NULL,
  'https://github.com/ctimaru/steel-sales-ai/issues/1424'
FROM private.net_it_seed1_domains d
JOIN private.net_it_seed1_index_sources s ON s.id=d.source_id
WHERE s.last_result->>'origin'='net-it-overture1-2026-10-21-readonly-canary20'
  AND (s.last_result->'selected_place_ids'->>d.domain) ~* '^[0-9a-f-]{36}$'
ON CONFLICT (source_id,domain) DO NOTHING;

-- Verified public Overture GERS/website pairs from the successful GitHub
-- Actions runs: #44264196912 and #44266020568. A lead is written only if
-- it was actually staged with THIS source_id; 13+47 existing domains ignored.
WITH gers(origin,domain,gers,area,category) AS (VALUES
('net-it-overture1-canary100','ttetripari.com','d1eee3e7-880c-488d-baa8-7ee5fc19b01b',NULL,'sheet_metal_fabricator'),
('net-it-overture1-canary100','eliostenderozzano.it','c39c7fd7-a68a-41e1-bd07-8d12f91499dc',NULL,'sheet_metal_fabricator'),
('net-it-overture1-canary100','rhotende.it','ede7430f-8b1a-403d-b1b2-479d02beb51b',NULL,'sheet_metal_fabricator'),
('net-it-overture1-canary100','espresstenda.it','f94c4c1a-dc8d-4579-8da4-c345655ce826',NULL,'sheet_metal_fabricator'),
('net-it-overture1-canary100','elettrotenda2000.it','09b9d681-768a-4927-8a1a-248f942f6993',NULL,'sheet_metal_fabricator'),
('net-it-overture1-canary100','cvanicroram.com','52dafe7f-792d-4140-94db-18524ac2c37b',NULL,'sheet_metal_fabricator'),
('net-it-overture1-canary100','flowwaterjet.it','c86646a2-42d3-4dcd-a09b-0d7eca89166c',NULL,'sheet_metal_fabricator'),
('net-it-overture1-canary100','fustellificioideal.it','07c813f3-9117-4090-b8d1-f46aa0d893a1',NULL,'sheet_metal_fabricator'),
('net-it-overture1-canary100','metarsnc.it','f4a48717-7ef6-4632-91cd-21b58f6470fb',NULL,'sheet_metal_fabricator'),
('net-it-overture1-canary100','millutensil.com','105be8b2-327e-43b7-9ad7-091007bbfa7c',NULL,'sheet_metal_fabricator'),
('net-it-overture1-canary100','musazzilavorazionelamiere.it','d2e01b5e-b83f-4a00-b57f-f0d1f2a1438d',NULL,'sheet_metal_fabricator'),
('net-it-overture1-canary100','giteserramenti.it','9458ffb6-feb9-44fa-abcd-58293a6ef771',NULL,'metal_fabricator'),
('net-it-overture1-canary100','cabcarpenteriasrl.it','44a648ec-d2b0-4b64-80fd-b9e85ea529bc',NULL,'metal_fabricator'),
('net-it-overture1-canary100','fonderiamacchi.com','efddf5d0-43aa-41c5-8272-e8fd50ad8c30',NULL,'metal_fabricator'),
('net-it-overture1-canary100','arvedi.it','2d7bb0d8-039e-4356-b839-07384b4b9d7d',NULL,'metal_fabricator'),
('net-it-overture1-canary100','ampersrl.it','4ec28aa9-a8e3-41a4-8d5b-44303c0471b4',NULL,'metal_fabricator'),
('net-it-overture1-canary100','sacchigiuseppe.it','30a6b9bc-720b-400b-bc1f-1190c2bd202c',NULL,'metal_fabricator'),
('net-it-overture1-canary100','satrindtech.com','97945d5e-64ea-4b12-8d58-76abb243539b',NULL,'metal_fabricator'),
('net-it-overture1-canary100','torrifonderie.com','7eadbbfc-d7b1-408f-b185-921d3946502e',NULL,'metal_fabricator'),
('net-it-overture1-canary100','newademainox.com','feaf186c-6bcf-42e1-a45a-8fbafa276eb7',NULL,'metal_fabricator'),
('net-it-overture1-canary100','topcuscinetti.it','f774ec1b-2559-48a3-9749-02cc312e6c04',NULL,'metal_fabricator'),
('net-it-overture1-canary100','serferal.it','71ae306a-f5b9-47fb-bfb6-f6bf67615604',NULL,'metal_fabricator'),
('net-it-overture1-canary100','lattoneriavalenza.it','8718b190-ae70-4b8d-be7e-eeff4ae2cd6a',NULL,'metal_fabricator'),
('net-it-overture1-canary100','officineruboni.it','395864b5-16fa-4ccf-9c5d-e2273cc52553',NULL,'metal_fabricator'),
('net-it-overture1-canary100','mainettilamiere.it','83f25e18-d62a-4f96-b067-55ccb50db08e',NULL,'metal_fabricator'),
('net-it-overture1-canary100','albertiumberto.com','e42546d8-82a6-476d-9506-f572c81b17db',NULL,'metal_fabricator'),
('net-it-overture1-canary100','cemet.it','d9561862-8926-42fd-8611-0082f55b802a',NULL,'metal_fabricator'),
('net-it-overture1-canary100','metallurgicalegnanese.it','5ab9702a-9bdf-46a8-b135-bbf5e7633f99',NULL,'metal_fabricator'),
('net-it-overture1-canary100','caratibronzista.com','e995418d-a8fd-4345-8529-47a9428f6e76',NULL,'metal_fabricator'),
('net-it-overture1-canary100','remosperoni.com','ceff59a6-e498-4e8d-bf87-f707d2638af8',NULL,'metal_fabricator'),
('net-it-overture1-canary100','fonderiasal.com','a1b12497-ecef-4049-b102-dd11a22e37cf',NULL,'metal_fabricator'),
('net-it-overture1-canary100','compatech.it','f15bc7bc-a82b-41a7-9de3-54996b47d6c3',NULL,'metal_fabricator'),
('net-it-overture1-canary100','rivaacciaio.com','c43fdad2-734f-4052-af90-cd9925c65905',NULL,'metal_fabricator'),
('net-it-overture1-canary100','carpenteria-claf.com','eb02e2b2-ad80-485f-bdf9-368397a13f89',NULL,'metal_fabricator'),
('net-it-overture1-canary100','steel-group.it','fa6cdf8e-9cee-4be9-abec-fb94101b371f',NULL,'metal_fabricator'),
('net-it-overture1-canary100','conzadorifratelli.it','27ff1332-9cbb-4c57-b849-fe5da5308461',NULL,'metal_fabricator'),
('net-it-overture1-canary100','nazionale.net','cd094eec-05dc-4552-9c47-7c76dd0fad4c',NULL,'metal_fabricator'),
('net-it-overture1-canary100','minigrip.it','b2fb0644-d855-4cb1-89e9-340ff893d1fc',NULL,'metal_fabricator'),
('net-it-overture1-canary100','actisfurio.com','e70a21f8-4305-4525-a23c-50b25adb73ed',NULL,'metal_fabricator'),
('net-it-overture1-canary100','dramferroeinfissi.it','5a5c37da-c2b6-4313-920e-c1ec55431b11',NULL,'metal_fabricator'),
('net-it-overture1-canary100','plasticino.it','fe52963b-ea0a-4877-a1ef-782975bb87f4',NULL,'metal_fabricator'),
('net-it-overture1-canary100','saldaturametallicarcano.it','968e3a8b-bae4-4f2c-bd82-cb8709adae7c',NULL,'metal_fabricator'),
('net-it-overture1-canary100','3dpubblicita.it','7fa88061-dff4-4ea9-ba48-ec10960ce6e8',NULL,'metal_fabricator'),
('net-it-overture1-canary100','dcecarpenteria.it','51475898-176d-4684-9ae7-73a3bdfe6397',NULL,'metal_fabricator'),
('net-it-overture1-canary100','borghetticilindri.it','ffce7062-1791-4e78-b44f-c1c14379dbaf',NULL,'metal_fabricator'),
('net-it-overture1-canary100','estrallum.com','a3d35ff0-1df9-4259-bcbe-d4307eb16e00',NULL,'metal_fabricator'),
('net-it-overture1-canary100','steel-project.com','e8253d1a-98d6-4c16-b76f-8d5b8220cf2a',NULL,'metal_fabricator'),
('net-it-overture1-canary100','vetraiomancin.it','ba73179e-762b-48d2-af13-c662854e86dd',NULL,'metal_fabricator'),
('net-it-overture1-canary100','carpenteriacapraflorio.it','1df4562d-2a59-407a-a119-9f4c75bda4ab',NULL,'metal_fabricator'),
('net-it-overture1-canary100','donatigiovanni.it','c8a9aab2-7e76-4f16-8b9d-7a620d5cdca7',NULL,'metal_fabricator'),
('net-it-overture1-canary100','fcf-srl.eu','2decaf0f-943e-4304-af16-b3f743e80dd1',NULL,'metal_fabricator'),
('net-it-overture1-canary100','gruppolefsrl.com','eb4cb512-533a-4168-a669-8360fd865f9b',NULL,'metal_fabricator'),
('net-it-overture1-canary100','metallisamm.it','ca6aabdc-ca24-4d79-b4de-286415f43982',NULL,'metal_fabricator'),
('net-it-overture1-canary100','nuovafaor.eu','c3e5a38c-6338-45d5-8d45-b7186a6f9c5a',NULL,'metal_fabricator'),
('net-it-overture1-canary100','scolaro.it','c2701615-8c16-4640-afce-b150e1ea6116',NULL,'metal_fabricator'),
('net-it-overture1-canary100','trevisansnc.it','fdc74651-2287-4641-bcf4-2cd13485a22e',NULL,'metal_fabricator'),
('net-it-overture1-canary100','prandinastefano.it','d7db4daf-bf39-4aa9-b5f9-1fffd795cf0e',NULL,'metal_fabricator'),
('net-it-overture1-canary100','tagliotubicontoterzi.it','477feae4-797b-4559-8d5e-f1e8b7425b4a',NULL,'metal_fabricator'),
('net-it-overture1-canary100','eurotis.it','7102c996-6160-4b7e-9c84-a048b5eb86ce',NULL,'metal_fabricator'),
('net-it-overture1-canary100','semetal.eu','423bfe48-e313-48fe-bb36-2700b83397f5',NULL,'metal_fabricator'),
('net-it-overture1-canary100','metalmeccarpenteria.it','4d7f0189-f75f-477a-96fb-4c6f94697c8b',NULL,'metal_fabricator'),
('net-it-overture1-canary100','mining.sandvik','afa47dd8-c4ae-4cdd-a934-301d857d194d',NULL,'metal_fabricator'),
('net-it-overture1-canary100','saldflux.it','07aad428-255e-4779-9d15-6bb749a3453c',NULL,'metal_fabricator'),
('net-it-overture1-canary100','bottaro.org','e37d6eab-08de-4481-9893-f482303a7e7d',NULL,'metal_fabricator'),
('net-it-overture1-canary100','stroppasystem.it','ca53dfa1-65aa-48a9-97b6-b361cdfd36a3',NULL,'metal_fabricator'),
('net-it-overture1-canary100','zuccacostruzioni.it','912846bb-9d12-445f-ba8d-1d7c8e3f231f',NULL,'metal_fabricator'),
('net-it-overture1-canary100','ediliziamacari.com','e21681fa-6d0c-4221-954a-c91f9272ebba',NULL,'metal_fabricator'),
('net-it-overture1-canary100','rachielecarpenteria.it','abda8a72-62e2-4274-a2dc-d1c9b9d51e50',NULL,'metal_fabricator'),
('net-it-overture1-canary100','turningbruschi.com','64d936c0-a742-4fe1-9dca-b9b2588d246b',NULL,'metal_fabricator'),
('net-it-overture1-canary100','masidef.com','c48d37c3-da49-470b-bd62-d26127639c19',NULL,'metal_fabricator'),
('net-it-overture1-canary100','errebisteel.com','ebe27a70-49c9-469e-a19c-37ca5d4c4837',NULL,'metal_fabricator'),
('net-it-overture1-canary100','cmsmontaggi.it','e883c3fe-c78c-418b-a00a-96be197cdb13',NULL,'metal_fabricator'),
('net-it-overture1-canary100','ydeal.it','4332dcb4-f2f7-49fc-8a66-eece8ba66f8d',NULL,'metal_fabricator'),
('net-it-overture1-canary100','serrandemedaglia.it','90288fe0-79a4-4d9d-b736-fb27e0f1256d',NULL,'metal_fabricator'),
('net-it-overture1-canary100','nuovaoxidal.com','f1358f26-6346-4533-bb8c-3740c8f0459c',NULL,'metal_fabricator'),
('net-it-overture1-canary100','fabbrobodinimassimo.it','f3a422d9-0b7a-4b5a-a5e5-09af22af9a02',NULL,'metal_fabricator'),
('net-it-overture1-canary100','silprogetprofilatura.it','21cd95ad-876d-4ce6-ac87-f9838dd383b7',NULL,'metal_fabricator'),
('net-it-overture1-canary100','lgprimet.it','1ea65479-2316-46f0-b88d-6e6fe8c13528',NULL,'metal_fabricator'),
('net-it-overture1-canary100','albatros-fer.it','b9b38fb2-d0e7-4dee-baf1-d9b835f2218b',NULL,'metal_fabricator'),
('net-it-overture1-canary100','altanacarpenteriemetalliche.it','15cf9858-3954-4d40-8a63-43bd74efb3ec',NULL,'metal_fabricator'),
('net-it-overture1-canary100','baicarsrl.com','58f940aa-b7c5-4a79-b2c2-f8e03a5767f0',NULL,'metal_fabricator'),
('net-it-overture1-canary100','carpenteriapartegiani.com','d82248be-5cb9-40fc-9d48-d0a3608ac43a',NULL,'metal_fabricator'),
('net-it-overture1-canary100','evacuatorifumo.it','059dad27-9a91-47a4-acdc-608be494330c',NULL,'metal_fabricator'),
('net-it-overture1-canary100','ferrall.it','52c1194b-78bd-49cc-8d1f-61a03e16f7fe',NULL,'metal_fabricator'),
('net-it-overture1-canary100','matti.srl','3f079a97-38bf-44b0-97e0-49cf059663cd',NULL,'metal_fabricator'),
('net-it-overture1-canary100','moggicattaneosas.it','71c99237-30b0-48a6-a536-b28fb6463165',NULL,'metal_fabricator'),
('net-it-overture1-canary100','novobox.it','38f49524-43e9-4fc1-93ff-38d3f3966170',NULL,'metal_fabricator'),
('net-it-overture1-canary100','officinameccanicafimm.com','b66dd7e3-b40c-409d-837f-235b11aaf6ce',NULL,'metal_fabricator'),
('net-it-overture1-canary100','officineverbanolavorazioni.it','c3161a9b-c99b-4a38-9f70-c254fa07f659',NULL,'metal_fabricator'),
('net-it-overture1-canary100','omegagalimberti.it','cfafafeb-0019-4d1f-9f3a-f3917765cb35',NULL,'metal_fabricator'),
('net-it-overture1-canary100','vieviserramenti.it','fb3e2272-0bd9-4844-8b08-7ff0b848a9a4',NULL,'metal_fabricator'),
('net-it-overture1-canary100','metalsistemi.it','bf79ba22-9824-40ee-a2ed-b35cd7d171a6',NULL,'metal_fabricator'),
('net-it-overture1-canary100','controlattoneria.it','92b30c12-88ea-4d62-bf43-94584c0ef7e6',NULL,'metal_fabricator'),
('net-it-overture1-canary100','delken.it','8f2a2a84-1a6c-4601-b3c1-811942aa40e4',NULL,'metal_fabricator'),
('net-it-overture1-canary100','elvinox.it','e4836fea-c340-46d4-a5cd-6ef5c40f4c50',NULL,'metal_fabricator'),
('net-it-overture1-canary100','patentverwag.it','fb3b1b9d-673d-4b57-8916-d10e092ccf52',NULL,'metal_fabricator'),
('net-it-overture1-canary100','plansee.com','f9ec7a0d-6073-447e-8077-5475f7ea2c73',NULL,'metal_fabricator'),
('net-it-overture1-canary100','struttureferrobattuto.weebly.com','0132ca4e-a1c4-4bfc-a5be-54bbc469f422',NULL,'metal_fabricator'),
('net-it-overture1-canary100','studiopizzol.com','67553e30-0676-404d-ad6f-0e1ce504c81d',NULL,'metal_fabricator'),
('net-it-overture1-canary100','dpcarpenteriametallica.it','d86f8655-4159-43e8-b786-f3295033a16a',NULL,'metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','crestometalli.com','f5c29c97-7113-4b00-8d43-b3c5cbc5f9a9','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','leghesaldanti.com','f6397081-7eb6-4a3d-a15c-7452b1604061','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metallosrl.com','aa0a7f02-a508-4a18-933f-b297df6bf6a3','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','salmocarpenteria.com','426e7d0b-a03a-4eb4-9662-4f96cc38a915','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','teknometalsrl.com','aedde37e-5c6e-4694-be12-772365788597','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','ctsstampaggioassemblaggiolamiere.it','cac109bd-04b9-48a4-ae9b-784039b61546','piemonte','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','ferrariecarena.it','18cf38f6-c910-4eb1-bd99-005df09c3f6b','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','francocarpenteriameccanica.it','18e4a2ba-0a99-488f-a20d-3ad438bc7688','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','oscamlamiere.com','51a7a994-9cbc-473a-9c27-f22e38386fd7','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalserramenti2000.com','f5c858a1-dfc0-4967-b602-a774df9239f8','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','carpenteriametallicaferaudo.it','e4944e5e-3021-4a38-ab27-672d872283f7','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','duttocarpenterie.it','4c9dfeb8-9e29-4873-bcb1-654878a0fe47','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','meccanicabarbero.com','4be6d890-3292-4ce3-8c62-4e130dc99571','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','tagliolaserlamiere.net','9eb48d66-ed00-420d-9276-3adffb579552','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','profilcenter.it','a8e68078-7b04-4d56-b16c-0d1b1032989a','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','siderto.it','5cec4411-b32c-462a-817a-4779060474c0','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','tubewire.com','882e906b-bbf4-4ace-bfc9-7287288f85aa','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','cuneoinox.com','09685d70-c640-42b5-8a91-d04b41d60a81','piemonte','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','ilferrobattuto.com','eeeef4ef-ce63-4a57-a3ff-4e7e2281a344','piemonte','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','laiacciai.com','1309b287-1ec0-4b92-bc1d-4b69367612a1','piemonte','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','lamtminuteriemetallichetornite.com','ee5eed55-21c0-4d25-b2f2-a3761a846b3f','piemonte','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','mecsider.com','984b5c42-5fb7-47d2-bb7a-561e465b7291','piemonte','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','steelcps.com','e5465ba0-443e-4a07-9f92-425be57edb8e','piemonte','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','tecnosteel.com','e3b2d12d-f4f8-4946-b4c2-b64041d5f108','piemonte','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','fonderiabenini.org','32444a5a-fedc-4895-a51d-e8b7e70a0c76','piemonte','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','recuperometallimetalbuy.it','aad9b67f-6363-4987-9edc-71699ee1d1d1','piemonte','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','lavorazionelamieremcmgroup.it','50bf7d4f-a053-4e4b-a2b8-f4afd7e0d920','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','prondametalli.it','b03462cf-4e0b-4a2b-bfa2-8dccdf369756','piemonte','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','carpenteriametaldesigndehors.it','03c65460-bc25-40e7-94b6-f8cd60a8a482','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','mussinomeccanica.it','a9c030d9-c952-4689-a53e-4519ccc9ed57','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','fulcheriserramenti.com','ad67e1fb-37e0-476d-9c58-aaba62b8b1a9','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','franchinorivestimenti.it','6a83db83-fb4d-4418-a864-5ca32c076a87','piemonte','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','desderiserramenti.it','98e137d4-3b4f-4b70-9418-c2bebb9479ff','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','vibel1979.it','d06e24d1-6acb-4983-859b-7940bd6505c7','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','comefistore.it','cd59a418-2070-450a-bcaf-e66a8feb8bb0','piemonte','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','domuspro.it','92ed66cc-ea73-4c86-a199-057454633273','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','cromaturegirardi.com','a9e29bff-b23f-4e14-af9d-453bf7792691','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','garnero.com','45860e21-99d4-45fa-bbff-0bf0de2eec32','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','pastore.biz','daeafa0b-d77b-41a1-b0a6-7d47c431beb2','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','sicurtecnica-torino.com','c25f3fc7-f17f-48fb-bae6-5f392289b0c4','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','2effeserramenti.it','8af5ae82-497c-4a26-a389-930406bf2768','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','frenifrizionilinot.it','b812f2a4-2c5b-4646-a054-66d4bd00c695','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','fratellinota.it','3bcb0d47-9792-4cce-b92c-30daedca447d','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','aleasistemi.com','700e6e24-a713-419e-aa85-6619179c82ca','piemonte','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','saraccoribaltabili.com','271330b2-e81e-4086-b68d-4c9abdc5ccaf','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','fabbromoncalieri.com','87b9f0e7-6a65-422d-9544-d4d3ee66bd7b','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','marcelloserramenti.it','7e7991bb-6910-4e52-835c-9523f4e9b18a','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','tecnoperf.com','fb2c75d5-11c4-49a6-a72a-02085043c25c','piemonte','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','stellsrl.com','e811c4d1-f74b-40a1-b82c-d5f0e39d385c','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','duebdifratelliballatore.it','982b05a8-7d20-4f52-9b3b-e3dffe4bceea','piemonte','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalevolution.it','95d7a55b-f65d-4598-b208-fc13368a1b8b','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','fonderiapisani.it','221e32c9-d9f9-4d10-b54b-e048d12a66d2','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalcarsrl.it','6f0802d4-0cbd-4dfb-9b14-b00768989d63','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','inoxtubi.com','a4f93723-724d-4073-bbd1-8410cb876bc8','nord_est','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','nordestacciai.it','d5855528-7ffb-4324-b5ff-e3a22e022287','nord_est','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','cordioliopereinferro.it','11f1ea14-3f80-4394-b067-d94db67d49a3','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','elettromeccanicazeviana.it','ab484b9b-692d-4346-9764-6ad7a0124f2e','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','ferrarilamiere.it','e36e35d3-18da-4dce-ac44-942bb00941d2','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalstampo.it','af54554d-d822-4206-8552-47a962fa540a','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','bspuliturametalli.com','bb1a3934-81a7-400e-8acb-b8d129c5434e','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','filmacmeccanica.it','d541190f-98fb-4328-8d3e-187b12c7fcd6','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','gitiessecarpenteriesrl.com','a2b909f8-5d39-4e68-a220-de56cd9efc56','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','meccanicameucci.com','b6b1b5e3-a582-4bc6-9164-39b3aa30bad4','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','mecoscarpenteriemetalliche.it','441a01ff-efc3-488e-9bea-f4270a91db08','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','lamieretamellin.com','dda96ace-9891-415d-9d33-40d3b5126cb0','nord_est','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','arcostruzionimeccaniche.it','d023b27c-52ea-466f-859e-4870d4bb2c3c','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metallurgicaveneta.it','132c5c95-7361-4e71-9c73-3ab635550a45','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','coltro-carpenteriaverona.it','e735e44d-2111-4a25-b795-844595a1f35b','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','venturiacciai.it','977f17a7-cc84-4b62-a8f8-ac2be4ac7fbf','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','albasiderurgica.com','724bdb65-ef3e-4aca-84a1-2cc537dec6b3','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalsan.it','cfb075f8-7ad1-4126-a0c4-2aa1d4a29dd8','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','3bferrosolai.it','4f91d45f-bae1-4b8f-b172-c730b653fbe5','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','rubinarredamentimetallici.it','b2f7037d-daa9-4758-b385-a89f0ddc7085','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','asuacciai.it','84a3e44c-7e91-4b69-8d0b-3b280a16285e','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','cmi-meccanica.it','30f9906c-c3f4-43e1-8606-c7a37b1b8339','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','fermetalverona.it','a2a59f4b-81b5-467f-af09-8ca0b8bd8733','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','nicosald.it','ba3ae7a1-147c-4471-9a0c-adae0703425d','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','presmetalspa.it','923e8e3e-93a1-465b-8023-3806350a0947','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','inoxtecnicaveronese.it','b1480a49-eef5-4803-a66d-aea4ffc19698','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','eurometallisrl.it','f0dcb224-85fd-4498-a3d2-fa34e13b1fc5','nord_est','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','modernasrl.com','9b4e5d38-3707-414d-9808-5e4505d08cb5','nord_est','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','caliber-srl.it','e0201c3c-7452-4e25-a52e-dc7518bae2ca','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','bmnarte.com','ec41cfe0-5258-4e05-8026-632fb933b28e','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','alufersrl.it','21ec763e-c8d9-4a67-b728-444c0e6df609','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','valang-snc.it','08ff1793-fc9d-40ef-860c-08ec7510dce8','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','armorporteblindate.com','d322b84d-d6cc-4932-aca2-36bbaadb0d66','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','brevettibizz.com','b276ae3e-8777-4c98-9b69-2d0d48c243c3','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','fercart.it','70707083-b923-4aaf-8d99-fa00863ed348','nord_est','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','roclam.com','1caf6536-49a5-47a7-bccc-9aac809488e6','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','ambrosigroup.com','795200b2-bec6-45e2-9a04-aad8e0aa4ff9','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','brustolin.it','d0144164-a2b1-462e-b6e8-6aed54f2dc08','nord_est','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','spring85.it','7527b997-2840-43f1-81ce-4012a3d983aa','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','tecno-tre.it','f6037718-741c-47bc-b043-a5057ad673e5','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','olivieritende.it','b24afc1e-bf95-4728-93e3-96ebaca3094e','nord_est','sheet_metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','tigi2emme.it','f42a6091-e5a6-4bae-a9a1-7a9238d24964','nord_est','sheet_metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','antoniolisrlbasculanti.it','d7f59fe8-36d3-4f3c-b2ca-a62f2d616427','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','intermobel.it','59f163dd-ecd5-4444-a872-277582c0dfd2','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','pmscale.com','0b1112b8-9dec-48a1-9874-01983246e2ea','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','giuliettosrl.com','fbb2874f-2ec9-409c-bcb4-d42b2830cb32','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','fabbrobertolini.it','c695d548-58a4-4456-9d45-d830b3aeaacd','nord_est','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','gfdiferraresidavide.it','c0d42dbe-f7fa-40c7-8788-ba2c16348c9e','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','themainox.it','f812cb61-d94d-493e-9caf-5649382966d8','emilia_romagna','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','siderparma.it','7b0362b2-7e44-44f4-83f4-d12bfeef2d54','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','steel-group.it','fa6cdf8e-9cee-4be9-abec-fb94101b371f','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','carpenteriapeselli.com','75c81b4a-a6c5-4646-8f73-afa4b280e205','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metallicasrl.net','8ab55755-92a6-4b94-9f9d-750e1e5f557a','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','steel-project.com','e8253d1a-98d6-4c16-b76f-8d5b8220cf2a','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','gfbfucinameccanica.it','cb374a46-06cd-4c59-8343-79001b7922cd','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','mlcarpenteria.it','4b8bcfa6-019b-4599-8120-d8a9b98eb5c3','emilia_romagna','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','labottegadelferrobattuto.eu','0832bd03-4496-4e10-94d6-7bc9c9ffff0e','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalfairo.com','8be15524-07a2-492e-a611-f9a440590b45','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','tubimec.it','b839559d-15dd-460a-ad03-3a64c4d848cf','emilia_romagna','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','tecnometaltubi.eu','78ee86f2-bc75-4bd0-a9f9-28fe1b9f7eb8','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','fittinox.it','bff99b2b-cee0-4a93-928f-20f98399d2f4','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','parmameccanica.com','1df12e15-bd96-400a-a4e0-efbaeb772d0d','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','officineverbanolavorazioni.it','c3161a9b-c99b-4a38-9f70-c254fa07f659','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','coprosider.it','2783929c-d7bc-478a-8710-babb24507469','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','rappawelding.com','8adadc7c-ff42-40c9-a277-2dbd63bd8620','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','carpenteriaorlando.it','a2cd700b-e16f-4d7c-90d8-425c8fb17cc5','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','ferrarini.pr.it','9ae12927-da20-485f-a3c1-cbb701e11990','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','bellonilamiere.com','08e86dda-51fb-46f2-9d52-39bd7cd24fee','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','erreimpiantiinox.it','db2a1c04-eab7-4600-8e93-dd2ba81f5695','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','erreimpiantinox.it','5ad9ce0c-07c9-4a04-a821-faebb9635476','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','meksteel.it','2fd0a1a3-26c2-45ad-bad6-a4e046b479b7','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','vergalliacciai.eu','5f0b1ccc-7561-45da-8cb7-514fba8f6923','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','cosider.it','7c6911f3-9cf8-4a54-b867-deaf1e9be292','emilia_romagna','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','inoxbox.it','0a5db482-c44f-4555-91e4-6179939f3bd1','emilia_romagna','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','artigiano-delferro.it','01366d3d-afc7-4936-8469-d849a128c1a4','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','ferrobattutomanfredini.com','5d717f56-9e7a-46a5-95e0-b5a2da25eeb1','emilia_romagna','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','dpgprofilati.it','cf4b5c09-a357-4962-9c01-8a6da35c443f','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','italferparma.com','664bd644-f057-401e-ba83-b4b89c71c549','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','serramentimalossi.com','7d59f6f7-2358-4c53-a7ad-1f125b417aa9','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','giteserramenti.it','9458ffb6-feb9-44fa-abcd-58293a6ef771','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','finottisergio.it','1053465d-4759-4edf-abf0-a2a96af3f460','emilia_romagna','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','tendepassepartout.it','6ee5fea9-40e2-45a2-9003-1131c715d82f','emilia_romagna','sheet_metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','ispraviareggio.it','e6cdba73-6bf3-49e7-8e65-a3684838fb9b','emilia_romagna','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','arvedi.it','2d7bb0d8-039e-4356-b839-07384b4b9d7d','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','minari-engine.com','ac72f3ff-9701-48f7-a9df-fbbb0a377514','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','coverferitalia.it','d6f663b3-6f1a-43c9-932d-bfc66d6b306c','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','topcuscinetti.it','f774ec1b-2559-48a3-9749-02cc312e6c04','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','trancerieemiliane.it','914d57d6-b6d4-4d85-917b-9d5ea30c2634','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','ce-si.it','75309860-8de2-4cb1-8f74-43cb0fed2b60','emilia_romagna','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','coalferserramenti.com','b170c2bd-b804-4d58-81b4-8c633f445ad1','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','martinaarmandoserramenti.it','a2696e7a-445b-40b0-b369-86cb8866751d','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','firmac.it','ae900bc8-81ff-48a1-9f6b-e39cbe6ff038','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','edilmarket.bigmat.it','5c95c4dc-bda9-4cbf-946c-e65b7022d4fd','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','marini-coperture.it','712d1deb-4b91-4920-92ba-43fe1b27c9d4','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','versilgronda.com','95786123-55d4-470a-9e86-b2e2468ce6c3','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','barusiparma.it','9e2ecd15-f3b6-42f1-a389-e24fad14119d','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','ceiart.it','013b4a1d-e912-4f09-a390-d6dd8366af8b','emilia_romagna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','sidertubiromasrl.com','3b51c7bc-3001-42d9-9a6e-1812bfac2297','centro','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','fscmetalli.it','1244be06-9591-4515-aa08-d81e19ea9c3a','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','emiliinoxnewstyle.com','3a917453-dece-400a-9a10-0a2bcfeef03d','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','tecnicadellasaldatura.it','97a1f982-a591-4c82-9998-edd035aac848','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','impresaforgacsioan.it','a90dc98e-f3ae-4d2c-8f80-a3677afb00ae','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','nuovametalleriatestaccio.it','accc9d0d-e33e-4d5c-86ac-017ecddf830c','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalvetrosrl.com','7c42776e-9fd1-489a-b779-64fce90f7d2c','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','epifanilavorazioneferro.com','c648c52c-72dd-4a74-a6ea-a902640d4a3b','centro','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','lasermeccanica.com','818f5607-63ca-4cea-a333-53e7b51973f4','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','mplamiere.it','97f3d7cf-f1e0-4ae9-bd34-039428296e4c','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','calometalli.com','a0464623-23fc-4e76-b85c-2130129a45df','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','dasinferriateroma.com','4511639e-f70e-4d0d-8f43-5d240501ac93','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','siderpomezia.it','d2180492-ba13-446e-9c84-50b0af2f670c','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','braimetalli.com','4bbb0e0b-acf8-4420-a05e-1464c7c47162','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','comsider.net','f4f5806a-9d1a-469a-a4cf-18418a60d9cb','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','costruzionimeccanichecasalese.com','572b0f77-9c24-4e22-9e48-e1e7ff9ac609','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','fonderiacarnevaleroma.it','c9a1cb8b-868c-4f6c-9bde-62d14eaba2fd','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','ilferroartisticoroma.it','35c160b7-c787-4d4c-959f-33b6bfe476b8','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','ecolagoinfissiemetalli.it','d3452116-cca8-442e-b81c-6a4877fe0f50','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','sidercisterna.it','33c9a190-2fb1-4719-a565-26af385266f3','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','artigianametalli.org','a6e9cd80-4152-48af-928c-aeb1fbf6efd4','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalnar.com','d5189c56-af53-4f57-a64f-964e5099eb70','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','pinilucidaturametalli.com','29df108a-61fd-42d0-933f-afbbaf40f6fc','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','raimo-gianni-lavorazione-metalli.business.site','1ddaea75-fccd-461d-ab03-59180b5f63d6','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalmeccanicalaziale.jimdo.com','9866baf9-2fe1-411e-8440-76aa45386a8e','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalleriapigneto.it','2dab6498-ff77-4fc4-995c-806ee7b5b4b7','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','silfersiderurgica.com','97dd5d5c-e598-4bbd-a97a-22dd0c7eac41','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalsubiacosrl.it','b25e88ce-b829-4d4c-bf48-8e6b3202bfd8','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','brunicarpenteria.it','ab34e34f-4daa-49a0-8f86-44f15f962593','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','semacarpenterie.com','ff2439a6-4b54-46ac-b9ca-c24c428559f5','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','ofcomsnc.com','23bf7045-1996-4e6b-a9c6-c717f8cd86c2','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','tieffeinfissi.com','149175a3-6492-42d6-9c4b-749a74dc34b9','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','velletranigiorgio.it','4fae7e8e-c8c8-4f63-88c4-397e12527e37','centro','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','vanzolini.com','5a72f94d-a33d-4090-9ac8-0c7f960b8460','centro','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','bredasys.com','e8ff3275-febb-4005-be9d-0620a3e94f2e','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','comfersrl.com','50f6f1e7-1e45-4e6b-983d-e94cede51d0e','centro','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','fastenseit.com','785b092d-1093-446d-8d5a-4b466c00734e','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','mefitende.it','0f5df85b-3bb2-4c7f-ae40-21948eb26eb9','centro','sheet_metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','alumensrl.it','ec0e9b06-1985-415d-99a0-336c13125aec','centro','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','linealluminio.net','c6a34639-190c-4345-8557-282381f1948f','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','lattoneriasaf.com','26810420-9b7c-482c-a178-144879d57615','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','serramentiesseciroma.it','560756fb-cea9-44d8-ba9d-57cf79da1eae','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','federicisistemi.com','71815e77-4151-45d0-8d93-523fbe256aee','centro','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','tendarredocentropellet.it','b94c16bf-80a4-4483-aacd-e216b3e67237','centro','sheet_metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','vetreriascarsella.com','fde93d86-3aa2-4f68-85ce-60bb2e9f7e43','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','rte2003.com','3fbf0715-746a-4880-aad2-5fd125e8f096','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','infissialluteam.it','a71fe4f1-313b-4201-b70b-9f74acfbc11a','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','belova.it','0af8b877-9803-4545-bb78-4a43784de217','centro','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','femainfissi.it','fa737ee2-beb4-4bd6-875b-c04e6b0cc42a','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','isargroup.org','aa1ea027-4d25-4661-9e4a-08293489c8db','centro','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','sideralba.it','04312601-16e3-4edf-bf64-ba8c10367937','sud','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','eurosidersrl.it','c34f0190-ddaf-4562-a81f-7dff278742bb','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','ferrosistem.com','c3f75681-93c4-4d41-9931-712c826cdce9','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','anticafonderiamercogliano.it','6e6fbef9-6d81-4bb1-8e57-2c7638c53d44','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','rovettacciai.it','79ec7eb3-f9c0-416d-9c0d-13bd6097621a','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','acciainox.com','ac2056a3-f1d2-4ac5-abe4-31cf3f8e0599','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalsudsrls.it','7e61c288-bfb2-4d3d-b434-91dd5d68d11c','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','inoxmaresrls.com','e1f4b21d-cb6e-4470-a95f-401949da200b','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','eurometallamiere.it','7d939401-4b07-408a-a45b-64a741e0ccef','sud','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','inoxdesignnapoli.com','d7484299-3791-4fdc-8aae-b22ac258edab','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','palmiscianocarpenterie.it','62e3bcac-3230-4890-959a-ab70405ae104','sud','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','sarracinoferro.it','ab9c3430-7fe4-413b-875c-8df6734d1e80','sud','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','acciaiemetalli.it','9121492f-b8e4-4785-9419-fa1c250e3c1a','sud','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','ncflamiere.it','cb2ea693-94e5-4402-852a-a7fa1c07dcea','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','franchinimetalli.it','f9637028-4640-4199-a9df-006292d69a23','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','stendardometalli.it','964ff741-2367-45fd-8671-038e38eb0ec0','sud','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','fonderiaartisticafondet.com','5a5a6486-5b7f-4cbb-a0f7-a2e3c287c3c1','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','leadermetalli.com','19bee128-d336-4b59-a3ec-c33f506e73a3','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','effeerrelavorazioni.it','e8790439-9c34-4b5e-997e-663ed3199862','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalfer-recuperometalli.it','358f3a79-6e6b-4db5-9810-dccfb944e79e','sud','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','artedelferroforgiato.it','ee34ae08-ec94-4f3f-88d4-be9807156883','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','givaferroscafati.it','06fe3a78-b8e7-4c26-80ec-0d4e3d2bba6b','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalimpianti.com','38cf07ea-6319-47e0-b4aa-2c3d78dbcca7','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','steelconstructionsrl.it','eee8fe00-ed23-46cd-8373-0fd442248965','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','tecnosteelitaly.it','421fb235-eaee-4705-82fd-d6139dc93f2c','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','vaccaroprofili.com','a5a5aa8f-43e3-43f2-8a8a-317034929103','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalvezzoli.it','521b7a42-8051-438b-9ecd-23aa58f967a9','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalscrap.it','19fa389c-b998-492e-b475-3834cad92a40','sud','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','bellottinox.it','d38bb385-9b85-43ff-a4e0-44446747a10c','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metescb.it','d24f15d5-265e-40ca-bddd-37959020a3c2','sud','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','slamaluminium.com','6ddf2cb5-0424-4266-a8e4-c24f28d70040','sud','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','eurofersas.com','d874af9a-0d6c-4737-a310-a39b4a8ece73','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','ecoartischia.com','0e1e9eec-c2d8-48e9-9aa0-da7f18dbf4a7','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','esancostruzioni.net','759fb3df-2cbe-4406-b077-47a104e55aa9','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','almea.it','f1c14a74-4317-4a72-b8c7-48994b92f512','sud','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','pallonigonfiati.com','a9e06040-5269-45db-b7ef-a6bb20923ad6','sud','sheet_metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','saviofinestre.it','e6aa669e-5a97-4617-b3cf-3776837a1dec','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','dgstartup.it','0d5e75b2-e9a6-4fb1-9220-de90aa8b20ef','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','lattoneriacotugno.eu','26a9295c-ef47-408d-83c8-77de551f38b4','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','porteblindatenapoli.it','745af9ac-7c4b-4c57-8071-f59e11c447fa','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','giuseppemallardo.it','b7687144-09ee-47c2-a422-25d2d66aa8fe','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','labottegadelserramento.it','49469831-3145-4b38-b215-fa4b012c2e7f','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','fratellicosenza.it','11094b48-5853-4752-932e-c25190567daa','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','carranotende.it','70314dcc-9565-4233-97f1-4906c48557d7','sud','sheet_metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','dueffeverniciatura.it','36456f6d-a91d-4780-abda-0c0d67e9c3c0','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','gfminfissi.it','27093214-cb7f-406f-bcd9-f9377243d4f8','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','comez.info','ea97be3e-afcc-4c7d-8f9b-86297c2fc974','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','guadagninogiosue.com','8c342f67-7cf0-4b5b-bae9-7987e16abfd2','sud','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','cosealfer.it','a15564fc-0d73-4686-876c-3ea4e8d15d67','sud','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','sudferro.it','2cb4913d-9410-4509-b002-5f22d64273fd','sicilia','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','arredoinoxpalermo.it','7b88bdc0-9541-41bd-9949-9d3b1d1c17be','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','galifisiderurgica.it','b3128b39-4705-4bab-bfbb-a25a6722156c','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','prodottisiderurgicidoria.com','658cfc46-b461-4e66-bf0c-52a50be66496','sicilia','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','profilsidersrl.com','a80c92e3-dbf8-4bc7-8c7d-933a53efe7e0','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metallurgicaromancini.it','04398d89-0df0-4215-8700-41e0ee2f55ce','sicilia','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','italferrocatania.it','691d64fc-0f67-404e-829b-bff514000b01','sicilia','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','arteinferroursino.it','db644dbe-89a3-4ba1-952b-dbcfcae42a58','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','lametallurgica.eu','e8fcbe9e-759b-4e81-99c3-3e4bca10e91d','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','lavoriinferropellegrino.it','17037947-42a6-4935-9944-754d7091304b','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalwoodsrl.eu','ca3204c1-6c1c-475b-8556-832141a580df','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','fimetalinfissi.it','72f72a1e-15de-458a-82a6-0ea3fad256fb','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','notogrondaielamierati.it','45eecc19-e321-4041-8b49-76770cb83043','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','costruzioniinferro.com','ddda58b6-19c0-41c8-8650-402396ecff07','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metallurgicarusso.it','97eac160-1f40-46ce-8aed-6d3d8331aa3e','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','sm-inox.it','66603bae-33d5-43b7-bc6e-1d3273a68472','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','artemetferrum.net','43a3e561-fa9a-48c0-8177-79de4ffd4666','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','inoxsciaccaag.com','55bcf29d-e19a-4a46-99df-01a764bdf302','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','messider.com','a92bae99-1192-4e0d-913a-24c61195a15b','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','fgmetal.it','fa4bfca4-5637-4089-8f73-f4f138767b54','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','cataniametalli.com','2c509f37-3b95-460f-9982-caba0ac8f82a','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','cutisiderurgica.it','a64c76c0-7960-4447-9cec-9e28fde76e5e','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','messinaferro.it','dced9e45-f3e4-4c45-88b3-9acf6e303d0c','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','officinatuboflex.it','893bdd75-8754-4a88-995f-3512ca2e1787','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','cometalsrl.it','f8b41e09-e96d-495e-af99-ed1532a2070a','sicilia','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','metalstruppa.com','6cbe0842-e4a9-4480-bdcd-c4ca2c1b8514','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalferro-siracusa.it','a97db755-b8f9-4299-8a6a-f8cb94051e70','sicilia','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','amlavorazioneinox.it','f88342ca-ffd6-4572-88e5-6c05eaf6958d','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','dsinox.it','48accfe2-481e-4dc5-86e4-2d922e390069','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','arteinferrolascari.it','65b856f0-010b-4f1f-901c-0f9f7ab3225e','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','marioorlando.com','beefdd12-f549-472d-9757-be2620b4362b','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','mttendebelpasso.it','719747ec-a34b-451e-9258-70efe4b405b2','sicilia','sheet_metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','termoserramenti.it','bdfec7bf-2b49-4326-8840-eb01e65e7034','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','officinacroce.it','81b129ab-9dc7-40e3-9af2-1e0504855a91','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','naturambiente.it','9ddae111-6712-42a9-9dd7-651ef09fac0f','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','iltempiodelloro.it','704da8ca-598d-4eeb-b269-6965a2e227aa','sicilia','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','serrandepuglisi.com','d28a2788-dc1d-4f78-b0fa-74fd8061671c','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','celiserramenti.it','8e006ae5-3c26-42d5-b239-f1a765272adf','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','lafabbricadimezzatesta.it','f0756b24-c8ac-4f21-a137-6d8e82ae6999','sicilia','sheet_metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','finestral.info','5c05cd90-af66-49b7-8bab-bad7ee6b9455','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','poetaserrande.com','e3c5941c-ec0b-4897-b6df-1c5f7157fa84','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','roofmakers.it','b8c8a460-53e8-4321-8390-0aea9eba2363','sicilia','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','lodetticommerciale.com','a6939444-68cc-47e9-89d0-7a4199233e99','sicilia','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','pantaleoportecorazzate.it','4f65b6af-13e4-471a-9c1a-f1bd9dae4112','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','martogligroup.it','672aaea7-d577-45a9-a7f6-41954febfc74','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','grupposavoca.it','40fdae1a-dd48-4d97-93ae-ffdd17b04edb','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','tecnozinco.it','a73a7f0e-902f-48b0-8311-b15966ccf8e9','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','vigro.it','db571fe7-1227-4a86-be72-7b36f8d8a122','sicilia','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','comfersrl.it','74e1a549-d873-4e57-839b-4fabc97d9460','sicilia','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','sidotisrl.com','51c03aed-53e0-4a35-b2e0-0c2801e5b4f8','sicilia','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','carolimetalecology.com','c9c704b5-78ec-4178-9b13-522b5033c10f','sardegna','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','desanmeccanica.it','8261e973-8635-47ab-8697-f94917c1885b','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','unimetalsardegna.it','9f731575-b195-42f3-940b-7fb52e060183','sardegna','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','mineralacciai.it','90b507db-c127-4797-a922-7caeb7b380d6','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','carpenteriaignaziolocci.com','4ddd5fe9-1b73-4f26-b8fb-2f41bc9dbe36','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','soluzioniinmetallisrl.com','06c89de4-f29a-4deb-8f2f-c43b71574ab0','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalyacht.eu','ffb05c90-b4f8-4e5c-be39-a69fc49c3aa7','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','metalpointguspini.com','5c7afb67-771d-420c-b668-6f66ab842d0b','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','sulciszincoeferro.it','de1c1492-fcd2-4554-899d-ae50eda1ad54','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','cadelanoferro.it','d9bcf265-330c-4af2-a0c7-e775cdcdc862','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','ferronuovalamfer.it','d2e6f27c-8785-43cf-8018-95ea861dc4d6','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','gscarpenteriametallica.it','66b1b204-3bb5-49ae-a785-c4fae3cafea5','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','dittasuferreli.wixsite.com','e9fd87a5-0567-4c51-9af6-446aa2473bdf','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','carpenteria-metallica-roberto-aru.webnode.it','a5ec2fcb-b6a4-4d98-a44e-fb593ad1a5b8','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','sardametalmeccanica.wixsite.com','5f3bcc21-1b13-4f86-b32b-509ca50430ab','sardegna','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','homuarteferro.com','7a938146-3e90-4b81-ba36-7fd053df3ffb','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','profilsider.it','2454e024-6d85-43be-a7c0-e7134a0b9370','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','mauroinox.it','51009adb-429c-4074-bf91-4ff3d6d7cd66','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','gmcostruzionimeccaniche.com','7389c2fa-e955-486a-a4c9-0872e10dae8c','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','chiusuremetalliche.com','35759e47-d4d6-4584-8c3c-3cf17c870c6d','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','siderservizi.com','184b4410-8988-4491-b4ad-0922562d607d','sardegna','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','mdoutdoor.it','e3fa24a5-9977-41a8-a92a-d501d9f81072','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','virdis-cossu.com','11e053ee-9699-4933-9aa4-ad9563fa972e','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','equilibraturaelicheolbia.com','7b6aaac4-700b-4900-b7a2-5a2c6094dd5f','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','ital-web.it','c3d6b5d3-4ab7-4b3b-a028-cf6155cdef50','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','officinesarritzu.com','0c739fa5-405d-4b35-92ba-bcacb6fed96e','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','lasegnaletica.eu','8a5e1dd9-3ace-4080-b392-60ad355502bf','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','fabbropilosassari.it','05640cbe-0774-4ea5-a284-ee184af606fb','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','mdsinfissi.net','f9902ade-6b49-49be-9572-ce8ad1fd3cb2','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','inbrofer.com','cda8a684-82ee-4c23-ba67-4e17d662cf68','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','geosarda.eu','ff617ffc-af61-423d-b362-f1f14ac2f134','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','marinispa.it','e34bb604-f90b-4914-bb06-bac4b8adc6f4','sardegna','metal_supplier'),
('net-it-overture2-seven-area-2026-11-18','sulcisserramenti.it','618577f8-9612-43f2-ba13-b944474450c0','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','nuovasismetsrl.it','5e7813d2-b5bf-427b-9b78-e6fa7158818d','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','pusceddualessandro.wixsite.com','63259bf0-8cf4-4801-84bf-e99a79c4576c','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','laguspinese.it','3050ad7b-a951-4a32-91ad-0292a37752c1','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','colledanproduzioni.it','af70cceb-ae41-4b66-824b-14d20f2f1f01','sardegna','sheet_metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','pudducarburantidorgali.com','e2a4bf8f-b8df-4f3b-8cb9-1a39c0758afa','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','simula1.it','f8b581d9-c404-44e2-8fa2-c4decef1fd71','sardegna','sheet_metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','fabbrodecandiaolbia.it','2de0a792-e2cf-4f2c-a63f-8f1e4794855c','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','officinastefanomanca.it','7b0d1e03-c1bc-42ea-9cf8-024e8c05058d','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','tepor.com','fd22953b-f30a-4df1-9758-f6f907fb6ee6','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','nuovacmsnc.it','99293080-ca7b-4ef9-aa89-3669cf3ef3d6','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','gennaieputzu.com','16687b4b-ba8d-4285-b0de-04120fa3a97a','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','alluminioorgosolo.it','1944e687-120d-4de9-882f-ab952830531b','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','giannizippifabbro.com','d32522a8-ce81-47cb-b3ae-a1a10460a751','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','flarco.it','57bb223f-7c6c-4016-93ce-e9dd5582320c','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','tianainfissi.it','808aa4fe-074c-46e4-9a47-335fa3aea364','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','officinearu.it','76d15a6c-aea3-428a-ab56-0860236a24eb','sardegna','metal_fabricator'),
('net-it-overture2-seven-area-2026-11-18','olmitaly.com','4418869a-c1d3-4147-abe4-49bfc68d39ef','sardegna','metal_fabricator')
)
INSERT INTO private.net_it_overture_provenance (
 source_id,domain,overture_gers_id,dataset_release,source_license,
 regional_bucket,place_taxonomy,source_audit_url
)
SELECT d.source_id,g.domain,g.gers::uuid,'2026-10-21.0',
 'CDLA-Permissive-2.0',
 coalesce(g.area,'lombardia'),g.category,
 CASE g.origin
 WHEN 'net-it-overture1-canary100'
 THEN 'https://github.com/ctimaru/steel-sales-ai/issues/1424#issuecomment-6972860111'
 ELSE 'https://github.com/ctimaru/steel-sales-ai/issues/1427#issuecomment-6973110144'
 END
FROM gers g
JOIN private.net_it_seed1_index_sources s ON s.last_result->>'origin'=g.origin
JOIN private.net_it_seed1_domains d ON d.source_id=s.id AND d.domain=g.domain
ON CONFLICT (source_id,domain) DO NOTHING;

-- Attach per-record provenance at candidate creation. The source is
-- matched by BOTH seed1 source_id AND website domain, never by taxonomy alone.
CREATE OR REPLACE FUNCTION private.net_it_overture_attach_candidate_provenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
 v_source text;
 v_proof private.net_it_overture_provenance%rowtype;
BEGIN
 v_source := NEW.enrichment_quality #>> '{net_it_seed1,index_source_id}';
 IF v_source IS NULL OR
    v_source !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN RETURN NEW; END IF;
 SELECT * INTO v_proof
 FROM private.net_it_overture_provenance p
 WHERE p.source_id=v_source::uuid AND p.domain=lower(btrim(NEW.canonical_domain));
 IF NOT FOUND THEN RETURN NEW; END IF;
 NEW.enrichment_quality := jsonb_set(
   coalesce(NEW.enrichment_quality,'{}'::jsonb),
   '{net_it_seed1,overture}',
   jsonb_build_object(
     'gers_id',v_proof.overture_gers_id,
     'release',v_proof.dataset_release,
     'source_license',v_proof.source_license,
     'region_bucket',v_proof.regional_bucket,
     'taxonomy',v_proof.place_taxonomy,
     'audit_url',v_proof.source_audit_url,
     'identity_verified_by_overture',false
   ), true
 );
 RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION private.net_it_overture_attach_candidate_provenance() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS net_it_overture_candidate_provenance_insert
 ON public.network_company_discovery_candidates;
CREATE TRIGGER net_it_overture_candidate_provenance_insert
 BEFORE INSERT ON public.network_company_discovery_candidates
 FOR EACH ROW EXECUTE FUNCTION private.net_it_overture_attach_candidate_provenance();

-- Existing 389 websites have already passed SEED1; attach durable provenance
-- to any candidates created before this migration, preserving all other data.
UPDATE public.network_company_discovery_candidates c
SET enrichment_quality=jsonb_set(
 coalesce(c.enrichment_quality,'{}'::jsonb),'{net_it_seed1,overture}',
 jsonb_build_object(
 'gers_id',p.overture_gers_id,
 'release',p.dataset_release,
 'source_license',p.source_license,
 'region_bucket',p.regional_bucket,
 'taxonomy',p.place_taxonomy,
 'audit_url',p.source_audit_url,
 'identity_verified_by_overture',false
 ),true)
FROM private.net_it_overture_provenance p
WHERE p.domain=lower(btrim(c.canonical_domain))
 AND (c.enrichment_quality #>> '{net_it_seed1,index_source_id}')=p.source_id::text
 AND c.enrichment_quality #> '{net_it_seed1,overture}' IS NULL;

CREATE OR REPLACE FUNCTION private.net_it_legal_name_quality_ok(p_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE
 v_name text := btrim(coalesce(p_name,''));
 v_core text;
BEGIN
 v_core := btrim(regexp_replace(v_name,
   '(^|[^[:alnum:]])(s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?([[:space:]]*s[.]?)?|s[.]?[[:space:]]*p[.]?[[:space:]]*a[.]?|s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?|s[.]?[[:space:]]*a[.]?[[:space:]]*s[.]?)([^[:alnum:]]|$).*$',
   '', 'i'));
 RETURN v_name <> '' AND v_core <> ''
  -- A first-party call-to-action is not part of an industrial company's name.
  AND lower(v_name) !~ '^(chiama[[:space:]]+ora|call[[:space:]]+now|richiedi[[:space:]]+(un[[:space:]]+)?preventivo)([[:space:]]|$)'
  -- starts with a letter in upper case (no phone numbers, years, lowercase prose)
  AND (v_name ~ '^[[:upper:]]' OR v_name ~ '^[0-9][[:upper:]][[:space:]][[:upper:]]')
  -- no web domain or e-mail inside the name
  AND v_name !~* '[[:alnum:]-]+[.](it|com|net|eu|biz|org|info|srl)([^[:alnum:]]|$)'
  AND v_name !~ '@'
  -- Names copied from flattened UI widgets are not legal entities.
  -- Do not confuse a website's "Immagini" or "Dom Chiuso" controls
  -- with the company owning that website.
  AND lower(v_name) !~ '^(dom[[:space:]]+chiuso|immagini|images|fotografie|gallery|galleria|foto|visualizza)[[:space:]]+'

  -- NET-IT-AUTO4-NAME2: no question/exclamation marks ("M.G. Srl? M.G. Srl")
  AND v_name !~ '[?!]'
  -- no phone-like or date-like digit groups
  AND v_name !~ '[0-9]{3,}[ ./-]+[0-9]{3,}'
  AND v_name !~ '(^|[^[:alnum:]])(19|20)[0-9]{2}([^[:alnum:]]|$)'
  -- no sentence end inside the name ("... gratuiti. VIBEL")
  AND v_name !~ '[[:alpha:]]{4,}[.][[:space:]]'
  -- no navigation, contact, privacy or marketing words
  AND lower(v_name) !~ '(^|[^[:alpha:]])(home|homepage|contatti|contattaci|news|privacy|cookie|cookies|gdpr|titolare|trattamento|informativa|copyright|messaggio|politica|ditta|azienda|località|localita|scegli|preventivi|preventivo|fornirvi|qualità|qualita|benvenuti|telefono|tel|fax|email|pec|sede|menu|info|pulsante|button|clicca|click|scarica|download|vai|torna)([^[:alpha:]]|$)'
  -- at most 6 words before the legal form
  AND coalesce(array_length(regexp_split_to_array(v_core,'[[:space:]]+'),1),0) <= 6;
END
$function$


-- Migration sanity: all 6 + 87 + 302 Overture seed records must have
-- immutable GERS provenance. Fail the migration if source evidence is missing.
DO $$
DECLARE v_missing bigint;
BEGIN
 SELECT count(*) INTO v_missing
 FROM private.net_it_seed1_domains d
 JOIN private.net_it_seed1_index_sources s ON s.id=d.source_id
 WHERE s.last_result->>'origin' IN
 ('net-it-overture1-2026-10-21-readonly-canary20','net-it-overture1-canary100',
  'net-it-overture2-seven-area-2026-11-18')
 AND NOT EXISTS (SELECT 1 FROM private.net_it_overture_provenance p
  WHERE p.source_id=d.source_id AND p.domain=d.domain);
 IF v_missing<>0 THEN RAISE EXCEPTION 'Overture GERS provenance missing: %',v_missing; END IF;
END $$;
