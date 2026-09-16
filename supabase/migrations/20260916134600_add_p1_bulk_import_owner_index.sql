-- P1.2 advisor hardening — cover the import_batch_items.owner_id foreign key.

create index if not exists import_batch_items_owner_created_idx
  on public.import_batch_items (owner_id, created_at desc);
