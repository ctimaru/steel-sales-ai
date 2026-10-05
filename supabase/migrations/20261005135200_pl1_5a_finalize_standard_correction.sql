-- PL1.5A — finalize same-standard correction rows inserted by prior migration.
begin;

update public.price_list_item_weight_links
set resolution_status='rejected'
where resolution_status='candidate'
  and metadata->>'residual_resolution_block'='PL1.5A'
  and metadata->>'resolution_basis'='same_standard_evidence_missing';

commit;
