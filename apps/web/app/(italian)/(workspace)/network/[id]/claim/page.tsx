import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requestNetworkClaim } from "@/app/(workspace)/network/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getCompanyClaimExperience } from "@/lib/company-claims";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

const ELIGIBILITY_COPY: Record<string, { title: string; body: string }> = {
  company_not_published: {
    title: "Profilo non disponibile per la gestione",
    body: "Il profilo deve essere pubblicato prima di poter avviare una richiesta di gestione.",
  },
  already_managed: {
    title: "Profilo già gestito dalla tua organizzazione",
    body: "La tua azienda ha già il controllo di questo profilo. Puoi aggiornare i dati dalla pagina di gestione.",
  },
  already_claimed: {
    title: "Profilo già rivendicato",
    body: "Questo profilo è già gestito da un’altra azienda. Se ritieni che il collegamento sia errato, contatta il team Smart Steel Sales.",
  },
  organization_already_controls_profile: {
    title: "La tua azienda gestisce già un altro profilo",
    body: "Ogni account aziendale può gestire una sola identità nel Network. Contatta il team Smart Steel Sales per verificare il collegamento esistente.",
  },
  claim_in_progress: {
    title: "Richiesta già in lavorazione",
    body: "Esiste già una richiesta attiva per questo profilo. Puoi seguirne lo stato qui senza inviarne una seconda.",
  },
};

function proofCopy(reason: string, profileCount: number) {
  if (reason === "unique_company_domain_match") {
    return {
      title: "Email aziendale riconosciuta",
      body: "La tua email è confermata e il dominio identifica un solo profilo nel Network. La prova del legame con l’azienda può essere verificata automaticamente; la richiesta di gestione resta soggetta all’approvazione della piattaforma.",
      tone: "emerald",
    };
  }

  if (reason === "company_domain_shared") {
    return {
      title: "Dominio aziendale condiviso",
      body: `Questo dominio è associato a ${profileCount} società nel Network. L’email indica il legame con il gruppo; il team verificherà quale società sei autorizzato a rappresentare.`,
      tone: "amber",
    };
  }

  if (reason === "email_domain_mismatch") {
    return {
      title: "Legame con l’azienda da verificare",
      body: "Il dominio della tua email non coincide con il dominio pubblico dell'azienda. La piattaforma verificherà manualmente la relazione.",
      tone: "amber",
    };
  }

  if (reason === "company_domain_missing") {
    return {
      title: "Legame con l’azienda da verificare",
      body: "Il profilo non dispone ancora di un dominio aziendale affidabile. Il team verificherà la tua autorizzazione a rappresentare l’azienda.",
      tone: "amber",
    };
  }

  if (reason === "email_not_confirmed") {
    return {
      title: "Email da confermare",
      body: "La tua email non risulta confermata. Puoi inviare la richiesta, ma il team dovrà verificare la tua autorizzazione a rappresentare l’azienda.",
      tone: "amber",
    };
  }

  return {
    title: "Legame con l’azienda da verificare",
    body: "Il team verificherà la tua autorizzazione a rappresentare l’azienda prima di assegnarti la gestione del profilo.",
    tone: "amber",
  };
}

function claimStatusLabel(status: string) {
  if (status === "requested") return "Richiesta inviata";
  if (status === "under_review") return "In revisione";
  if (status === "approved") return "Gestione del profilo approvata";
  if (status === "rejected") return "Richiesta non approvata";
  if (status === "revoked") return "Gestione del profilo revocata";
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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const query = await searchParams;
  const context = await requireWorkspaceAdmin("/company/profile");
  const experience = await getCompanyClaimExperience(id, context.organizationId);
  if (!experience) notFound();
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
          Gestione del profilo aziendale
        </p>
        <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight text-[#1d2824]">
          Richiedi la gestione di {displayName}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66736e]">
          Dopo l’approvazione potrai aggiornare le informazioni e i contatti della tua azienda
          visibili nel Network. Il claim non equivale alla verifica della società e non attribuisce il badge
          “Azienda verificata”.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#dce2df] bg-[#f7f9f8] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#87938e]">
              Profilo
            </p>
            <p className="mt-2 break-words text-sm font-semibold text-[#1d2824]">
              {experience.legal_name}
            </p>
            <p className="mt-1 break-words text-xs text-[#66736e]">
              {experience.country_code}
              {experience.website_domain ? " · " + experience.website_domain : ""}
            </p>
          </div>
          <div className="rounded-2xl border border-[#dce2df] bg-[#f7f9f8] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#87938e]">
              Account aziendale richiedente
            </p>
            <p className="mt-2 break-words text-sm font-semibold text-[#1d2824]">
              {experience.organization_name}
            </p>
            <p className="mt-1 text-xs text-[#66736e]">
              Accesso attivo · amministratore
            </p>
          </div>
          <div className="rounded-2xl border border-[#dce2df] bg-[#f7f9f8] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#87938e]">
              Verifica dell’azienda
            </p>
            <p className="mt-2 text-sm font-semibold text-[#1d2824]">
              {experience.verification_status === "verified" ? "Verificata" : "Non verificata"}
            </p>
            <p className="mt-1 text-xs text-[#66736e]">
              Distinta dal diritto di gestione.
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
                Legame con l’azienda: {currentClaim.proof_status === "verified" ? "verificato" : currentClaim.proof_status === "rejected" ? "prova non accettata" : "da verificare"}.
                {" "}Verifica dell’azienda: {experience.verification_status === "verified" ? "completata" : "non ancora completata"}.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#43524c] shadow-sm">
              {currentClaim.proof_method === "authenticated_corporate_email"
                ? "Email aziendale"
                : currentClaim.proof_method === "registration_bridge"
                  ? "Registrazione aziendale"
                  : "Revisione manuale"}
            </span>
          </div>

          {currentClaim.status === "approved" ? (
            <Link
              href="/company/profile"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white hover:bg-[#226657]"
            >
              Gestisci il profilo
            </Link>
          ) : null}
        </section>
      ) : null}

      {blocker ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-950">{blocker.title}</h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">{blocker.body}</p>
          {experience.eligibility_reason === "already_managed" && currentClaim?.status !== "approved" ? (
            <Link href="/company/profile" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white hover:bg-[#226657]">Gestisci il profilo</Link>
          ) : null}
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
              1 · Verifica del legame con l’azienda
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
              2 · Conferma la richiesta
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
              Richiedi il controllo del profilo
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Conferma di essere autorizzato a rappresentare l’azienda. Dopo l’invio puoi seguire
              lo stato della richiesta su questa pagina. La gestione del profilo sarà disponibile
              dopo l’approvazione.
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
                Invia richiesta di gestione
              </PendingSubmitButton>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}
