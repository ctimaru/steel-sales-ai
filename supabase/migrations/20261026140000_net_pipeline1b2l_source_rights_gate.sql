-- NET-PIPELINE1B.2L: evidence-based bulk rights gate.
-- Explicit records, never infer rights from an HTTPS URL.
create table if not exists private.net_pipeline1b2l_source_rights (
  domain text primary key,
  decision text not null default 'pending'
    check (decision in ('pending','allowed_minimal','blocked')),
  evidence_url text,
  rationale text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint rights_decision_proof check (
    decision <> 'allowed_minimal'
    or (evidence_url ~* '^https://' and length(trim(coalesce(rationale,'')))>=12
        and reviewed_by is not null and reviewed_at is not null)
));
revoke all on private.net_pipeline1b2l_source_rights from public,anon,authenticated;
create or replace view private.net_pipeline1b2l_bulk_qualification
with (security_invoker=true) as
select q.lead_id,q.company_name,q.canonical_domain,q.evidence_url,
 q.classification,
 case
 when q.classification <> 'technical_prefilter_pass_rights_pending' then 'technical_hold'
 when r.decision='blocked' then 'rights_blocked'
 when r.decision='allowed_minimal' and r.reviewed_by is not null
      and r.reviewed_at is not null then 'source_rights_pass_identity_pending'
 else 'rights_evidence_pending'
 end as qualification,
 r.decision as rights_decision,r.evidence_url as rights_evidence_url
from private.net_pipeline1b2k_bulk_intake_queue q
left join private.net_pipeline1b2l_source_rights r
 on r.domain=lower(regexp_replace(trim(q.canonical_domain),'^www[.]',''));
revoke all on private.net_pipeline1b2l_bulk_qualification from public,anon,authenticated;
