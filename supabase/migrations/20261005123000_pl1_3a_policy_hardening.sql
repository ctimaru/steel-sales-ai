-- PL1.3A policy hardening — remove duplicate permissive SELECT policies.

begin;

drop policy if exists price_list_version_documents_admin_all on public.price_list_version_documents;
drop policy if exists price_list_sections_admin_all on public.price_list_sections;
drop policy if exists price_list_items_admin_all on public.price_list_items;
drop policy if exists price_list_components_admin_all on public.price_list_components;
drop policy if exists price_rules_admin_all on public.price_rules;
drop policy if exists price_list_item_weight_links_admin_select on public.price_list_item_weight_links;

create policy price_list_version_documents_admin_insert
on public.price_list_version_documents for insert to authenticated
with check (public.has_platform_permission('knowledge.edit'));
create policy price_list_version_documents_admin_update
on public.price_list_version_documents for update to authenticated
using (public.has_platform_permission('knowledge.edit'))
with check (public.has_platform_permission('knowledge.edit'));
create policy price_list_version_documents_admin_delete
on public.price_list_version_documents for delete to authenticated
using (public.has_platform_permission('knowledge.edit'));

create policy price_list_sections_admin_insert
on public.price_list_sections for insert to authenticated
with check (public.has_platform_permission('knowledge.edit'));
create policy price_list_sections_admin_update
on public.price_list_sections for update to authenticated
using (public.has_platform_permission('knowledge.edit'))
with check (public.has_platform_permission('knowledge.edit'));
create policy price_list_sections_admin_delete
on public.price_list_sections for delete to authenticated
using (public.has_platform_permission('knowledge.edit'));

create policy price_list_items_admin_insert
on public.price_list_items for insert to authenticated
with check (public.has_platform_permission('knowledge.edit'));
create policy price_list_items_admin_update
on public.price_list_items for update to authenticated
using (public.has_platform_permission('knowledge.edit'))
with check (public.has_platform_permission('knowledge.edit'));
create policy price_list_items_admin_delete
on public.price_list_items for delete to authenticated
using (public.has_platform_permission('knowledge.edit'));

create policy price_list_components_admin_insert
on public.price_list_components for insert to authenticated
with check (public.has_platform_permission('knowledge.edit'));
create policy price_list_components_admin_update
on public.price_list_components for update to authenticated
using (public.has_platform_permission('knowledge.edit'))
with check (public.has_platform_permission('knowledge.edit'));
create policy price_list_components_admin_delete
on public.price_list_components for delete to authenticated
using (public.has_platform_permission('knowledge.edit'));

create policy price_rules_admin_insert
on public.price_rules for insert to authenticated
with check (public.has_platform_permission('knowledge.edit'));
create policy price_rules_admin_update
on public.price_rules for update to authenticated
using (public.has_platform_permission('knowledge.edit'))
with check (public.has_platform_permission('knowledge.edit'));
create policy price_rules_admin_delete
on public.price_rules for delete to authenticated
using (public.has_platform_permission('knowledge.edit'));

commit;
