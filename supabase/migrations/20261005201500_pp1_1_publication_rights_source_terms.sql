-- PP1.1 — Publication Rights & Source Terms Resolution
-- Padana PTC 18/2026: public structured republication remains blocked absent written authorization.

begin;

with target as (
  select
    v.primary_source_document_id as knowledge_document_id,
    d.source_id as knowledge_source_id
  from public.price_list_versions v
  join public.knowledge_documents d on d.id=v.primary_source_document_id
  where v.manufacturer_version_code='PTC 18/2026'
  order by v.platform_revision desc
  limit 1
),
previous as (
  select g.id
  from public.price_list_source_governance_events g
  join target t
    on t.knowledge_source_id=g.knowledge_source_id
   and t.knowledge_document_id=g.knowledge_document_id
  where g.decision_type='publication_rights'
  order by g.decided_at desc,g.created_at desc,g.id desc
  limit 1
)
insert into public.price_list_source_governance_events(
  knowledge_source_id,
  knowledge_document_id,
  decision_type,
  decision,
  raw_document_visibility,
  structured_data_visibility,
  attribution_requirement,
  terms_reference,
  evidence_snapshot,
  rationale,
  supersedes_event_id
)
select
  t.knowledge_source_id,
  t.knowledge_document_id,
  'publication_rights',
  'internal_only',
  'internal',
  'internal',
  'Attribution alone is not sufficient. Public reproduction/re-utilization requires prior written authorization from Padana Tubi e Profilati Acciaio S.p.A. If authorization is later granted, attribution must identify Padana Tubi e Profilati Acciaio S.p.A. and the manufacturer list version.',
  'https://www.padanatubi.it/note-legali/',
  jsonb_build_object(
    'reviewed_at','2026-10-05',
    'source_pdf_url','https://www.padanatubi.it/wp-content/uploads/2026/09/PTC18_09_2026.pdf',
    'official_attachment_page','https://www.padanatubi.it/prodotti/acciaio-al-carbonio/',
    'legal_notes_url','https://www.padanatubi.it/note-legali/',
    'rights_findings',jsonb_build_array(
      'Padana legal notes reserve rights in website materials and state that reproduction in whole or in part requires prior written authorization, except for expressly stated exceptions.',
      'The reviewed price-list PDF is publicly accessible from the official Padana product page, but no explicit public republication licence for the structured price-list data was identified.',
      'Padana legal notes also state that deep links to pages other than the home page require prior written authorization.',
      'Source attribution does not itself constitute authorization to reproduce or re-utilize the full structured list.'
    ),
    'public_linking_policy','Do not publish a direct PDF deep link unless Padana gives written consent; public attribution may link to the Padana home page until consent states otherwise.',
    'required_next_evidence','Written Padana authorization/licence covering structured reproduction/re-utilization and, if desired, direct linking to the source PDF.'
  ),
  'PP1.1 legal/source-terms review: Padana''s published legal notes expressly reserve website-content rights, require written authorization for reproduction in whole or in part, and require written authorization for deep links outside the home page. Because Smart Steel Sales would commercially re-publish a substantially complete structured representation of PTC 18/2026, mentioning the source is not treated as sufficient permission. Public publication therefore remains blocked until written authorization or a specific licence is obtained.',
  p.id
from target t
left join previous p on true
where not exists (
  select 1
  from public.price_list_source_governance_events g
  where g.knowledge_source_id=t.knowledge_source_id
    and g.knowledge_document_id=t.knowledge_document_id
    and g.decision_type='publication_rights'
    and g.decision='internal_only'
    and g.terms_reference='https://www.padanatubi.it/note-legali/'
    and g.evidence_snapshot->>'reviewed_at'='2026-10-05'
);

commit;
