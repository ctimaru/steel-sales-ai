-- CALC-DIST4: Reversible private archive and owner-only rename.
-- Buyer technical lines, totals and linked RFQ records remain immutable.
-- Column-only UPDATE privileges prevent quantity, ownership, price or org reassignment.
alter table public.buyer_distintas
  add column if not exists archived_at timestamptz null;

-- Older snapshots can have titles longer than the new editor limit.
-- Server actions validate NEW titles without blocking archive/restore of legacy rows.

create index if not exists buyer_distintas_owner_archive_created_idx
  on public.buyer_distintas(owner_user_id,organization_id,archived_at,created_at desc,id);

-- The original BD1 contract intentionally granted only SELECT and INSERT.
-- Do not expand UPDATE to the whole row; keep only metadata columns writable.
revoke update on public.buyer_distintas from anon, authenticated;
grant update (title, archived_at) on public.buyer_distintas to authenticated;

drop policy if exists buyer_distintas_owner_metadata_update on public.buyer_distintas;
create policy buyer_distintas_owner_metadata_update
  on public.buyer_distintas for update to authenticated
  using (
    owner_user_id = (select auth.uid())
    and organization_id = (select public.default_organization_for_user((select auth.uid())))
    and public.is_organization_member(organization_id,false)
  )
  with check (
    owner_user_id = (select auth.uid())
    and organization_id = (select public.default_organization_for_user((select auth.uid())))
    and public.is_organization_member(organization_id,false)
  );

-- Deliberately NO DELETE grants/policies; linked history remains intact.
-- No SECURITY DEFINER functions and no service-role browser exposure.
