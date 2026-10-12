import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { loadOfferRemediationReadiness } from "./actions";
import { OfferRemediationButton } from "./offer-remediation-button";

function categoryLabel(category: string) {
  if (category === "direction_conflict") return "Direction conflict";
  if (category === "mixed_complete_unique_incomplete") return "Mixed scope";
  if (category === "product_identity_gap") return "Product identity gap";
  return "Source reparse required";
}

function actionLabel(action: string) {
  if (action === "manual_direction_review") return "Manual direction review";
  if (action === "manual_scope_review") return "Manual scope review";
  if (action === "product_identity_review") return "Product identity review";
  return "Source email reparse";
}

export default async function OfferRemediationPage() {
  const result = await loadOfferRemediationReadiness();
  const data = result.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <div className="flex flex-wrap gap-3">
          <Link href="/review/offer-recovery" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
            ← Offer recovery
          </Link>
          <Link href="/review/offer-reparse" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
            Candidate reparse →
          </Link>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
          PA2.26 · Offer Evidence Remediation Readiness
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Offer remediation queue
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Classifica i thread Offer ancora bloccati senza modificare le observation. PA2.17 e PA2.25 restano invariati:
          nessun prezzo, quantità, direzione o identità prodotto viene corretto automaticamente.
        </p>
      </div>

      {result.error || !data ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {result.error ?? "Offer remediation readiness non disponibile."}
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <p className="text-xs text-slate-400">Blocked thread</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.blocked_threads}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Direction conflict</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.direction_conflict}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Mixed scope</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.mixed_complete_unique_incomplete}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Product identity</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.product_identity_gap}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Source reparse</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.source_reparse_required}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Pending queue</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.queued_pending}</p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Price gap: {data.summary.price_gap_threads} · Currency gap: {data.summary.currency_gap_threads} ·
              Quantity gap: {data.summary.quantity_gap_threads} · Missing-field marker already present in extracted evidence:{" "}
              {data.summary.threads_with_explicit_missing_field_marker}. Quando questo valore è 0, il recovery deve ripartire dalla fonte email originale.
            </p>
          </Card>

          <div className="space-y-3">
            {data.candidates.map((candidate) => (
              <Card key={candidate.thread_id} className="p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={candidate.queue_status === "pending" ? "blue" : "neutral"}>
                        {candidate.queue_status === "pending" ? "queued" : categoryLabel(candidate.category)}
                      </Badge>
                      <Badge tone="neutral">{actionLabel(candidate.recommended_action)}</Badge>
                      <Badge tone="neutral">{candidate.observation_count} obs</Badge>
                    </div>

                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {candidate.subject ?? candidate.thread_id}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {candidate.source_filename ?? "Fonte non disponibile"} · {candidate.thread_id}
                    </p>

                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                      <span>Complete: {candidate.complete_count}</span>
                      <span>Direction issue: {candidate.direction_issue_count}</span>
                      <span>Product gap: {candidate.product_identity_gap_count}</span>
                      <span>Quantity gap: {candidate.quantity_gap_count}</span>
                      <span>Price gap: {candidate.price_gap_count}</span>
                      <span>Currency gap: {candidate.currency_gap_count}</span>
                    </div>
                  </div>

                  <OfferRemediationButton candidate={candidate} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
