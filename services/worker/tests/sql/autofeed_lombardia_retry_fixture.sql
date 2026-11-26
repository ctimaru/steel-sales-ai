-- Disposable acceptance fixture extension: no production writes.
ALTER TABLE private.net_it_seed1_domains ADD COLUMN run_id uuid, ADD COLUMN claimed_at timestamptz,
 ADD COLUMN updated_at timestamptz DEFAULT now(), ADD COLUMN attempts integer DEFAULT 0, ADD COLUMN detail text;
CREATE TABLE private.net_it_seed1_policy(singleton boolean PRIMARY KEY, daily_crawl_cap integer, authorized_by uuid);
INSERT INTO private.net_it_seed1_policy VALUES(true,100,'00000000-0000-4000-8000-000000000099');
CREATE TABLE public.network_company_discovery_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),requested_by uuid,country_code text,seed_urls jsonb,status text,started_at timestamptz,source_type text,source_reference text,label text,extraction_version text);
TRUNCATE private.net_it_seed1_domains,private.net_it_overture_provenance;
UPDATE private.test_policy SET active=true;
UPDATE private.net_it_seed1_index_sources SET enabled=true;
INSERT INTO private.net_it_seed1_domains(domain,proposed_url,source_id,status,attempts,detail,claimed_at,updated_at)
SELECT d,'https://'||d||'/', '00000000-0000-4000-8000-000000000001'::uuid,st,a,detail,
 now()-make_interval(hours=>h),now()-make_interval(hours=>h)
FROM (VALUES ('fresh.example','staged',0,NULL::text,48),
 ('retry.example','unreachable',1,'ReadTimeout',25),
 ('retry2.example','unreachable',2,'ConnectTimeout',25),
 ('young.example','unreachable',1,'ReadTimeout',2),
 ('exhausted.example','unreachable',3,'ReadTimeout',48),
 ('robots.example','unreachable',1,'robots refusal or no readable page',48),
 ('suppressed.example','unreachable',1,'ReadTimeout',48),
 ('known.example','unreachable',1,'ReadTimeout',48),
 ('no_proof.example','unreachable',1,'ReadTimeout',48)
) AS v(d,st,a,detail,h);
INSERT INTO private.net_it_overture_provenance(source_id,domain)
 SELECT source_id,domain FROM private.net_it_seed1_domains WHERE domain<>'no_proof.example';
INSERT INTO public.network_companies VALUES('known.example');
INSERT INTO public.network_netfast3_suppressed_domains VALUES('suppressed.example');
