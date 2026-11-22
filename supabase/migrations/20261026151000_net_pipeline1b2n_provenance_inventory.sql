-- NET-PIPELINE1B.2N — Durable mass provenance inventory, NOT a rights approval.
create table if not exists private.net_pipeline1b2n_lead_provenance (
 lead_id uuid primary key references public.network_core_target_leads(id) on delete cascade,
 canonical_domain text not null,
 evidence_url text not null,
 evidence_summary text not null,
 provenance_fingerprint text not null,
 captured_at timestamptz not null default now(),
 last_synced_at timestamptz not null default now(),
 rights_status text not null default 'pending' check (rights_status = 'pending')
);
revoke all on private.net_pipeline1b2n_lead_provenance from public,anon,authenticated;
insert into private.net_pipeline1b2n_lead_provenance
 (lead_id,canonical_domain,evidence_url,evidence_summary,provenance_fingerprint)
select l.id,lower(trim(l.canonical_domain)),trim(l.evidence_url),trim(l.evidence_summary),
 md5(concat_ws('|',lower(trim(l.canonical_domain)),trim(l.evidence_url),trim(l.evidence_summary)))
from public.network_core_target_leads l
where nullif(trim(l.canonical_domain),'') is not null
 and nullif(trim(l.evidence_url),'') is not null
 and nullif(trim(l.evidence_summary),'') is not null
on conflict (lead_id) do update
 set canonical_domain=excluded.canonical_domain,
 evidence_url=excluded.evidence_url,
 evidence_summary=excluded.evidence_summary,
 provenance_fingerprint=excluded.provenance_fingerprint,
 last_synced_at=now()
where private.net_pipeline1b2n_lead_provenance.provenance_fingerprint is distinct from excluded.provenance_fingerprint;
