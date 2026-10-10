import { GovernanceWorkspaceNav } from "@/components/governance-workspace-nav";
import Link from "next/link";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FirstUseEmptyState } from "@/components/first-use-empty-state";

import { getAdminCompanyClaimQueue } from "@/lib/company-claims";
import {
  getPlatformAccessContext,
  requirePlatformPermission,
} from "@/lib/platform-admin";

import { reviewCompanyClaim, reviewCompanyClaimProof } from "./actions";

const FILTERS = [
  ["all", "Tutti"],
  ["requested", "Richiesti"],
  ["under_review", "In revisione"],
  ["approved", "Approvati"],
  ["rejected", "Rifiutati"],
  ["revoked", "Revocati"],
] as const;

function proofLabel(method: string) {
  if (method === "authenticated_corporate_email") return "Email aziendale autenticata";
  if (method === "registration_bridge") return "Registration bridge";
  return "Revisione manuale";
}

function proofReferenceLabel(reference: string | null) {
  if (!reference) return null;
  if (reference.startsWith("shared_company_domain:")) {
    return "Dominio condiviso: " + reference.replace("shared_company_domain:", "");
  }
  if (reference.startsWith("email_domain:")) {
    return "Dominio email verificato: " + reference.replace("email_domain:", "");
  }
  return reference;
}

export default async function CompanyClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; message?: string; error?: string }>;
}) {
  await requirePlatformPermission("claims.read");
  const access = await getPlatformAccessContext();
  const permissions = access?.permissions ?? [];
  const canReviewProof = permissions.includes("claims.review_proof");
  const canApprove = permissions.includes("claims.approve");
  const canReject = permissions.includes("claims.reject");
  const canRevoke = permissions.includes("claims.revoke");
  const hasMutationAccess = canReviewProof || canApprove || canReject || canRevoke;
  const params = await searchParams;
  const activeStatus =
    params.status && params.status !== "all"
      ? params.status
      : null;
  const queue = await getAdminCompanyClaimQueue(activeStatus);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <GovernanceWorkspaceNav current="claims" permissions={access?.permissions ?? []} />
      <section className="platform-surface rounded-3xl p-6 sm:p-8">
        <p className="platform-kicker">P3.6 · Governance</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#18263d] sm:text-4xl">
          Company Claims
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66736e]">
          Verifica la prova di ownership e approva il controllo del profilo. Claim e
          Network verification restano separati: approvare un claim non rende
          automaticamente l&apos;azienda verificata.
        </p>
      </section>

      {params.message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {params.message}
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
          {params.error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Claim visualizzati", queue.total],
          ["Ownership da verificare", queue.proofPending],
          ["Ownership verificata", queue.proofVerified],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-2xl font-semibold text-[#1d2824]">{String(value)}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#8fa1a9]">
              {label}
            </p>
          </div>
        ))}
      </section>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtri claim">
        {FILTERS.map(([value, label]) => {
          const selected = (activeStatus ?? "all") === value;
          return (
            <Link
              key={value}
              href={value === "all" ? "/platform/company-claims" : `/platform/company-claims?status=${value}`}
              className={[
                "shrink-0 rounded-full border px-4 py-2.5 text-xs font-semibold",
                selected
                  ? "platform-selected-solid"
                  : "border-[#d7dfdb] bg-white text-[#43524c] hover:border-[#b8d2c8] hover:bg-[#f0f4f2] hover:text-[#1a5144]",
              ].join(" ")}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {!hasMutationAccess ? (
        <div className="rounded-2xl border border-[#d7dfdb] bg-[#f8fafd] p-4 text-sm text-[#66736e]">
          Accesso in sola lettura: puoi ispezionare claim e ownership proof, ma non modificarne lo stato.
        </div>
      ) : null}

      <section className="space-y-4">
        {queue.items.length === 0 ? (
          <FirstUseEmptyState
            eyebrow={activeStatus ? "Filtro senza risultati" : "Coda pulita"}
            title="Nessun claim in questa vista"
            description={
              activeStatus
                ? "Apri tutti i claim per verificare se ci sono richieste in altri stati."
                : "Le richieste di gestione dei Company Profile compariranno qui quando un’azienda avvia un claim."
            }
            primaryAction={{
              href: "/platform/company-claims",
              label: activeStatus ? "Mostra tutti i claim" : "Aggiorna la coda",
            }}
            secondaryAction={{
              href: "/platform/network-trust",
              label: "Apri Network Trust",
            }}
          />
        ) : (
          queue.items.map((claim) => (
            <article key={claim.claim_id} className="rounded-2xl border border-[#dce2df] bg-white p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#e1ece8] px-2.5 py-1 text-[11px] font-bold text-[#1a5144]">
                      {claim.status.replaceAll("_", " ")}
                    </span>
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-[11px] font-bold",
                        claim.proof_status === "verified"
                          ? "bg-emerald-50 text-emerald-700"
                          : claim.proof_status === "rejected"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-amber-50 text-amber-800",
                      ].join(" ")}
                    >
                      ownership {claim.proof_status}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-[#1d2824]">
                    {claim.company_legal_name}
                  </h2>
                  <p className="mt-1 text-sm text-[#66736e]">
                    {claim.organization_name}
                    {claim.website_domain ? ` · ${claim.website_domain}` : ""}
                  </p>
                  <p className="mt-2 text-xs text-[#87938e]">
                    Proof: {proofLabel(claim.proof_method)} · Network verification: {claim.verification_status}
                  </p>
                </div>
                <div className="text-xs text-[#87938e]">
                  {new Intl.DateTimeFormat("it-IT", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(claim.requested_at))}
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {claim.proof_status === "pending" && ["requested", "under_review"].includes(claim.status) && canReviewProof ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <p className="text-sm font-semibold text-amber-900">Ownership proof</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      Il dominio email non ha prodotto una verifica automatica. Controlla l&apos;evidenza prima di confermare.
                    </p>
                    <form action={reviewCompanyClaimProof} className="mt-3 space-y-2">
                      <input type="hidden" name="claim_id" value={claim.claim_id} />
                      <input
                        name="note"
                        placeholder="Nota verifica ownership"
                        className="h-10 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm outline-none"
                      />
                      <div className="flex gap-2">
                        <button name="decision" value="verified" className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
                          Conferma ownership
                        </button>
                        <ConfirmSubmitButton
                          name="decision"
                          value="rejected"
                          title="Rifiutare questa prova di ownership?"
                          description="La prova verrà marcata come rifiutata e non potrà più essere usata per approvare il claim corrente senza una nuova evidenza o revisione."
                          confirmLabel="Rifiuta prova"
                          pendingLabel="Rifiuto…"
                          className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Rifiuta prova
                        </ConfirmSubmitButton>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#dce2df] bg-[#f8fafd] p-4">
                    <p className="text-sm font-semibold text-[#34445c]">Ownership proof</p>
                    <p className="mt-1 text-xs leading-5 text-[#66736e]">
                      {proofLabel(claim.proof_method)} · {claim.proof_status}
                    </p>
                    {proofReferenceLabel(claim.proof_reference) ? (
                      <p className="mt-2 rounded-lg bg-white px-2.5 py-2 text-xs font-medium text-[#52615b]">
                        {proofReferenceLabel(claim.proof_reference)}
                      </p>
                    ) : null}
                    {claim.proof_review_note ? (
                      <p className="mt-2 text-xs leading-5 text-[#7a899d]">{claim.proof_review_note}</p>
                    ) : null}
                  </div>
                )}

                <div className="rounded-xl border border-[#dce2df] p-4">
                  <p className="text-sm font-semibold text-[#34445c]">Decisione claim</p>
                  <form action={reviewCompanyClaim} className="mt-3 space-y-2">
                    <input type="hidden" name="claim_id" value={claim.claim_id} />
                    <input
                      name="note"
                      placeholder="Nota decisione"
                      className="h-10 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm outline-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      {claim.status === "requested" && canReviewProof ? (
                        <button name="decision" value="under_review" className="rounded-xl border border-[#d7dfdb] bg-white px-3 py-2 text-xs font-semibold text-[#43524c]">
                          Prendi in revisione
                        </button>
                      ) : null}
                      {["requested", "under_review"].includes(claim.status) && claim.proof_status === "verified" && canApprove ? (
                        <button name="decision" value="approved" className="rounded-xl bg-[#1a5144] px-3 py-2 text-xs font-semibold text-white">
                          Approva claim
                        </button>
                      ) : null}
                      {["requested", "under_review"].includes(claim.status) && canReject ? (
                        <ConfirmSubmitButton
                          name="decision"
                          value="rejected"
                          title="Rifiutare questo company claim?"
                          description="La richiesta di controllo del profilo verrà chiusa come rifiutata. L’Organization non otterrà la gestione del profilo con questo claim."
                          confirmLabel="Rifiuta claim"
                          pendingLabel="Rifiuto…"
                          className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Rifiuta claim
                        </ConfirmSubmitButton>
                      ) : null}
                      {claim.status === "approved" && canRevoke ? (
                        <ConfirmSubmitButton
                          name="decision"
                          value="revoked"
                          title="Revocare il controllo di questo profilo?"
                          description="L’Organization perderà il diritto di gestire il profilo Network. La Network verification resta separata, ma il claim verrà chiuso come revocato."
                          confirmLabel="Revoca controllo"
                          pendingLabel="Revoca…"
                          className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Revoca controllo
                        </ConfirmSubmitButton>
                      ) : null}
                    </div>
                  </form>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
