-- PA1.5a — Policy contract alignment.
-- Aligns the machine-readable public policy with the intentionally minimized
-- business-data intake shipped by PA1.5.

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_source_question_channel_available',
      'formal_privacy_rights_require_dedicated_legal_privacy_process'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.company_data_governance_requests is
  'PA1.5 minimal public business-data correction/removal/source-question intake. Optional requester contact data is never exposed directly.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 minimal business-data correction, removal or source-question intake. It does not replace formal privacy-rights procedures and grants no Network access.';
