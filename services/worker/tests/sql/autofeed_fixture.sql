-- TEST ONLY: isolated disposable PostgreSQL. Never run against production.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA private;
GRANT USAGE ON SCHEMA private TO service_role;
CREATE TABLE private.net_it_seed1_index_sources(id uuid PRIMARY KEY,source_url text,source_kind text,added_by uuid,enabled boolean,max_links integer,last_result jsonb);
ALTER TABLE private.net_it_seed1_index_sources
 ADD COLUMN last_harvested_at timestamptz, ADD COLUMN min_interval_hours integer DEFAULT 1,
 ADD COLUMN created_at timestamptz DEFAULT now(), ADD COLUMN profile_path_pattern text;
CREATE TABLE private.net_it_seed1_domains(domain text PRIMARY KEY,proposed_url text,source_id uuid,evidence_url text,status text DEFAULT 'staged',staged_at timestamptz DEFAULT now());
CREATE TABLE private.net_it_overture_provenance(source_id uuid,domain text,overture_gers_id uuid,dataset_release text,source_license text,regional_bucket text,place_taxonomy text,source_audit_url text,PRIMARY KEY(source_id,domain));
CREATE TABLE public.network_companies(website_domain text);
CREATE TABLE public.network_company_discovery_candidates(canonical_domain text);
CREATE TABLE private.network_web_research_seeds(canonical_domain text);
CREATE TABLE public.network_netfast3_suppressed_domains(domain text);
CREATE TABLE private.test_policy(active boolean);
INSERT INTO private.test_policy VALUES(true);
CREATE FUNCTION private.net_it_seed1_policy_active() RETURNS boolean LANGUAGE sql AS 'SELECT active FROM private.test_policy';
-- Existing stage ACL, mocked for local test only.
INSERT INTO private.net_it_seed1_index_sources(id,source_url,source_kind,added_by,enabled,max_links,last_result) VALUES
('00000000-0000-4000-8000-000000000001','https://docs.overturemaps.org/guides/places/#sss-autofeed-v1','other','00000000-0000-4000-8000-000000000099',true,250,NULL),
('00000000-0000-4000-8000-000000000002','https://example.org/list','other','00000000-0000-4000-8000-000000000099',true,250,NULL);
