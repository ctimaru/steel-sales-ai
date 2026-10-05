# LR6 — Processor & International Transfer Register

**Baseline date:** 2026-10-05  
**Register version:** `2026-10-05-lr6-v1`  
**Scope:** production providers that can receive personal data or customer-controlled Commercial Memory, plus operational tools explicitly kept outside that data path.

> This register is an engineering/accountability baseline. It does not replace professional legal review, a signed DPA, a Transfer Impact Assessment (TIA), or vendor-specific contractual evidence.

## Decision rules

A provider is not treated as approved merely because it publishes GDPR documentation. LR6 separates:

- **approved-baseline** — current architecture and published contractual safeguards are compatible with the declared use, subject to retaining account-specific evidence;
- **approved-with-transfer** — a third-country transfer exists and is documented; transfer-risk assessment/remediation can still be required;
- **conditional** — a material account-level contractual or configuration fact is still unverified;
- **blocked-for-customer-personal-data** — customer personal data must not use this path at commercial launch until the named gate is closed;
- **operational-only** — tool is outside the customer-data production path by policy.

## Production evidence snapshot

| Provider | Production evidence | LR6 decision |
| --- | --- | --- |
| Supabase | Project `steel-sales-ai` is ACTIVE_HEALTHY in `eu-west-3` (Paris). | approved-baseline |
| Vercel | Production project/deployment READY. Current connector cannot verify the account plan/team contractual entitlement. | conditional |
| Railway | Commercial Memory worker is deployed in region `sfo` (United States). | approved-with-transfer |
| Resend | `smartsteelsales.com` verified; send region `eu-west-1`; receiving disabled; open/click tracking disabled. | approved-with-transfer |
| Google Analytics 4 | Application loads GA4 only after explicit statistics consent; production property retention cannot be read from current tooling. | conditional |
| Hugging Face Inference Providers | Worker has HF/RAG provider configuration and supports routed/provider-specific inference; actual production values are connector-redacted. | blocked-for-customer-personal-data |
| GitHub | Source/CI only. | operational-only |
| Notion | Product/business/legal documentation only. | operational-only |

## Provider register

### LR6-P01 — Supabase

**Purpose:** PostgreSQL, Auth, Storage, Edge Functions.  
**Production location:** project region `eu-west-3`, Paris.  
**Role:** processor/subprocessor depending on whether Smart Steel Sales is controller or processor for the relevant dataset.  
**Transfer posture:** primary project region is in the EEA; provider/subprocessor access can still occur outside the selected region where required to provide/support the service.  
**Contractual baseline:** published DPA; EU SCC Module 2 or Module 3 as applicable; published subprocessor list and change process.  
**Decision:** **approved-baseline**.

Required evidence/actions:
- retain the DPA version applicable to the production account;
- subscribe to subprocessor-change notices;
- reassess optional support/features that can move or expose customer content outside the selected region.

Official references:
- https://supabase.com/legal/customer-resources/data-processing-addendum
- https://supabase.com/legal/customer-resources/subprocessor-list

### LR6-P02 — Vercel

**Purpose:** Next.js hosting, server-side web runtime and edge/network delivery.  
**Production evidence:** project deployment READY.  
**Location:** Vercel's DPA describes primary processing facilities in the United States and globally distributed cloud infrastructure.  
**Contractual baseline:** Vercel DPA and SCC mechanisms where applicable.  
**Decision:** **conditional**.

Material blocker:
- the current Vercel DPA states it applies to Enterprise and Pro plans;
- current connector authorization cannot verify the production team's plan;
- therefore commercial-launch reliance on the DPA remains open until the plan/contract is confirmed and evidence retained.

Official references:
- https://vercel.com/legal/dpa
- https://security.vercel.com

### LR6-P03 — Railway

**Purpose:** FastAPI ingestion/parsing worker and Commercial Memory processing.  
**Production location:** current successful deployment is in `sfo`, United States.  
**Role:** processor/subprocessor depending on the tenant-controller context.  
**Transfer posture:** **real EEA → United States processing path** for tenant-uploaded content processed by the worker.  
**Contractual baseline:** Railway DPA, SCCs and available adequacy/DPF mechanisms as applicable.  
**Decision:** **approved-with-transfer**, but a TIA/remediation gate remains before paid onboarding.

Required actions:
- complete a documented Transfer Impact Assessment for Commercial Memory;
- evaluate moving the worker to an EU region before paid onboarding;
- retain the applicable DPA and subprocessor evidence.

Official references:
- https://railway.com/legal/dpa
- https://trust.railway.com/

### LR6-P04 — Resend

**Purpose:** transactional authentication/verification and team-invitation email through Supabase Custom SMTP.  
**Production configuration:** domain verified; sending region `eu-west-1`; receiving disabled; open tracking disabled; click tracking disabled.  
**Location:** EU sending region does not equal EU-only storage; Resend states stored data is held in the United States.  
**Contractual baseline:** DPA incorporating SCCs; Resend also documents EU-U.S. Data Privacy Framework participation.  
**Retention baseline:** Resend documents 30-day email/log retention on Free/Pro/Scale plans, 7-day backups and remaining customer-data deletion within 90 days after termination.  
**Decision:** **approved-with-transfer**.

Required action:
- download/retain the signed/pre-signed account DPA as contractual evidence.

Official references:
- https://resend.com/legal/dpa
- https://resend.com/legal/subprocessors
- https://resend.com/security/gdpr

### LR6-P05 — Google Analytics 4

**Purpose:** consent-gated analytics on approved public acquisition surfaces.  
**Application controls:** zero GA4 before consent, private routes excluded, no Smart Steel Sales user/organization identifier intentionally sent.  
**Role/transfer:** Google Analytics customer data is processed under Google's Analytics terms; international transfers can occur and Google documents applicable DPF/SCC mechanisms.  
**Retention baseline:** standard GA4 user/event retention supports a 2-month minimum; Smart Steel Sales policy target is **2 months**.  
**Decision:** **conditional**.

Required actions:
- verify the production GA4 property is actually configured to 2 months;
- keep advertising/data-sharing integrations off unless separately assessed and consented;
- retain evidence of the applicable Google processing terms.

Official references:
- https://support.google.com/analytics/answer/3379636
- https://support.google.com/analytics/answer/6004245
- https://support.google.com/analytics/answer/7667196
- https://business.safety.google/adsdatatransfers/

### LR6-P06 — Hugging Face Inference Providers

**Purpose:** external embedding and grounded RAG inference from worker-selected Commercial Memory evidence.  
**Production evidence:** Railway has `HF_TOKEN`, `RAG_INFERENCE_PROVIDER`, and `RAG_LLM_MODEL`; values are not readable through the current OAuth connector. Worker code permits provider-specific or automatic routing.  
**Material risk:** Hugging Face documents that routed inference can use third-party inference providers, and the downstream provider's own data/security terms can apply.  
**Location/DPA:** unresolved for the actual production route. The dedicated Inference Endpoints product has a different enterprise/privacy posture and does not prove the current routed-provider chain.  
**Decision:** **blocked-for-customer-personal-data** for commercial production.

Required actions before processing customer personal data through external AI:
1. pin the exact production inference provider;
2. verify its processing location;
3. establish DPA/subprocessor chain and transfer mechanism;
4. complete a TIA where required;
5. prefer an EU-hosted or otherwise contractually controlled inference route for Commercial Memory.

Official references:
- https://huggingface.co/docs/inference-providers/en/security
- https://huggingface.co/docs/inference-providers/en/index
- https://huggingface.co/docs/inference-endpoints/security

### LR6-P07 — GitHub

**Purpose:** source control and CI/CD.  
**Decision:** **operational-only**.

Policy boundary:
- no production Commercial Memory or exported customer datasets in repository fixtures;
- secret scanning / tracked-secret gate remains mandatory;
- reassess the vendor role if production personal data is intentionally introduced.

Reference:
- https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement

### LR6-P08 — Notion

**Purpose:** internal Product & Business OS and legal-readiness documentation.  
**Decision:** **operational-only**.

Policy boundary:
- customer documents, inbox content, Commercial Memory exports and account-data exports must not be copied into the project workspace as normal operations;
- reassess processor/DPA posture if that boundary changes.

Reference:
- https://www.notion.so/help/security-and-privacy

## Commercial-launch gates created by LR6

LR6 establishes the register, but it intentionally leaves these gates visible:

1. **AI inference — BLOCKER:** no customer personal data through Hugging Face routed inference until exact provider/location/DPA/transfer path is approved.
2. **Railway Commercial Memory — TRANSFER REVIEW:** current worker is US-based; complete TIA and evaluate EU migration.
3. **Vercel — CONTRACT EVIDENCE:** confirm the production plan is covered by the current DPA and retain evidence.
4. **GA4 — CONFIG EVIDENCE:** verify 2-month user/event retention in the production property.
5. **Resend — DPA EVIDENCE:** retain signed/pre-signed DPA copy.
6. **Vendor change control:** subscribe to or otherwise monitor subprocessor changes for active processors.

## Exit criteria for the LR6 baseline

- [x] active production processors/providers inventoried;
- [x] production regions captured where technically observable;
- [x] DPA/transfer mechanisms mapped to official provider sources;
- [x] subprocessors/change-control requirement recorded;
- [x] provider retention statements reconciled with LR3.2;
- [x] public processor/transfer transparency surface implemented;
- [x] unresolved AI provider path fails closed for commercial personal data;
- [x] operational tools separated from the customer-data path;
- [ ] Vercel plan/DPA entitlement evidence retained;
- [ ] GA4 production retention setting verified at 2 months;
- [ ] Railway Commercial Memory TIA completed / EU migration decision recorded;
- [ ] Resend DPA evidence retained;
- [ ] AI inference provider pinned and approved before commercial customer personal-data use.

The unchecked items are **commercial launch gates**, not missing register fields. The LR6 register baseline can therefore be complete while paid onboarding remains blocked on these evidence/remediation items.
