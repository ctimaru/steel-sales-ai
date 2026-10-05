-- PL1.4 retry hardening: import attempts are audit events, not deduplicated identities.

begin;

alter table public.price_list_import_runs
  drop constraint if exists price_list_import_runs_price_list_version_id_content_checks_key;

create index if not exists price_list_import_runs_identity_idx
  on public.price_list_import_runs(
    price_list_version_id,
    content_checksum,
    adapter_key,
    parser_version,
    created_at desc
  );

commit;
