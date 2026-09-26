import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { appRoutes } from "@/lib/routes";

import {
  loadDemandSignals,
  type DemandEvidence,
  type DemandQuantitySummary,
  type DemandSignal,
  type DemandWindow,
} from "./actions";

export const dynamic = "force-dynamic";

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

function numberLabel(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(Number(value));
}

function signalLabel(signal: DemandSignal) {
  return signal.signal_type === "multi_account"
    ? "Domanda multi-account"
    : "Domanda ripetuta account";
}

function evidenceQuantity(evidence: DemandEvidence) {
  if (evidence.requested_quantity === null || evidence.requested_quantity === undefined) return null;
  return `${numberLabel(evidence.requested_quantity)} ${evidence.quantity_unit ?? ""}`.trim();
}

function quantityLabel(summary: DemandQuantitySummary) {
  return `${numberLabel(summary.total_quantity)} ${summary.unit} · ${summary.line_count} ${summary.line_count === 1 ? "linea" : "linee"}`;
}

function windowHref(windowDays: DemandWindow) {
  return `${appRoutes.commercial.demand}?window=${windowDays}`;
}

export default async function DemandSignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const params = await searchParams;
  const windowDays: DemandWindow = params.window === "90" ? 90 : 30;
  const payload = await loadDemandSignals(windowDays);
  const summary = payload.summary;

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3c8192]">
            Commercial Intelligence
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0b171e]">
            Segnali di domanda
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Ripetizioni osservate nelle RFQ private del tuo workspace. Un singolo account resta
            account demand; solo più aziende indipendenti generano un segnale multi-account.
            Non è una stima di mercato.
          </p>
        </div>

        <div className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {([30, 90] as DemandWindow[]).map((value) => (
            <Link
              key={value}
              href={windowHref(value)}
              className={
                value === windowDays
                  ? "rounded-lg bg-[#1b4c5d] px-4 py-2 text-xs font-semibold text-white"
                  : "rounded-lg px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }
            >
              {value} giorni
            </Link>
          ))}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-2xl font-semibold text-[#0b171e]">{summary.signal_count}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Segnali
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-2xl font-semibold text-[#0b171e]">{summary.distinct_rfq_count}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              RFQ nella finestra
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-2xl font-semibold text-[#0b171e]">{summary.distinct_product_count}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Prodotti canonicalizzati
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-2xl font-semibold text-[#0b171e]">
              {summary.attributed_rfq_count}/{summary.distinct_rfq_count}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              RFQ attribuite a Company
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-[#3c8192]/20 bg-[#eef5f6]">
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">Policy deterministica</Badge>
              <Badge tone="neutral">{windowDays} giorni</Badge>
            </div>
            <p className="mt-3 text-sm font-semibold text-[#17343f]">
              Il segnale nasce solo da ripetizioni reali
            </p>
            <p className="mt-1 text-sm leading-6 text-[#45636d]">
              Account demand: almeno {payload.policy.repeated_account_min_distinct_rfqs} RFQ
              distinte per stessa Company e stesso prodotto. Multi-account demand: almeno{" "}
              {payload.policy.multi_account_min_distinct_companies} Company distinte sullo stesso
              prodotto. Nessun predictive score, benchmark cross-tenant o dato esterno.
            </p>
          </CardContent>
        </Card>

        <Card className={summary.unattributed_rfq_count > 0 ? "border-amber-200 bg-amber-50" : ""}>
          <CardContent>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Qualità attribuzione
            </p>
            <p className="mt-2 text-xl font-semibold text-[#0b171e]">
              {summary.unattributed_rfq_count} RFQ non attribuite
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Le RFQ senza Company restano nello storico normalizzato, ma non possono creare
              segnali account-based.
            </p>
            {summary.unattributed_rfq_count > 0 ? (
              <Link
                href={appRoutes.operations.reviewIdentities}
                className="mt-3 inline-flex text-xs font-semibold text-[#9a4e22]"
              >
                Apri revisione identità →
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {payload.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {payload.error}
        </div>
      ) : payload.signals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-base font-semibold text-[#0b171e]">
              Nessun segnale di domanda con evidenza sufficiente
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Nella finestra di {windowDays} giorni risultano {summary.normalized_line_count} linee
              RFQ canonicalizzate su {summary.distinct_product_count} prodotti, ma non ci sono ancora
              ripetizioni che superano le soglie. Il workspace live non crea segnali sintetici.
            </p>
            {summary.unattributed_rfq_count > 0 ? (
              <p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-slate-400">
                {summary.unattributed_rfq_count} RFQ non sono ancora attribuite a una Company:
                completare l&apos;identity review aumenterà la copertura dei segnali senza cambiare
                le soglie.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4">
          {payload.signals.map((signal) => (
            <Card key={`${signal.signal_type}-${signal.canonical_product_id}-${signal.company_id ?? "multi"}`}>
              <CardContent>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={signal.signal_type === "multi_account" ? "blue" : "amber"}>
                        {signalLabel(signal)}
                      </Badge>
                      <Badge tone="neutral">{signal.distinct_rfq_count} RFQ</Badge>
                      {signal.signal_type === "multi_account" ? (
                        <Badge tone="green">{signal.distinct_company_count} aziende</Badge>
                      ) : null}
                    </div>

                    <h2 className="mt-3 text-xl font-semibold text-[#0b171e]">
                      {signal.product_label}
                    </h2>
                    <p className="mt-1 max-w-3xl truncate font-mono text-[11px] text-slate-400">
                      {signal.canonical_product_key ?? signal.canonical_product_id}
                    </p>

                    {signal.signal_type === "repeated_account" && signal.company_name ? (
                      <div className="mt-4">
                        {signal.company_id ? (
                          <Link
                            href={appRoutes.commercial.company(signal.company_id)}
                            className="text-sm font-semibold text-[#1b4c5d] hover:underline"
                          >
                            {signal.company_name} → Company 360
                          </Link>
                        ) : (
                          <p className="text-sm font-semibold text-slate-700">{signal.company_name}</p>
                        )}
                      </div>
                    ) : signal.company_names.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {signal.company_names.map((name) => (
                          <span
                            key={name}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 lg:min-w-56">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Evidenza
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-[#0b171e]">
                      {signal.distinct_rfq_count} RFQ
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {dateLabel(signal.first_requested_at)} → {dateLabel(signal.latest_requested_at)}
                    </p>
                    <Link
                      href={appRoutes.commercial.product(signal.canonical_product_id)}
                      className="mt-3 inline-flex text-xs font-semibold text-[#1b4c5d]"
                    >
                      Apri Product 360 →
                    </Link>
                  </div>
                </div>

                {signal.quantity_summaries.length ? (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Quantità osservate · mai sommate tra unità diverse
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {signal.quantity_summaries.map((quantity) => (
                        <span
                          key={quantity.unit}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          {quantityLabel(quantity)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    RFQ che costituiscono il segnale
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {signal.evidence.map((evidence) => (
                      <Link
                        key={evidence.rfq_line_id}
                        href={appRoutes.commercial.rfq(evidence.rfq_id)}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-[#6e9eab] hover:bg-[#eef5f6]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#0b171e]">
                              {evidence.company_name ?? "Company non attribuita"}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {evidence.raw_spec_text ?? signal.product_label}
                            </p>
                          </div>
                          <span className="shrink-0 text-[11px] font-semibold text-[#3c8192]">
                            RFQ →
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
                          <span>{dateLabel(evidence.requested_at)}</span>
                          {evidence.requested_grade ? <span>{evidence.requested_grade}</span> : null}
                          {evidence.requested_standard ? <span>{evidence.requested_standard}</span> : null}
                          {evidenceQuantity(evidence) ? <span>{evidenceQuantity(evidence)}</span> : null}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
