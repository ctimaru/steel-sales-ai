import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActiveInteractionPilot,
  getActiveOrganizationContext,
  getInteractionPilotSummary,
  getP5Readiness,
  type P5ReadinessCriterion,
} from "@/lib/network";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";

const labels: Record<string, { title: string; help: string }> = {
  multi_day_use: {
    title: "Uso multi-day",
    help: "Il Network viene usato in almeno 3 giorni distinti: evita di confondere una singola sessione con retention.",
  },
  profile_discovery: {
    title: "Discovery profili",
    help: "Almeno 10 Company Profile consultati dopo il kickoff Interaction.",
  },
  persistent_intent: {
    title: "Intent persistente",
    help: "Almeno 3 Save/Follow creati: interesse che sopravvive alla singola visita.",
  },
  b2b_inquiries: {
    title: "Inquiry B2B",
    help: "Almeno 2 inquiry reali inviate verso altre organizzazioni.",
  },
  recipient_engagement: {
    title: "Engagement destinatario",
    help: "Almeno una inquiry letta, risposta, rifiutata o chiusa dal destinatario.",
  },
};

function metric(actual: number, target: number, passed: boolean) {
  return (
    <div className={"rounded-2xl border p-4 " + (passed ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white")}>
      <p className="text-2xl font-semibold text-slate-950">
        {actual} <span className="text-xs font-medium text-slate-400">/ {target}</span>
      </p>
      <p className={"mt-2 text-xs font-bold " + (passed ? "text-emerald-700" : "text-slate-500")}>
        {passed ? "Evidenza raggiunta" : "Evidenza da raccogliere"}
      </p>
    </div>
  );
}

export default async function InteractionPilotReadinessPage() {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");

  const context = await getActiveOrganizationContext();
  if (!context) redirect("/network?error=Nessuna%20organization%20attiva");

  const [pilot, summary, readiness] = await Promise.all([
    getActiveInteractionPilot(context.organization_id),
    getInteractionPilotSummary(context.organization_id),
    getP5Readiness(context.organization_id),
  ]);

  if (!pilot || !summary || !readiness) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/network" className="text-sm font-semibold text-slate-500 hover:text-slate-950">
          ← Torna al Network
        </Link>
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-semibold text-amber-950">Interaction pilot non attivo</h1>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            La scorecard è disponibile solo dopo un kickoff separato del pilot Interaction.
          </p>
        </section>
      </div>
    );
  }

  const criteriaEntries = Object.entries(readiness.criteria) as Array<
    [keyof typeof readiness.criteria, P5ReadinessCriterion]
  >;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/network" className="text-sm font-semibold text-slate-500 hover:text-slate-950">
        ← Torna al Network
      </Link>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
          P4.8 · Interaction Pilot → P5 Readiness
        </p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Abbiamo evidenza sufficiente per progettare il primo RFQ pilot?
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Questa pagina misura l'utilità reale di Save, Follow e Inquiry. Non decide automaticamente di costruire P5:
              segnala solo quando il campione Interaction è abbastanza informativo per una decisione prodotto esplicita.
            </p>
          </div>
          <span className={
            "rounded-full px-3 py-1.5 text-xs font-bold " +
            (readiness.evidence_ready
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700")
          }>
            {readiness.evidence_ready
              ? "Evidence ready"
              : readiness.criteria_passed_count + "/" + readiness.criteria_total + " criteri"}
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {criteriaEntries.map(([key, criterion]) => (
            <div key={key}>
              {metric(criterion.actual, criterion.target, criterion.passed)}
              <p className="mt-3 text-sm font-semibold text-slate-900">{labels[key].title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{labels[key].help}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 lg:col-span-2">
          <p className="text-sm font-semibold text-slate-950">Pilot Interaction attivo</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Kickoff: {new Date(pilot.started_at).toLocaleString("it-IT")} · protocollo {pilot.protocol_version}.
            Tutte le metriche qui sotto ignorano attività precedente al kickoff.
          </p>
          <p className="mt-3 text-xs leading-5 text-indigo-800">
            Non vengono inseriti eventi sintetici. Le soglie sono un minimo informativo, non KPI da inseguire artificialmente.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Utenti attivi</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.active_users}</p>
          <p className="mt-2 text-xs text-slate-500">Utenti che hanno generato eventi Network dal kickoff.</p>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-slate-950">Funnel Interaction osservato</h2>
          <p className="mt-1 text-sm text-slate-500">
            Discovery → intent persistente → interazione B2B → risposta del destinatario.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Directory views", summary.directory_views],
            ["Profile views", summary.profile_views],
            ["Save creati", summary.saves_created],
            ["Follow creati", summary.follows_created],
            ["Activity feed open", summary.activity_feed_opens],
            ["Activity item open", summary.activity_item_opens],
            ["Inquiry inviate", summary.inquiries_submitted],
            ["Inquiry con engagement", summary.recipient_engaged_inquiries],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-2xl font-semibold text-slate-950">{String(value)}</p>
              <p className="mt-1 text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-950">Segnali qualitativi impliciti</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>
              <strong className="text-slate-900">Persistent intent:</strong>{" "}
              {summary.persistent_intent_signals} segnali Save + Follow.
            </p>
            <p>
              <strong className="text-slate-900">Breadth B2B:</strong>{" "}
              {summary.distinct_recipient_organizations} organizzazioni destinatarie distinte.
            </p>
            <p>
              <strong className="text-slate-900">Recipient engagement:</strong>{" "}
              {summary.recipient_engaged_inquiries} inquiry con un'azione del destinatario.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-950">Come leggere la readiness</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>
              <strong className="text-slate-900">Evidence ready</strong> significa soltanto che il pilot ha raccolto un campione minimo
              utile per decidere se progettare un RFQ pilot.
            </p>
            <p>
              Non implica automaticamente marketplace, matching, invite-to-quote o transaction services.
            </p>
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              Prima di P5 resta necessaria una decisione prodotto esplicita basata anche sulla qualità delle inquiry e sul feedback degli utenti.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
