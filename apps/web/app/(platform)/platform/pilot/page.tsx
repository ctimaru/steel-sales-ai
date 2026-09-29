import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import {
  getMarketplacePilotControl,
  getMarketplacePilotTelemetry,
  type PilotLatencyStats,
  type PilotParticipant,
  type PilotReadiness,
} from "@/lib/platform-pilot";

import {
  addMarketplacePilotParticipant,
  startMarketplacePilot,
  transitionMarketplacePilotParticipant,
} from "./actions";

function percentLabel(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function latencyLabel(stats: PilotLatencyStats) {
  if (!stats.samples || stats.p50_seconds == null) return "—";
  const seconds = Number(stats.p50_seconds);
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}g`;
}

const blockerLabels: Record<string, string> = {
  organization_onboarding_incomplete: "Onboarding Organization incompleto",
  no_active_organization_member: "Nessun utente attivo nell’Organization",
  network_company_link_required: "Collegamento Organization ↔ Company Profile mancante",
  network_profile_not_published: "Company Profile non pubblicato",
  network_profile_not_claimed: "Company Profile non claimed",
  supplier_product_scope_required: "Nessun prodotto supplier dichiarato",
  supplier_technical_scope_required: "Scope tecnico prodotto insufficiente per il matching",
};

function ReadinessBadge({ readiness }: { readiness: PilotReadiness }) {
  return (
    <span
      className={[
        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
        readiness.ready
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700",
      ].join(" ")}
    >
      {readiness.ready ? "Ready" : `${readiness.blockers.length} blocker`}
    </span>
  );
}

function ReadinessDetails({ readiness }: { readiness: PilotReadiness }) {
  return (
    <div className="mt-3 space-y-2 text-xs text-[#66736e]">
      <p>
        Membri attivi: <strong className="text-[#1d2824]">{readiness.active_members}</strong>
        {" · "}
        Profilo: <strong className="text-[#1d2824]">{readiness.network_company_name ?? "non collegato"}</strong>
      </p>
      {readiness.participant_role !== "buyer" ? (
        <p>
          Supplier scope: <strong className="text-[#1d2824]">{readiness.supplier_product_relationships}</strong>
          {" relazioni · "}
          <strong className="text-[#1d2824]">{readiness.technical_scope_products}</strong> prodotti con scope tecnico
        </p>
      ) : null}
      {readiness.blockers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {readiness.blockers.map((blocker) => (
            <span
              key={blocker}
              className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800"
            >
              {blockerLabels[blocker] ?? blocker}
            </span>
          ))}
        </div>
      ) : (
        <p className="font-medium text-emerald-700">
          Prerequisiti di attivazione soddisfatti.
        </p>
      )}
    </div>
  );
}

function ParticipantActions({ participant }: { participant: PilotParticipant }) {
  const readiness = participant.readiness;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {participant.status === "candidate" ? (
        <form action={transitionMarketplacePilotParticipant}>
          <input type="hidden" name="participant_id" value={participant.participant_id} />
          <button
            name="action"
            value="activate"
            disabled={!readiness.ready}
            className="rounded-xl bg-[#1a5144] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#b8c6c0]"
          >
            Attiva
          </button>
        </form>
      ) : null}
      {participant.status === "active" ? (
        <form action={transitionMarketplacePilotParticipant}>
          <input type="hidden" name="participant_id" value={participant.participant_id} />
          <button
            name="action"
            value="pause"
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
          >
            Pausa
          </button>
        </form>
      ) : null}
      {participant.status === "paused" ? (
        <form action={transitionMarketplacePilotParticipant}>
          <input type="hidden" name="participant_id" value={participant.participant_id} />
          <button
            name="action"
            value="resume"
            disabled={!readiness.ready}
            className="rounded-xl bg-[#1a5144] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#b8c6c0]"
          >
            Riattiva
          </button>
        </form>
      ) : null}
      {["candidate", "active", "paused"].includes(participant.status) ? (
        <>
          <form action={transitionMarketplacePilotParticipant}>
            <input type="hidden" name="participant_id" value={participant.participant_id} />
            <button
              name="action"
              value="complete"
              className="rounded-xl border border-[#cfe0d9] bg-white px-3 py-2 text-xs font-semibold text-[#1a5144]"
            >
              Completa
            </button>
          </form>
          <form action={transitionMarketplacePilotParticipant}>
            <input type="hidden" name="participant_id" value={participant.participant_id} />
            <button
              name="action"
              value="remove"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
            >
              Rimuovi
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}

export default async function PlatformPilotPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requirePlatformSuperadmin();
  const [control, telemetry, params] = await Promise.all([
    getMarketplacePilotControl(),
    getMarketplacePilotTelemetry(),
    searchParams,
  ]);

  const candidatesOutsideCohort = control.candidate_organizations.filter(
    (candidate) => !candidate.participant,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="platform-surface rounded-3xl p-6 sm:p-8">
        <p className="platform-kicker">P5.6A · Commercial Pilot</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#18263d] sm:text-4xl">
          Pilot Cohort &amp; Activation
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[#66736e]">
          Seleziona aziende reali, verifica readiness e attivale esplicitamente.
          Il cohort non crea usage sintetico, non claimma o verifica automaticamente
          i Company Profile e non sblocca singole opportunità. Un supplier attivo
          riceve soltanto l&apos;entitlement globale pilot già previsto da P5.3.
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

      {!control.run ? (
        <section className="rounded-2xl border border-[#dce2df] bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
            Kickoff controllato
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
            Apri la finestra P5.6
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
            L&apos;avvio crea soltanto la finestra di pilot e il ledger di controllo.
            Nessuna azienda viene attivata automaticamente.
          </p>
          <form
            action={startMarketplacePilot}
            className="mt-5 grid gap-4 lg:grid-cols-[1fr_260px_auto]"
          >
            <input
              name="label"
              defaultValue="P5.6 Commercial Pilot"
              className="h-11 rounded-xl border border-[#d7dfdb] px-3 text-sm"
            />
            <input
              name="planned_ends_at"
              type="date"
              defaultValue={new Date(Date.now() + 90 * 86400000)
                .toISOString()
                .slice(0, 10)}
              className="h-11 rounded-xl border border-[#d7dfdb] px-3 text-sm"
            />
            <button className="platform-primary h-11 rounded-xl px-5 text-sm font-semibold">
              Avvia pilot
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-[#dce2df] bg-white p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
                  {control.run.protocol_version} · attivo
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
                  {control.run.label}
                </h2>
                <p className="mt-2 text-sm text-[#66736e]">
                  Kickoff {new Date(control.run.started_at).toLocaleString("it-IT")}
                  {" · "}
                  finestra prevista fino al{" "}
                  {new Date(control.run.planned_ends_at).toLocaleDateString("it-IT")}.
                </p>
              </div>
              <span className="rounded-full bg-[#e1ece8] px-3 py-1.5 text-xs font-semibold text-[#173f35]">
                Cohort reale · no synthetic usage
              </span>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              ["Cohort", control.counts.total],
              ["Candidate", control.counts.candidates],
              ["Attive", control.counts.active],
              ["In pausa", control.counts.paused],
              ["Buyer attivi", control.counts.buyers],
              ["Supplier attivi", control.counts.suppliers],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-[#dce2df] bg-white p-4"
              >
                <p className="text-2xl font-semibold text-[#1d2824]">
                  {String(value)}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#66736e]">
                  {label}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-3xl border border-[#b8d2c8] bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
                  P5.6B · End-to-End Telemetry
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
                  Commercial funnel
                </h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-[#66736e]">
                  Gli eventi hard derivano dai ledger canonici Marketplace. L&apos;unico
                  segnale UX aggiunto è il primo open da notifica; non vengono copiati
                  titolo, linee tecniche, quantità, prezzi, messaggi, note o dati
                  Commercial Memory.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#e1ece8] px-3 py-1 text-[11px] font-semibold text-[#173f35]">
                  canonical ledgers
                </span>
                <span className="rounded-full bg-[#f2f4f3] px-3 py-1 text-[11px] font-semibold text-[#66736e]">
                  soft signal: opportunity open
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              {[
                ["Listing", telemetry.funnel.listings_published],
                ["Con match", telemetry.funnel.listings_with_match],
                ["Notifiche", telemetry.funnel.notifications_created],
                ["Lette", telemetry.funnel.notifications_read],
                ["Open", telemetry.funnel.opportunities_opened],
                ["Unlock", telemetry.funnel.unlocks],
                ["Response", telemetry.funnel.responses_submitted],
                ["Buyer engaged", telemetry.funnel.buyer_engaged_responses],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-[#e1e7e4] bg-[#f8faf9] p-4">
                  <p className="text-2xl font-semibold text-[#1d2824]">{String(value)}</p>
                  <p className="mt-1 text-[11px] font-semibold text-[#66736e]">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {[
                ["Listing → match", telemetry.funnel.listing_match_rate],
                ["Notification read", telemetry.funnel.notification_read_rate],
                ["Notification → open", telemetry.funnel.notification_to_open_rate],
                ["Open → unlock", telemetry.funnel.open_to_unlock_rate],
                ["Unlock → submit", telemetry.funnel.unlock_to_submit_rate],
                ["Submit → buyer", telemetry.funnel.submitted_to_buyer_engagement_rate],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-[#dce2df] p-3">
                  <p className="text-lg font-semibold text-[#173f35]">
                    {percentLabel(value as number | null)}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-[#66736e]">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8782]">
                P50 time-to-stage
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {[
                  ["Listing → match", telemetry.latencies.listing_to_first_match],
                  ["Match → read", telemetry.latencies.match_to_notification_read],
                  ["Notification → open", telemetry.latencies.notification_to_opportunity_open],
                  ["Open → unlock", telemetry.latencies.opportunity_open_to_unlock],
                  ["Unlock → draft", telemetry.latencies.unlock_to_draft_response],
                  ["Unlock → submit", telemetry.latencies.unlock_to_submitted_response],
                  ["Submit → buyer", telemetry.latencies.submitted_response_to_buyer_engagement],
                ].map(([label, stats]) => {
                  const metric = stats as PilotLatencyStats;
                  return (
                    <div key={String(label)} className="rounded-xl bg-[#f8faf9] p-3">
                      <p className="text-lg font-semibold text-[#1d2824]">{latencyLabel(metric)}</p>
                      <p className="mt-1 text-[11px] font-semibold text-[#66736e]">{String(label)}</p>
                      <p className="mt-1 text-[10px] text-[#87938e]">{metric.samples} sample</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#dce2df] p-4">
                <p className="text-2xl font-semibold text-[#1d2824]">
                  {telemetry.funnel.distinct_organizations}
                </p>
                <p className="mt-1 text-xs text-[#66736e]">Organization coinvolte</p>
              </div>
              <div className="rounded-xl border border-[#dce2df] p-4">
                <p className="text-2xl font-semibold text-[#1d2824]">
                  {telemetry.funnel.distinct_buyer_organizations}
                </p>
                <p className="mt-1 text-xs text-[#66736e]">Buyer con listing reali</p>
              </div>
              <div className="rounded-xl border border-[#dce2df] p-4">
                <p className="text-2xl font-semibold text-[#1d2824]">
                  {telemetry.funnel.distinct_supplier_organizations}
                </p>
                <p className="mt-1 text-xs text-[#66736e]">Supplier con attività reale</p>
              </div>
            </div>

            <div className="mt-7">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8782]">
                Participant telemetry
              </p>
              <div className="mt-3 overflow-x-auto rounded-2xl border border-[#e1e7e4]">
                <table className="min-w-[980px] w-full text-left text-xs">
                  <thead className="bg-[#f8faf9] text-[#66736e]">
                    <tr>
                      {["Organization","Ruolo","Listing","Notif.","Read","Open","Unlock","Draft","Submit","Buyer actions"].map((label) => (
                        <th key={label} className="px-3 py-3 font-semibold">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {telemetry.participants.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-5 text-[#87938e]">
                          Nessun partecipante pilot con telemetria disponibile.
                        </td>
                      </tr>
                    ) : telemetry.participants.map((item) => (
                      <tr key={item.participant_id} className="border-t border-[#eef2f0]">
                        <td className="px-3 py-3 font-semibold text-[#1d2824]">{item.organization_name}</td>
                        <td className="px-3 py-3 text-[#66736e]">{item.participant_role}</td>
                        <td className="px-3 py-3">{item.published_listings}</td>
                        <td className="px-3 py-3">{item.notifications_received}</td>
                        <td className="px-3 py-3">{item.notifications_read}</td>
                        <td className="px-3 py-3">{item.opportunities_opened}</td>
                        <td className="px-3 py-3">{item.unlocks}</td>
                        <td className="px-3 py-3">{item.response_drafts}</td>
                        <td className="px-3 py-3">{item.responses_submitted}</td>
                        <td className="px-3 py-3">{item.buyer_engagement_actions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-7">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8782]">
                Listing progression
              </p>
              <div className="mt-3 space-y-3">
                {telemetry.listings.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#d7dfdb] bg-[#f8faf9] p-4 text-sm text-[#66736e]">
                    Nessuna listing reale pubblicata durante una finestra di partecipazione buyer attiva.
                  </p>
                ) : telemetry.listings.map((item) => (
                  <article key={item.request_id} className="rounded-2xl border border-[#e1e7e4] bg-[#fbfcfb] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-[#1d2824]">{item.buyer_organization_name}</p>
                        <p className="mt-1 text-[11px] text-[#87938e]">
                          {item.visibility_mode} · {new Date(item.published_at).toLocaleString("it-IT")} · {item.request_id.slice(0, 8)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[#52615b]">
                        <span>match {item.matches}</span>
                        <span>notif {item.notifications_created}</span>
                        <span>open {item.opportunities_opened}</span>
                        <span>unlock {item.unlocks}</span>
                        <span>submit {item.responses_submitted}</span>
                        <span>buyer {item.buyer_engaged_responses}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
                Cohort
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
                Aziende selezionate
              </h2>
            </div>

            <div className="mt-5 space-y-3">
              {control.participants.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#d7dfdb] bg-[#f8faf9] p-5 text-sm text-[#66736e]">
                  Nessuna azienda selezionata. Il pilot è aperto ma il cohort reale è ancora vuoto.
                </p>
              ) : (
                control.participants.map((participant) => (
                  <article
                    key={participant.participant_id}
                    className="rounded-2xl border border-[#e1e7e4] bg-[#fbfcfb] p-5"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[#1d2824]">
                            {participant.organization_name}
                          </h3>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#66736e]">
                            {participant.participant_role}
                          </span>
                          <span className="rounded-full bg-[#edf2ef] px-2.5 py-1 text-[11px] font-semibold text-[#52615b]">
                            {participant.status}
                          </span>
                          <ReadinessBadge readiness={participant.readiness} />
                        </div>
                        <ReadinessDetails readiness={participant.readiness} />
                      </div>
                      <p className="text-xs text-[#87938e]">
                        activation cycle {participant.activation_cycle}
                      </p>
                    </div>
                    <ParticipantActions participant={participant} />
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
              Candidate pool
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
              Organization disponibili
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#66736e]">
              Aggiungere un&apos;azienda al cohort non equivale ad attivarla. I blocker
              restano visibili fino a onboarding, claim/link Network e scope tecnico sufficiente.
            </p>

            <div className="mt-5 space-y-3">
              {candidatesOutsideCohort.length === 0 ? (
                <p className="text-sm text-[#7a899d]">
                  Nessuna Organization esterna al cohort.
                </p>
              ) : (
                candidatesOutsideCohort.map((candidate) => (
                  <article
                    key={candidate.organization_id}
                    className="rounded-2xl border border-[#e1e7e4] p-5"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-[#1d2824]">
                          {candidate.organization_name}
                        </h3>
                        <p className="mt-1 text-xs text-[#87938e]">
                          {candidate.organization_slug} · onboarding {candidate.onboarding_status}
                        </p>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl bg-[#f8faf9] p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold uppercase tracking-wide text-[#66736e]">
                                Buyer readiness
                              </p>
                              <ReadinessBadge readiness={candidate.buyer_readiness} />
                            </div>
                            <ReadinessDetails readiness={candidate.buyer_readiness} />
                          </div>
                          <div className="rounded-xl bg-[#f8faf9] p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold uppercase tracking-wide text-[#66736e]">
                                Supplier readiness
                              </p>
                              <ReadinessBadge readiness={candidate.supplier_readiness} />
                            </div>
                            <ReadinessDetails readiness={candidate.supplier_readiness} />
                          </div>
                        </div>
                      </div>

                      <form
                        action={addMarketplacePilotParticipant}
                        className="flex w-full flex-col gap-2 xl:w-48"
                      >
                        <input
                          type="hidden"
                          name="organization_id"
                          value={candidate.organization_id}
                        />
                        <select
                          name="participant_role"
                          defaultValue="buyer"
                          className="h-10 rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
                        >
                          <option value="buyer">Buyer</option>
                          <option value="supplier">Supplier</option>
                          <option value="both">Buyer + Supplier</option>
                        </select>
                        <button className="rounded-xl bg-[#1a5144] px-3 py-2.5 text-xs font-semibold text-white">
                          Aggiungi al cohort
                        </button>
                      </form>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </>
      )}

      <section className="rounded-2xl border border-[#d9e8e2] bg-[#f3f7f5] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
          Guardrail P5.6A
        </p>
        <div className="mt-3 grid gap-3 text-sm leading-6 text-[#52615b] md:grid-cols-2">
          <p>• nessun dato Commercial Memory viene esposto nella Pilot Control Room;</p>
          <p>• nessun Company Profile viene claimed o verified automaticamente;</p>
          <p>• supplier activation concede marketplace_access di tipo pilot, non unlock specifici;</p>
          <p>• pause/remove revocano l’entitlement pilot attraverso il ledger P5.3;</p>
          <p>• readiness viene ricalcolata a ogni activation/resume;</p>
          <p>• tutti i cambi cohort sono auditabili e il ledger eventi è append-only.</p>
        </div>
      </section>
    </div>
  );
}
