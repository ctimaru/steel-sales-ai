import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { loadRelationshipGapOfferRecoveryAudit } from "./actions";
import { OfferRecoveryButton } from "./offer-recovery-button";

export default async function OfferRecoveryPage() {
  const result = await loadRelationshipGapOfferRecoveryAudit();
  const data = result.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href="/review/relationships" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
          ← Relationship readiness
        </Link>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
          PA2.25 · Relationship Gap Audit & Offer Normalization Recovery
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Offer recovery controllato
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          PA2.17 resta invariato. Questa recovery promuove un sottoinsieme solo quando ogni riga Offer incompleta
          è un duplicato shadow di una riga completa con la stessa identità prodotto e quantità. Nessun prodotto
          unico incompleto può essere escluso automaticamente.
        </p>
        <Link href="/review/offer-remediation" className="mt-3 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-800">
          Apri Offer Evidence Remediation →
        </Link>
      </div>

      {result.error || !data ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {result.error ?? "Audit Offer recovery non disponibile."}
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <p className="text-xs text-slate-400">RFQ normalizzate</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.relationship_gap.rfq_total}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Order normalizzati</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.relationship_gap.order_total}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Offer normalizzate</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.relationship_gap.normalized_offer_total}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">RFQ↔Order same Conversation</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.relationship_gap.shared_conversation_pairs}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Same Conversation + exact product</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.relationship_gap.shared_conversation_exact_product_pairs}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <p className="text-xs text-slate-400">Offer observations</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.offer_gap.offered_observations}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Offer thread</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.offer_gap.offer_threads}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Complete observations</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.offer_gap.complete_observations}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Thread con complete line</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.offer_gap.threads_with_any_complete_line}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Safe recovery ready</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.offer_gap.safe_subset_recovery_ready}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Blocked recovery</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.offer_gap.blocked_recovery_threads}</p>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {data.candidates.map((candidate) => (
              <Card key={candidate.thread_id} className="p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={candidate.recovery_status === "ready" ? "green" : candidate.recovery_status === "already_recovered" ? "blue" : "neutral"}>
                        {candidate.recovery_status}
                      </Badge>
                      <Badge tone="neutral">{candidate.complete_count} complete</Badge>
                      <Badge tone="neutral">{candidate.incomplete_count} retained evidence</Badge>
                    </div>

                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {candidate.subject ?? candidate.thread_id}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{candidate.thread_id}</p>

                    {candidate.reasons.length > 0 ? (
                      <p className="mt-2 text-xs text-amber-700">{candidate.reasons.join(" · ")}</p>
                    ) : null}

                    {candidate.complete_lines.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {candidate.complete_lines.map((line) => (
                          <div key={line.observation_id} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                            <span className="font-semibold text-slate-900">#{line.observation_id}</span>{" "}
                            {line.quantity} {line.quantity_unit} · {line.price_value} {line.currency}/{line.price_unit}
                            <div className="mt-1 text-slate-500">{line.source_text}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {candidate.recovery_status === "ready" ? <OfferRecoveryButton candidate={candidate} /> : null}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
