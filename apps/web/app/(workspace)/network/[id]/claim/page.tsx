import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requestNetworkClaim } from "@/app/(workspace)/network/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getCompanyClaimExperience } from "@/lib/company-claims";
import { getNetworkProfile } from "@/lib/network";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

const ELIGIBILITY_COPY: Record<string, { title: string; body: string }> = {
  company_not_published: {
    title: "Profilo non disponibile per il claim",
    body: "Il profilo deve essere pubblicato prima di poter avviare una richiesta di gestione.",
  },
  already_managed: {
    title: "Profilo già gestito dalla tua organizzazione",
    body: "La tua Organization ha già il controllo di questo profilo.",
  },
  already_claimed: {
    title: "Profilo già rivendicato",
    body: "Un'altra Organization controlla già questa identità Network. Non viene creata una seconda identità parallela.",
  },
  organization_already_controls_profile: {
    title: "La tua Organization controlla già un altro profilo",
    body: "Una Organization può controllare una sola identità Network attiva. Il caso richiede una revisione della relazione esistente.",
  },
  claim_in_progress: {
    title: "Claim già in lavorazione",
    body: "Esiste già una richiesta attiva per questo profilo. Puoi seguirne lo stato qui senza inviarne una seconda.",
  },
};

function proofCopy(reason: string, profileCount: number) {
  if (reason === "unique_company_domain_match") {
    return {
      title: "Ownership verificabile automaticamente",
      body: "La tua email è confermata e il dominio aziendale identifica un solo profilo Network. La prova di ownership potrà essere verificata automaticamente.",
      tone: "emerald",
    };
  }

  if (reason === "company_domain_shared") {
    return {
      title: "Dominio aziendale condiviso",
      body: `Questo dominio è associato a ${profileCount} entità legali nel Network. L'email dimostra l'affiliazione al gruppo, ma non basta a identificare la singola società: il claim passa in revisione manuale.`,
      tone: "amber",
    };
  }

  if (reason === "email_domain_mismatch") {
    return {
      title: "Revisione manuale ownership",
      body: "Il dominio della tua email non coincide con il dominio pubblico dell'azienda. La piattaforma verificherà manualmente la relazione.",
      tone: "amber",
    };
  }

  if (reason === "company_domain_missing") {
    return {
      title: "Revisione manuale ownership",
      body: "Il profilo non dispone ancora di un dominio aziendale affidabile. La prova di ownership verrà verificata manualmente.",
      tone: "amber",
    };
  }

  if (reason === "email_not_confirmed") {
    return {
      title: "Email da confermare",
      body: "La tua email non risulta confermata. Il claim può essere inviato, ma l'ownership richiederà revisione manuale.",
      tone: "amber",
    };
  }

  return {
    title: "Revisione manuale ownership",
    body: "La piattaforma verificherà la relazione tra la tua Organization e questa azienda prima di assegnare il controllo del profilo.",
    tone: "amber",
  };
}

function claimStatusLabel(status: string) {
  if (status === "requested") return "Richiesta inviata";
  if (status === "under_review") return "In revisione";
  if (status === "approved") return "Claim approvato";
  if (status === "rejected") return "Claim rifiutato";
  if (status === "revoked") return "Controllo revocato";
  return status;
}

export default async function ClaimCompanyProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");

  const { id } = await params;
  const query = await searchParams;
  const profile = await getNetworkProfile(id);
  if (!profile) notFound();

  const context = await requireWorkspaceAdmin("/network/" + id);
  const experience = await getCompanyClaimExperience(id, context.organizationId);
  const proof = proofCopy(
    experience.proof_reason,
    experience.company_domain_profile_count,
  );
  const currentClaim = experience.current_claim;
  const blocker =
    !experience.eligible && experience.eligibility_reason !== "eligible"
      ? ELIGIBILITY_COPY[experience.eligibility_reason]
      : null;
  const displayName = experience.trading_name || experience.legal_name;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <Link
        href={"/network/" + id}
        className="text-sm font-semibold text-[#66736e] hover:text-[#1a5144]"
      >
        ← Torna al profilo
      </Link>

      {query.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {query.error}
        </div>
      ) : null}
      {query.message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {query.message}
        </div>
      ) : null}

      <section className="rounded-3xl border border-[#dce2df] bg-white p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1a5144]">
          HP5 · Claim Company Profile
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
          Rivendica {displayName}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66736e]">
          Il claim assegna alla tua Organization il diritto di gestire il profilo pubblico.
          Non equivale alla verifica della società: lo stato “Azienda verificata” resta una
          decisione separata della piattaforma.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#dce2df] bg-[#f7f9f8] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#87938e]">
              Profilo
            </p>
            <p className="mt-2 text-sm font-semibold text-[#1d2824]">
              {experience.legal_name}
            </p>
            <p className="mt-1 text-xs text-[#66736e]">
              {experience.country_code}
              {experience.website_domain ? " · " + experience.website_domain : ""}
            </p>
          </div>
          <div className="rounded-2xl border border-[#dce2df] bg-[#f7f9f8] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#87938e]">
              Organization richiedente
            </p>
            <p className="mt-2 text-sm font-semibold text-[#1d2824]">
              {experience.organization_name}
            </p>
            <p className="mt-1 text-xs text-[#66736e]">
              Workspace attivo · ruolo Admin
            </p>
          </div>
          <div className="rounded-2xl border border-[#dce2df] bg-[#f7f9f8] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#87938e]">
              Network verification
            </p>
            <p className="mt-2 text-sm font-semibold text-[#1d2824]">
              {experience.verification_status === "verified" ? "Verificata" : "Non verificata"}
            </p>
            <p className="mt-1 text-xs text-[#66736e]">
              Stato indipendente dal claim.
            </p>
          </div>
        </div>
      </section>

      {currentClaim ? (
        <section className="rounded-3xl border border-[#d9e8e2] bg-[#f3f7f5] p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
                Stato richiesta
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
                {claimStatusLabel(currentClaim.status)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#66736e]">
                Ownership: {currentClaim.proof_status === "verified" ? "verificata" : currentClaim.proof_status === "rejected" ? "prova rifiutata" : "da verificare"}.
                {" "}Network verification: {experience.verification_status === "verified" ? "verificata" : "separata e non ancora verificata"}.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#43524c] shadow-sm">
              {currentClaim.proof_method === "authenticated_corporate_email"
                ? "Email aziendale"
                : currentClaim.proof_method === "registration_bridge"
                  ? "Registration bridge"
                  : "Revisione manuale"}
            </span>
          </div>

          {currentClaim.status === "approved" ? (
            <Link
              href="/network/manage"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white hover:bg-[#226657]"
            >
              Gestisci il profilo
            </Link>
          ) : null}
        </section>
      ) : null}

      {blocker && currentClaim?.status !== "rejected" && currentClaim?.status !== "revoked" ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-950">{blocker.title}</h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">{blocker.body}</p>
        </section>
      ) : null}

      {experience.eligible ? (
        <>
          <section
            className={[
              "rounded-3xl border p-6",
              proof.tone === "emerald"
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50",
            ].join(" ")}
          >
            <p
              className={[
                "text-[11px] font-bold uppercase tracking-[0.14em]",
                proof.tone === "emerald" ? "text-emerald-700" : "text-amber-800",
              ].join(" ")}
            >
              Step 1 · Ownership proof
            </p>
            <h2
              className={[
                "mt-2 text-xl font-semibold",
                proof.tone === "emerald" ? "text-emerald-950" : "text-amber-950",
              ].join(" ")}
            >
              {proof.title}
            </h2>
            <p
              className={[
                "mt-2 text-sm leading-6",
                proof.tone === "emerald" ? "text-emerald-800" : "text-amber-800",
              ].join(" ")}
            >
              {proof.body}
            </p>
          </section>

          <section className="rounded-3xl border border-[#dce2df] bg-white p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
              Step 2 · Conferma richiesta
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
              Richiedi il controllo del profilo
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              La piattaforma conserva distinta la prova di ownership dalla verifica dei dati
              aziendali. L’approvazione del claim abilita la gestione, non attribuisce il badge
              “Azienda verificata”.
            </p>

            <form action={requestNetworkClaim} className="mt-5 space-y-4">
              <input type="hidden" name="network_company_id" value={id} />
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#66736e]">
                  Nota opzionale
                </span>
                <textarea
                  name="note"
                  rows={4}
                  maxLength={2000}
                  placeholder="Indica ruolo, relazione con l'azienda o informazioni utili alla verifica."
                  className="mt-2 w-full rounded-2xl border border-[#d7dfdb] bg-white px-4 py-3 text-sm text-[#1d2824] outline-none focus:border-[#8fb8aa]"
                />
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-[#dce2df] bg-[#f7f9f8] p-4">
                <input
                  type="checkbox"
                  name="authority_confirmed"
                  value="true"
                  required
                  className="mt-1 h-4 w-4"
                />
                <span className="text-sm leading-6 text-[#52615b]">
                  Confermo di essere autorizzato a rappresentare questa azienda e a richiedere
                  la gestione del suo profilo su Smart Steel Sales.
                </span>
              </label>

              <PendingSubmitButton
                pendingLabel="Invio richiesta…"
                className="h-11 rounded-xl bg-[#1a5144] px-5 text-sm font-semibold text-white hover:bg-[#226657] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Invia richiesta di claim
              </PendingSubmitButton>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}
