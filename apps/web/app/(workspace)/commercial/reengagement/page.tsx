import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { appRoutes } from "@/lib/routes";

import { loadReengagementSignals, type ReengagementEvidence } from "./actions";

export const dynamic = "force-dynamic";

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

function reasonLabel(reason: string) {
  if (reason === "historical_orders") return "Ordini storici";
  if (reason === "historical_offers") return "Offerte storiche";
  if (reason === "historical_rfqs") return "RFQ storiche";
  if (reason === "inactive_dormant_threshold") return "Inattiva oltre soglia dormant";
  if (reason === "inactive_watch_threshold") return "Inattiva oltre soglia watch";
  return reason;
}

function evidenceHref(evidence: ReengagementEvidence | null) {
  if (!evidence) return null;
  if (evidence.event_type === "rfq") return appRoutes.commercial.rfq(evidence.event_id);
  if (evidence.event_type === "offer") return appRoutes.commercial.offer(evidence.event_id);
  if (evidence.event_type === "order") return appRoutes.commercial.order(evidence.event_id);
  return appRoutes.commercial.conversation(evidence.event_id);
}

function evidenceLabel(evidence: ReengagementEvidence | null) {
  if (!evidence) return "Nessuna evidenza";
  if (evidence.event_type === "rfq") return "Ultima RFQ";
  if (evidence.event_type === "offer") return "Ultima offerta";
  if (evidence.event_type === "order") return "Ultimo ordine";
  return "Ultima conversazione";
}

export default async function ReengagementPage() {
  const payload = await loadReengagementSignals();

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3c8192]">
          Commercial Intelligence
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0b171e]">
          Riattivazione commerciale
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Relazioni commerciali verificate con storico reale ma senza attività recente.
          I segnali sono deterministici e spiegabili: nessun punteggio predittivo e nessun dato esterno.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Da valutare", payload.summary.total],
          ["Dormant", payload.summary.dormant],
          ["Watch", payload.summary.watch],
          ["Con ordini storici", payload.summary.with_order_history],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent>
              <p className="text-2xl font-semibold text-[#0b171e]">{String(value)}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {label}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-[#3c8192]/20 bg-[#eef5f6]">
        <CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-[#17343f]">Policy esplicita</p>
            <p className="mt-1 text-sm leading-6 text-[#45636d]">
              Watch dopo {payload.policy.watch_after_days} giorni · Dormant dopo{" "}
              {payload.policy.dormant_after_days} giorni · solo Company verificate con storico normalizzato.
            </p>
          </div>
          <Badge tone="blue">No predictive score</Badge>
        </CardContent>
      </Card>

      {payload.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {payload.error}
        </div>
      ) : payload.signals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-base font-semibold text-[#0b171e]">
              Nessuna relazione da riattivare con le soglie attuali
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Per generare un segnale servono una Company verificata, attività commerciale normalizzata
              e almeno {payload.policy.watch_after_days} giorni senza nuova attività. Il workspace live non
              crea segnali sintetici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4">
          {payload.signals.map((signal) => {
            const evidence = evidenceHref(signal.latest_evidence);
            return (
              <Card key={signal.company_id}>
                <CardContent>
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={signal.signal_state === "dormant" ? "red" : "amber"}>
                          {signal.signal_state === "dormant" ? "Dormant" : "Watch"}
                        </Badge>
                        {signal.has_order_history ? <Badge tone="green">Ordini storici</Badge> : null}
                        {signal.company_type ? <Badge tone="neutral">{signal.company_type}</Badge> : null}
                      </div>
                      <Link
                        href={appRoutes.commercial.company(signal.company_id)}
                        className="mt-3 block text-xl font-semibold text-[#0b171e] hover:text-[#1b4c5d]"
                      >
                        {signal.name}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">
                        {[signal.country, signal.website].filter(Boolean).join(" · ") || "Dati essenziali non disponibili"}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {signal.reason_codes.map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                          >
                            {reasonLabel(reason)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 lg:min-w-52">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Inattività
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-[#0b171e]">
                        {signal.inactive_days} giorni
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Ultima attività {dateLabel(signal.last_activity_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-4">
                    {[
                      ["Conversazioni", signal.conversation_count],
                      ["RFQ", signal.rfq_count],
                      ["Offerte", signal.offer_count],
                      ["Ordini", signal.order_count],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-base font-semibold text-slate-900">{String(value)}</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      {evidenceLabel(signal.latest_evidence)} · {dateLabel(signal.latest_evidence?.event_at)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {evidence ? (
                        <Link
                          href={evidence}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#33454e] hover:bg-slate-50"
                        >
                          Apri evidenza
                        </Link>
                      ) : null}
                      <Link
                        href={appRoutes.commercial.company(signal.company_id)}
                        className="rounded-lg bg-[#1b4c5d] px-3 py-2 text-xs font-semibold text-white hover:bg-[#163f4d]"
                      >
                        Apri Company 360
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
