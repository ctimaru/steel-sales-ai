import Link from "next/link";

import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { getMarketplacePilotControl } from "@/lib/platform-pilot";
import {
  getPilotActivationGovernance,
  PILOT_ACTIVATION_KPIS,
} from "@/lib/pilot-activation-governance";
import { PILOT_E3_LIVE_AUTHORIZED, PILOT_E3_RECOVERY_EVIDENCE } from "@/lib/pilot-e3-authorization";
import { reviewPilotAdmission } from "./actions";

export const dynamic = "force-dynamic";

export default async function PilotActivationReadinessPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await requirePlatformSuperadmin();
  const [control, governance, params] = await Promise.all([
    getMarketplacePilotControl(),
    getPilotActivationGovernance(),
    searchParams,
  ]);
  const admissions = new Map(governance.admissions.map((admission) => [admission.organization_id, admission]));

  return (
    <main className="mx-auto max-w-7xl space-y-5 pb-12">
      <section className="rounded-3xl border border-[#cbdcd4] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1d624d]">PROD-NEXT1.E1 · Governance</p>
            <h1 className="mt-2 text-2xl font-semibold text-[#173c32] sm:text-3xl">Pilot Activation Readiness</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52625b]">
              Registro riservato delle aziende candidate, controllo delle versioni legali e preparazione
              degli indicatori. La verifica documentale richiede un controllo umano.
              Il pilot e la raccolta delle metriche reali restano disabilitati.
            </p>
          </div>
          <span role="status" className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
            NO-GO · LIVE OFF
          </span>
        </div>
        <Link href="/platform/pilot" className="mt-4 inline-flex text-sm font-semibold text-[#175640] underline underline-offset-4">
          Torna alla Pilot Control Room
        </Link>
      </section>

      {params.result === "saved" ? (
        <p role="status" className="rounded-xl border border-[#c6ded0] bg-[#f1f8f3] p-3 text-sm text-[#1d624d]">
          Registro aggiornato. L&apos;autorizzazione al pilot resta separata.
        </p>
      ) : null}
      {params.result === "blocked" || params.result === "invalid" ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Modifica non applicata: controllare la verifica documentale, i permessi e lo stato del partecipante.
        </p>
      ) : null}

      <section aria-labelledby="pilot-e3-recovery" className="rounded-3xl border border-[#d6e2da] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1d624d]">PROD-NEXT1.E3 · Recovery & Authorization</p>
            <h2 id="pilot-e3-recovery" className="mt-1 text-xl font-semibold text-[#173c32]">Prima la prova, poi il pilot</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#52625b]">
              Il ripristino sintetico in CI è un controllo tecnico, non dimostra il recupero del database
              produttivo né degli oggetti Storage. Nessuna autorizzazione viene dedotta automaticamente.
            </p>
          </div>
          <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
            {PILOT_E3_LIVE_AUTHORIZED ? "GO" : "NO-GO · evidenze da approvare"}
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PILOT_E3_RECOVERY_EVIDENCE.map((evidence, index) => (
            <div key={evidence.id} className="rounded-2xl border border-[#e0e9e3] bg-[#f7faf8] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#4b695b]">
                {String(index + 1).padStart(2, "0")} · {evidence.label}
              </p>
              <p className="mt-2 text-sm leading-5 text-[#365349]">{evidence.detail}</p>
              <p className="mt-3 border-t border-[#e2eae5] pt-2 text-xs font-semibold leading-5 text-amber-900">
                Da verificare: {evidence.proof}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#52625b]">
          <a href="https://github.com/ctimaru/steel-sales-ai/blob/main/docs/operations/prod-next1e3-recovery-and-pilot-authorization.md"
            target="_blank" rel="noopener noreferrer"
            className="font-semibold text-[#175640] underline underline-offset-4">
            Procedura e registro delle evidenze
          </a>
          <span>Il gate database resta indipendente da questo pannello e non ha un pulsante di attivazione.</span>
        </div>
      </section>

      <section aria-labelledby="pilot-five-kpis" className="rounded-3xl border border-[#dce5df] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="pilot-five-kpis" className="text-xl font-semibold text-[#173c32]">Attivazione commerciale · 5 metriche</h2>
          <span className="text-xs font-semibold text-[#6a7771]">Nessuna misura live disponibile</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-[#52625b]">
          Solo transizioni confermate dal server dopo gate legale e opt-in appropriato.
          I test sintetici non alimentano questi contatori. Il trattino indica dato non rilevato, non zero conversioni.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {PILOT_ACTIVATION_KPIS.map((metric, index) => (
            <div key={metric.event} className="rounded-2xl border border-[#dce8e0] bg-[#f7faf8] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#52625b]">
                {String(index + 1).padStart(2, "0")} · {metric.label}
              </p>
              <p className="mt-3 text-3xl font-semibold tabular-nums text-[#2b5948]">—</p>
              <p className="mt-2 text-xs leading-5 text-[#52625b]">{metric.definition}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="pilot-cohort" className="rounded-3xl border border-[#dce5df] bg-white p-5 sm:p-6">
        <h2 id="pilot-cohort" className="text-xl font-semibold text-[#173c32]">Registro aziende candidate</h2>
        <p className="mt-2 text-sm text-[#52625b]">
          Le candidate provengono dal cohort P5.6 esistente. Stato &quot;approvato&quot; non significa
          attivato: il gate globale impedisce nuove attivazioni sino al sign-off separato.
        </p>
        {control.participants.length === 0 ? (
          <p className="mt-4 rounded-xl bg-[#f6f8f7] p-4 text-sm text-[#52625b]">
            Nessuna azienda candidata. Il cohort reale rimane vuoto.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {control.participants.map((item) => {
              const admission = admissions.get(item.organization_id);
              const state = admission?.state ?? "non valutata";
              return (
                <article key={item.participant_id} className="rounded-2xl border border-[#dbe6df] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-[#183e33]">{item.organization_name}</h3>
                      <p className="text-xs text-[#596e63]">{item.participant_role} · P5.6: {item.status}</p>
                    </div>
                    <span className="rounded-full bg-[#eef2ef] px-3 py-1 text-xs font-semibold text-[#355b4e]">
                      Governance: {state}
                    </span>
                  </div>
                  {admission?.notice_version ? (
                    <p className="mt-2 text-xs text-[#52625b]">
                      Informativa {admission.notice_version} · Termini {admission.terms_version} · Base documentata {admission.legal_basis_reference}
                    </p>
                  ) : null}
                  {item.status === "active" ? (
                    <p className="mt-3 text-xs font-semibold text-amber-900">
                      Partecipante già attivo nel vecchio cohort: sospendere da P5.6 prima di revocare l'ammissione.
                    </p>
                  ) : null}
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <form action={reviewPilotAdmission} className="grid gap-2 rounded-xl bg-[#f5f8f6] p-3">
                      <input type="hidden" name="organization_id" value={item.organization_id} />
                      <label className="text-xs font-semibold text-[#244a3b]">Riferimento base giuridica verificata
                        <input required maxLength={120} name="basis_reference" placeholder="Riferimento interno approvato dal legale"
                          className="mt-1 w-full rounded-lg border border-[#c8dad0] bg-white px-3 py-2 text-sm text-[#173c32]" />
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-[#244a3b]">Versione informativa
                          <input required maxLength={80} name="notice_version" placeholder="Versione revisionata"
                            className="mt-1 w-full rounded-lg border border-[#c8dad0] bg-white px-3 py-2 text-sm text-[#173c32]" />
                        </label>
                        <label className="text-xs font-semibold text-[#244a3b]">Versione termini pilot
                          <input required maxLength={80} name="terms_version" placeholder="Versione firmata"
                            className="mt-1 w-full rounded-lg border border-[#c8dad0] bg-white px-3 py-2 text-sm text-[#173c32]" />
                        </label>
                      </div>
                      <button name="action" value="verify" className="min-h-10 rounded-lg bg-[#185241] px-4 text-sm font-semibold text-white">
                        Registra verifica documentale
                      </button>
                    </form>
                    <div className="grid content-start gap-2 rounded-xl border border-[#e0e8e2] p-3">
                      <p className="text-xs text-[#52625b]">Azioni riservate al Superadmin. Nessuna azione abilita tracking o attiva aziende.</p>
                      <div className="flex flex-wrap gap-2">
                        {([
                          ["review", "Riapri review"],
                          ["approve", "Approva ammissione"],
                          ["suspend", "Sospendi"],
                          ["withdraw", "Revoca"],
                        ] as const).map(([action, label]) => (
                          <form key={action} action={reviewPilotAdmission}>
                            <input type="hidden" name="organization_id" value={item.organization_id} />
                            <button name="action" value={action} disabled={action === "approve" && state !== "verified"}
                              className="min-h-10 rounded-lg border border-[#cbdcd4] bg-white px-3 text-xs font-semibold text-[#185241] disabled:cursor-not-allowed disabled:opacity-50">
                              {label}
                            </button>
                          </form>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <p className="text-xs leading-5 text-[#61746a]">
        Per il GO occorrono informativa e termini finali, verifica legale, DPA ove applicabile,
        autorizzazione aziendale, restore test, supporto e decisione del Founder. Questi
        prerequisiti non sono confermati da questo pannello.
      </p>
    </main>
  );
}
