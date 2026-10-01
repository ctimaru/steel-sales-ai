-- HP4 — Duplicate Company & Existing Profile Resolution
--
-- Hardens registration-to-Network identity resolution without unsafe auto-merge:
-- - canonical identifier matching for VAT / registration IDs
-- - punctuation-insensitive legal-name matching within country
-- - shared website domains become non-blocking possible matches
-- - managed Network profiles are surfaced as non-selectable
-- - website domains are normalized consistently on write

create or replace function private.hp4_normalize_identifier(p_value text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select nullif(
    regexp_replace(
      upper(btrim(coalesce(p_value, ''))),
      '[^A-Z0-9]',
      '',
      'g'
    ),
    ''
  );
$function$;

create or replace function private.hp4_company_name_key(p_value text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select nullif(
    regexp_replace(
      lower(btrim(coalesce(p_value, ''))),
      '[^[:alnum:]]',
      '',
      'g'
    ),
    ''
  );
$function$;

create or replace function private.hp4_normalize_domain(p_value text)
returns text
language sql
immutable
set search_path to ''
as $function$
  with cleaned as (
    select regexp_replace(
      btrim(coalesce(p_value, '')),
      '^[a-z][a-z0-9+.-]*://',
      '',
      'i'
    ) as value
  ),
  host as (
    select split_part(
      split_part(
        split_part(value, '/', 1),
        '?',
        1
      ),
      '#',
      1
    ) as value
    from cleaned
  )
  select nullif(
    lower(
      regexp_replace(
        split_part(value, ':', 1),
        '^www\.',
        '',
        'i'
      )
    ),
    ''
  )
  from host;
$function$;

revoke all on function private.hp4_normalize_identifier(text) from public;
revoke all on function private.hp4_company_name_key(text) from public;
revoke all on function private.hp4_normalize_domain(text) from public;

create or replace function private.hp4_sync_network_company_domain()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.website_domain := coalesce(
    private.hp4_normalize_domain(new.website_url),
    private.hp4_normalize_domain(new.website_domain)
  );
  return new;
end;
$function$;

revoke all on function private.hp4_sync_network_company_domain() from public;

drop trigger if exists network_companies_hp4_domain_sync
on public.network_companies;

create trigger network_companies_hp4_domain_sync
before insert or update of website_url, website_domain
on public.network_companies
for each row
execute function private.hp4_sync_network_company_domain();

update public.network_companies
set website_domain = coalesce(
  private.hp4_normalize_domain(website_url),
  private.hp4_normalize_domain(website_domain)
)
where website_domain is distinct from coalesce(
  private.hp4_normalize_domain(website_url),
  private.hp4_normalize_domain(website_domain)
);

create unique index if not exists network_companies_country_vat_canonical_uidx
on public.network_companies (
  country_code,
  private.hp4_normalize_identifier(vat_id)
)
where private.hp4_normalize_identifier(vat_id) is not null;

create unique index if not exists network_companies_country_registration_canonical_uidx
on public.network_companies (
  country_code,
  private.hp4_normalize_identifier(registration_id)
)
where private.hp4_normalize_identifier(registration_id) is not null;

create index if not exists network_companies_country_name_key_idx
on public.network_companies (
  country_code,
  private.hp4_company_name_key(legal_name)
)
where private.hp4_company_name_key(legal_name) is not null;

create or replace function private.m7_application_candidates_impl(
  p_application_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_app public.company_registration_applications%rowtype;
  v_app_vat_key text;
  v_app_registration_key text;
  v_app_name_key text;
  v_app_domain text;
  v_candidates jsonb;
  v_possible_matches jsonb;
  v_candidate_count integer;
  v_possible_count integer;
begin
  perform private.require_platform_permission('registrations.bridge_network');

  select *
    into v_app
  from public.company_registration_applications
  where id = p_application_id;

  if not found then
    raise exception 'registration application not found'
      using errcode = 'P0002';
  end if;

  v_app_vat_key := private.hp4_normalize_identifier(v_app.vat_id);
  v_app_registration_key :=
    private.hp4_normalize_identifier(v_app.registration_id);
  v_app_name_key := private.hp4_company_name_key(v_app.legal_name);
  v_app_domain := private.hp4_normalize_domain(v_app.website_url);

  with candidate_base as (
    select
      nc.id as network_company_id,
      nc.legal_name,
      nc.trading_name,
      nc.country_code,
      nc.vat_id,
      nc.registration_id,
      nc.website_domain,
      nc.publication_status,
      nc.claimed_status,
      nc.verification_status,
      (
        nc.country_code = v_app.country_code
        and v_app_vat_key is not null
        and private.hp4_normalize_identifier(nc.vat_id) = v_app_vat_key
      ) as vat_match,
      (
        nc.country_code = v_app.country_code
        and v_app_registration_key is not null
        and private.hp4_normalize_identifier(nc.registration_id) = v_app_registration_key
      ) as registration_match,
      (
        nc.country_code = v_app.country_code
        and v_app_name_key is not null
        and private.hp4_company_name_key(nc.legal_name) = v_app_name_key
      ) as legal_name_match,
      (
        v_app_domain is not null
        and private.hp4_normalize_domain(nc.website_domain) = v_app_domain
      ) as domain_match,
      (
        select l.organization_id
        from public.organization_network_company_links l
        where l.network_company_id = nc.id
          and l.link_status = 'active'
        limit 1
      ) as active_link_organization_id,
      (
        select c.organization_id
        from public.network_company_claims c
        where c.network_company_id = nc.id
          and c.status = 'approved'
        order by c.reviewed_at desc nulls last, c.created_at desc
        limit 1
      ) as approved_claim_organization_id
    from public.network_companies nc
    where nc.publication_status <> 'archived'
  ),
  candidate_enriched as (
    select
      cb.*,
      array_remove(
        array[
          case when cb.vat_match then 'country_vat_exact' end,
          case when cb.registration_match then 'country_registration_exact' end,
          case when cb.legal_name_match then 'country_legal_name_key_exact' end,
          case when cb.domain_match then 'website_domain_exact' end
        ],
        null
      )::text[] as signals,
      (cb.vat_match or cb.registration_match or cb.legal_name_match) as blocking_match,
      case
        when cb.vat_match then 'exact_identifier'
        when cb.registration_match then 'exact_identifier'
        when cb.legal_name_match and cb.domain_match then 'legal_name_and_domain'
        when cb.legal_name_match then 'legal_name_exact'
        else 'shared_domain'
      end as resolution_class,
      case
        when cb.vat_match then 1.0000
        when cb.registration_match then 0.9800
        when cb.legal_name_match and cb.domain_match then 0.9300
        when cb.legal_name_match then 0.8500
        when cb.domain_match then 0.5500
        else 0.0000
      end::numeric(5,4) as match_score
    from candidate_base cb
    where
      cb.vat_match
      or cb.registration_match
      or cb.legal_name_match
      or cb.domain_match
  ),
  candidate_final as (
    select
      ce.*,
      (
        (
          ce.active_link_organization_id is null
          or ce.active_link_organization_id = v_app.activated_organization_id
        )
        and
        (
          ce.approved_claim_organization_id is null
          or ce.approved_claim_organization_id = v_app.activated_organization_id
        )
      ) as selectable
    from candidate_enriched ce
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'network_company_id', cf.network_company_id,
          'legal_name', cf.legal_name,
          'trading_name', cf.trading_name,
          'country_code', cf.country_code,
          'vat_id', cf.vat_id,
          'registration_id', cf.registration_id,
          'website_domain', cf.website_domain,
          'publication_status', cf.publication_status,
          'claimed_status', cf.claimed_status,
          'verification_status', cf.verification_status,
          'signals', cf.signals,
          'resolution_class', cf.resolution_class,
          'match_score', cf.match_score,
          'selectable', cf.selectable,
          'active_link_organization_id', cf.active_link_organization_id,
          'approved_claim_organization_id', cf.approved_claim_organization_id
        )
        order by cf.match_score desc, cf.legal_name, cf.network_company_id
      ) filter (where cf.blocking_match),
      '[]'::jsonb
    ),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'network_company_id', cf.network_company_id,
          'legal_name', cf.legal_name,
          'trading_name', cf.trading_name,
          'country_code', cf.country_code,
          'vat_id', cf.vat_id,
          'registration_id', cf.registration_id,
          'website_domain', cf.website_domain,
          'publication_status', cf.publication_status,
          'claimed_status', cf.claimed_status,
          'verification_status', cf.verification_status,
          'signals', cf.signals,
          'resolution_class', cf.resolution_class,
          'match_score', cf.match_score,
          'selectable', cf.selectable,
          'active_link_organization_id', cf.active_link_organization_id,
          'approved_claim_organization_id', cf.approved_claim_organization_id
        )
        order by cf.match_score desc, cf.legal_name, cf.network_company_id
      ) filter (
        where not cf.blocking_match
          and cf.domain_match
      ),
      '[]'::jsonb
    )
  into v_candidates, v_possible_matches
  from candidate_final cf;

  v_candidate_count :=
    jsonb_array_length(coalesce(v_candidates, '[]'::jsonb));
  v_possible_count :=
    jsonb_array_length(coalesce(v_possible_matches, '[]'::jsonb));

  return jsonb_build_object(
    'application_id', v_app.id,
    'create_new_allowed', v_candidate_count = 0,
    'candidate_count', v_candidate_count,
    'possible_match_count', v_possible_count,
    'candidates', coalesce(v_candidates, '[]'::jsonb),
    'possible_matches', coalesce(v_possible_matches, '[]'::jsonb)
  );
end;
$function$;

revoke all on function private.m7_application_candidates_impl(uuid) from public;
grant execute on function private.m7_application_candidates_impl(uuid) to service_role;
