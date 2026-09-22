import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { loadNormalizationCoverage } from "./actions";
import { PromotionButton } from "./promotion-button";

const reasonLabels: Record<string,string> = {
  pending_review: "review pendente",
  low_confidence: "confidence bassa",
  missing_canonical_identity: "identità prodotto mancante",
  missing_quantity: "quantità mancante",
  missing_length: "lunghezza mancante",
  missing_source_text: "fonte mancante",
  multi_line_thread: "thread multi-riga",
  offer_promotion_not_enabled: "promozione Offer non ancora abilitata",
  order_promotion_not_enabled: "promozione Order non ancora abilitata",
};

export default async function NormalizationCoveragePage() {
  const result = await loadNormalizationCoverage();
  const data = result.data;

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div>
        <p className="text-sm font-semibold text-indigo-600">PA2.16 · Controlled RFQ promotion</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Copertura di normalizzazione</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Misura il passaggio dalle evidenze legacy alle entità RFQ, Offer e Order. Le RFQ ready possono essere promosse solo una alla volta, con azione esplicita e nuova validazione server-side.
        </p>
      </div>

      {result.error || !data ? (
        <Card className="border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{result.error ?? "Dati non disponibili."}</Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Copertura operativa", `${data.summary.coverage_pct}%`],
              ["Normalizzati", data.summary.normalized_total],
              ["Pronti", data.summary.ready],
              ["Da verificare", data.summary.needs_review],
              ["Bloccati", data.summary.blocked],
            ].map(([label,value]) => (
              <Card key={String(label)} className="p-4">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{typeof value === "number" ? value.toLocaleString("it-IT") : value}</p>
              </Card>
            ))}
          </section>

          <Card>
            <CardContent>
              <h2 className="font-semibold text-slate-950">Copertura per entità</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <p className="text-sm text-slate-600">RFQ <b>{data.summary.requested_normalized}/{data.summary.requested_total}</b></p>
                <p className="text-sm text-slate-600">Offer <b>{data.summary.offered_normalized}/{data.summary.offered_total}</b></p>
                <p className="text-sm text-slate-600">Order <b>{data.summary.ordered_normalized}/{data.summary.ordered_total}</b></p>
                <p className="text-sm text-slate-600">Delivery evidence <b>{data.summary.evidence_only}</b></p>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Offer e Order restano bloccati finché non esiste il relativo servizio di promozione controllata. Bulk auto-promotion: disabilitata.
              </p>
            </CardContent>
          </Card>

          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">Backlog controllato</h2>
                <p className="mt-1 text-xs text-slate-500">Prime {data.backlog.length} evidenze ordinate per azionabilità.</p>
              </div>
              <Link href="/review" className="text-xs font-semibold text-indigo-600">Apri correzioni →</Link>
            </div>
            {data.backlog.map((row) => (
              <Card key={row.observation_id} className="p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={row.backlog_status === "ready" ? "green" : row.backlog_status === "needs_review" ? "amber" : "neutral"}>
                        {row.backlog_status}
                      </Badge>
                      <Badge tone="neutral">{row.item_role}</Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{row.canonical_product_key ?? row.source_filename ?? `Observation #${row.observation_id}`}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{row.source_text ?? "—"}</p>
                  </div>
                  <div className="max-w-xl text-xs text-slate-500">
                    {row.reasons.length ? row.reasons.map((reason) => reasonLabels[reason] ?? reason).join(" · ") : "Pronta per il percorso di promozione controllata"}
                    {row.item_role === "requested" && row.backlog_status === "ready" ? (
                      <PromotionButton observationId={row.observation_id} />
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
