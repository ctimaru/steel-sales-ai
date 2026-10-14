-- CRAWL-IT6.6c: MIMIT RNA public company-only source proposal.
-- Corporate tax ID is not synonymous with VAT, and must not be mislabelled.
alter table public.network_bulk_intake_rows
 add column if not exists corporate_tax_id text null check (corporate_tax_id ~ '^[0-9]{11}$');
create index if not exists network_bulk_intake_rows_corporate_tax_idx
 on public.network_bulk_intake_rows(corporate_tax_id) where corporate_tax_id is not null;
comment on column public.network_bulk_intake_rows.corporate_tax_id is
'11-digit fiscal identifier of legal entity (corporate tax ID): NOT asserted to be VAT number; no natural-person CF.';

-- Extend the existing guarded private importer with corporate fiscal ID and
-- retain all source-rights, PII, 200-row, batch-idempotence & no-publish gates.
create or replace function private.crawl_it66_bulk_intake_impl(
 p_source_id uuid,p_batch_key text,p_rows jsonb,p_commit boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_source public.network_discovery_source_registry%rowtype;
 v_item jsonb;
 v_batch uuid;
 v_name text;
 v_domain text;
 v_vat text;
 v_tax text;
 v_province text;
 v_city text;
 v_code text;
 v_version text;
 v_role text;
 v_source_record text;
 v_identity text;
 v_evidence text;
 v_keys text[] := '{}'::text[];
 v_n integer;
 v_new integer := 0;
 v_duplicates integer := 0;
 v_invalid integer := 0;
 v_existing text;
 v_matched_existing integer := 0;
 v_matched_candidates integer := 0;
 v_internal_duplicates integer := 0;
 v_has_rights boolean := false;
 v_attested_user uuid;
 v_count integer;
begin
 perform private.require_platform_permission('discovery.run');
 v_attested_user := auth.uid();
 if v_attested_user is null then
   raise exception 'authenticated Platform operator required' using errcode='42501';
 end if;
 if p_rows is null or jsonb_typeof(p_rows) <> 'array'
   or jsonb_array_length(p_rows) not between 1 and 200
 then raise exception 'CSV chunk must contain 1-200 company rows' using errcode='22023'; end if;
 if p_batch_key is null or p_batch_key !~ '^[a-f0-9]{64}:[0-9]{1,5}$'
 then raise exception 'invalid batch digest and offset' using errcode='22023'; end if;
 select * into v_source from public.network_discovery_source_registry
  where id=p_source_id and country_code='IT';
 if not found then raise exception 'Italian source must be registered' using errcode='22023'; end if;
 if v_source.source_url='https://query.wikidata.org/sparql'
 then raise exception 'Wikidata pilot cannot authorize external CSV uploads' using errcode='22023'; end if;
 v_has_rights := v_source.governance_status='approved'
     and v_source.terms_status in ('allows_reuse','allows_limited_reuse')
     and v_source.database_rights_status in ('low_risk','licensed')
     and v_source.personal_data_policy in ('exclude_personal_data','company_data_only')
     and v_source.reviewed_by is not null and v_source.reviewed_at is not null
     and nullif(btrim(coalesce(v_source.rights_evidence_url,'')),'') is not null
     and nullif(btrim(coalesce(v_source.review_note,'')),'') is not null;
 if p_commit and not v_has_rights then
   raise exception 'source rights must be verified by Platform Owner before CSV staging' using errcode='42501';
 end if;
 if p_commit then
   select id into v_batch from public.network_bulk_intake_batches
     where source_id=p_source_id and batch_key=p_batch_key for update;
   if found then
     return jsonb_build_object('status','already_staged','batch_id',v_batch,
       'source_rights_ready',v_has_rights,'requested',jsonb_array_length(p_rows),'inserted',0,
       'skipped_existing_batch',jsonb_array_length(p_rows),'published',0);
   end if;
 end if;
 v_n := jsonb_array_length(p_rows);
 if p_commit then
   insert into public.network_bulk_intake_batches(source_id,batch_key,created_by,requested_count)
   values(p_source_id,p_batch_key,v_attested_user,v_n) returning id into v_batch;
 end if;
 for v_item in select value from jsonb_array_elements(p_rows) loop
   if jsonb_typeof(v_item) <> 'object' or
      not (v_item ?& array['company_name','role']) then
      raise exception 'CSV row missing mandatory company and role fields' using errcode='22023';
   end if;
   if (select count(*) from jsonb_object_keys(v_item)) > 11 or
      exists(select 1 from jsonb_object_keys(v_item) k
             where k not in ('company_name','role','domain','vat_id','corporate_tax_id','province','municipality','ateco_code','ateco_version','source_record_id','evidence_url'))
   then raise exception 'personal or unknown fields in CSV row are prohibited' using errcode='22023'; end if;
   v_name := btrim(coalesce(v_item->>'company_name',''));
   v_domain := nullif(lower(btrim(coalesce(v_item->>'domain',''))),'');
   v_vat := nullif(upper(regexp_replace(coalesce(v_item->>'vat_id',''),'[[:space:]]','','g')),'');
   v_tax := nullif(regexp_replace(coalesce(v_item->>'corporate_tax_id',''),'[[:space:]]','','g'),'');
   v_province := nullif(upper(btrim(coalesce(v_item->>'province',''))),'');
   v_city := nullif(btrim(coalesce(v_item->>'municipality','')),'');
   v_code := nullif(btrim(coalesce(v_item->>'ateco_code','')),'');
   v_version := nullif(btrim(coalesce(v_item->>'ateco_version','')),'');
   v_role := btrim(coalesce(v_item->>'role',''));
   v_source_record := nullif(btrim(coalesce(v_item->>'source_record_id','')),'');
   v_evidence := nullif(btrim(coalesce(v_item->>'evidence_url','')),'');
   if char_length(v_name) not between 3 and 180 or
      v_name ~ '[[:cntrl:]<>@]' or
      v_role not in ('trader_distributor','end_user') or
      (v_domain is not null and (v_domain !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$' or
        v_domain like '%..%' or length(v_domain)>255)) or
      (v_vat is not null and v_vat !~ '^(IT)?[0-9]{11}$') or
      (v_tax is not null and v_tax !~ '^[0-9]{11}$') or
      (v_province is not null and v_province !~ '^[A-Z]{2}$') or
      (v_city is not null and (char_length(v_city)>100 or v_city ~ '[[:cntrl:]<>@]')) or
      (v_code is not null and v_code !~ '^[0-9]{2}([.][0-9]{1,2}){0,2}$') or
      (v_version is not null and v_version not in ('2022','2025')) or
      (v_code is not null and v_version is null) or
      (v_source_record is not null and (length(v_source_record)>100 or v_source_record ~ '[[:cntrl:]<>@]')) or
      (v_evidence is not null and (length(v_evidence)>500 or v_evidence !~ '^https://[a-zA-Z0-9.-]+(/[^[:space:]<>]*)?$')) or
      (v_domain is null and v_vat is null and v_tax is null and v_province is null)
   then raise exception 'CSV row invalid or contains unsupported personal identifiers' using errcode='22023'; end if;
   if v_domain is not null and exists(
        select 1 from unnest(string_to_array(v_domain,'.')) l
        where length(l)>63 or l !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$')
   then raise exception 'invalid corporate website domain' using errcode='22023'; end if;
   -- ATECO is evidence of a business activity, NOT proof of steel procurement.
   v_identity := case when v_tax is not null then 'tax:'||v_tax
      when v_vat is not null then 'vat:'||regexp_replace(v_vat,'^IT','','')
      when v_domain is not null then 'domain:'||v_domain
      else 'name_province:'||lower(regexp_replace(v_name,'[[:space:]]+',' ','g'))||':'||v_province end;
   if v_identity=any(v_keys) then v_internal_duplicates := v_internal_duplicates+1;continue; end if;
   v_keys := array_append(v_keys,v_identity);
   if v_domain is not null and exists(
     select 1 from public.network_companies c
     where c.archived_at is null and lower(c.website_domain)=v_domain
   ) or v_vat is not null and exists(
     select 1 from public.network_companies c
     where c.archived_at is null and upper(coalesce(c.vat_id,''))=v_vat
   ) or v_tax is not null and exists(
     select 1 from public.network_companies c
     where c.archived_at is null and regexp_replace(upper(coalesce(c.vat_id,'')),'^IT','')=v_tax
   ) or exists(
     select 1 from public.network_companies c
     where c.archived_at is null and lower(c.legal_name)=lower(v_name)
   ) then v_matched_existing := v_matched_existing+1; continue; end if;
   if v_domain is not null and exists(
      select 1 from public.network_company_discovery_candidates c where c.canonical_domain=v_domain
   ) or v_vat is not null and exists(
      select 1 from public.network_company_discovery_candidates c where upper(coalesce(c.vat_id,''))=v_vat
   ) or v_tax is not null and exists(
      select 1 from public.network_company_discovery_candidates c
      where regexp_replace(upper(coalesce(c.vat_id,'')),'^IT','')=v_tax
   ) or exists(
      select 1 from public.network_company_discovery_candidates c
      where lower(c.legal_name)=lower(v_name)
   ) then v_matched_candidates := v_matched_candidates+1; continue; end if;
   if exists(select 1 from public.network_bulk_intake_rows r where r.identity_key=v_identity)
      or (v_domain is not null and exists(select 1 from public.network_bulk_intake_rows r where r.website_domain=v_domain))
      or (v_vat is not null and exists(select 1 from public.network_bulk_intake_rows r where r.vat_id=v_vat))
      or (v_tax is not null and exists(select 1 from public.network_bulk_intake_rows r where r.corporate_tax_id=v_tax))
   then v_duplicates := v_duplicates+1; continue; end if;
   if p_commit then
     insert into public.network_bulk_intake_rows(
       batch_id,source_id,source_record_id,company_name,website_domain,vat_id,corporate_tax_id,
       province_code,municipality,ateco_code,ateco_version,proposed_role,evidence_url,identity_key)
     values(v_batch,p_source_id,v_source_record,v_name,v_domain,v_vat,v_tax,
       v_province,v_city,v_code,v_version,v_role,coalesce(v_evidence,v_source.source_url),v_identity)
     on conflict(source_id,identity_key) do nothing;
     get diagnostics v_count=row_count;
     if v_count=1 then v_new:=v_new+1;else v_duplicates:=v_duplicates+1;end if;
   else
     v_new:=v_new+1;
   end if;
 end loop;
 if p_commit then
   update public.network_bulk_intake_batches
   set inserted_count=v_new,
     duplicate_count=v_duplicates+v_internal_duplicates+v_matched_existing+v_matched_candidates,
     skipped_count=v_invalid where id=v_batch;
 end if;
 return jsonb_build_object(
   'status',case when p_commit then 'staged_for_human_review' else 'preview_only' end,
   'source_rights_ready',v_has_rights,'batch_id',v_batch,
   'requested',v_n,'eligible_new',v_new,'inserted',case when p_commit then v_new else 0 end,
   'existing_companies',v_matched_existing,
   'existing_candidates',v_matched_candidates,
   'already_staged',v_duplicates,
   'duplicate_within_chunk',v_internal_duplicates,
   'published',0,'role_verified',false);
end $$;


insert into public.network_discovery_source_registry
 (source_name,source_url,source_type,review_note)
select 'MIMIT RNA — Aiuti di Stato: beneficiari societari (CC BY 4.0; pilota)',
 'https://www.rna.gov.it/open-data/aiuti', 'curated_public_source',
 'Proposta CRAWL-IT6.6c: catalogo ufficiale RNA Open Data CC BY 4.0; esclusivamente persone giuridiche con CF numerico societario. Il settore NACE della componente aiuto NON prova il settore primario ne la domanda di acciaio. Conservare provenienza, attribuzione MIMIT e revisione umana su privacy/riuso SaaS prima dello staging.'
where not exists (select 1 from public.network_discovery_source_registry
 where lower(source_url)=lower('https://www.rna.gov.it/open-data/aiuti'));
