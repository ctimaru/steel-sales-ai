# NET-IT-RELEASEBULK1 — First 3 identity review packet

**8 November 2026** · [Protected PR #1214](https://github.com/ctimaru/steel-sales-ai/pull/1214)

The three companies in the read-only pilot have **first-party legal-name and corporate VAT evidence**. That evidence narrows the company-identity gate; it does **not** establish permission to reproduce copyrighted website content or attest publication rights.

| Company observed | VAT (first-party) | Identity | Industrial activity |
|---|---|---|---|
| Lazzari Srl | `04215390750` | [Official contacts](https://www.lazzarisrl.it/contatti/) | [Metalworking and urban furniture](https://www.lazzarisrl.it/chi-siamo-lazzari/) |
| Retissima Srl | `03738230139` | [Official contacts](https://www.retissima.it/contatti-2/) | [Fencing production](https://www.retissima.it/azienda/) |
| Sottile Srl | `00391480407` | [Official product page and footer](https://sottileserre.com/serre/serra-in-ferro-zincato/) | [Galvanized greenhouse tube Ø27×2](https://sottileserre.com/serre/serra-in-ferro-zincato/) |

**Missing approvals:** identity reconciliation requires a genuine Platform reviewer, and source-rights/usage scope must be reviewed and attested as a whole. No fictional permission or corporate identity has been signed on behalf of the companies. The SQL test workflow uses `example.invalid`-style synthetic companies only; no live records have been published.

## Practical rights review path

A compact claimable public profile should consist of independently written **factual metadata** (legal name, website, country and proposed industrial category with first-party source links), not copied site text, photographs, copyrighted product descriptions or scraped directories. Single facts and protected creative works/databases have different legal implications. Review restrictions, opt-outs, terms, privacy and the corporate identity before selecting an approved reuse scope; this is not a blanket legal clearance. Keep an audit record of the decision and source, and offer “Rivendica azienda → Arricchisci → Verifica”.

The existing publisher's `rights_decision` currently admits an explicit license or permitted reuse only; **do not fabricate** a `licensed` decision. A separate reviewed *factual-metadata-only* policy is a potential product change, subject to legal/Platform sign-off, rather than an assumed right.

**Action for operator:** review the corporate identity sources, choose the permitted scope, record a genuine decision + reference in the batch manifest, then preview with an authenticated Platform user. Until those fields are attested, pilot publication remains blocked.
