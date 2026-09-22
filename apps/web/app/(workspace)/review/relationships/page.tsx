import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { loadRelationshipReadiness } from "./actions";
import { RelationshipActivationButton } from "./relationship-activation-button";

function relationshipLabel(type: string) {
  if (type === "offer_rfq") return "Offer → RFQ";
  if (type === "order_offer") return "Order → Offer";
  return "Order → RFQ";
}

export default async function RelationshipReviewPage() {
  const result = await loadRelationshipReadiness();
  const data = result.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href="/review/coverage" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
          ← Normalization coverage
        </Link>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
          PA2.21 · Operational Relationship Activation
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Relazioni operative controllate
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Una relazione viene proposta solo quando le due entità condividono una Conversation normalizzata,
          hanno lo stesso multiset di prodotti canonici e il candidato è univoco. Nessuna inferenza da cliente,
          dominio email, nome o somiglianza di thread legacy.
        </p>
      </div>

      {result.error || !data ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {result.error ?? "Readiness relazioni non disponibile."}
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">Ready totali</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.ready_total}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Offer → RFQ</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.offer_rfq_ready}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Order → Offer</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.order_offer_ready}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Order → RFQ</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.order_rfq_ready}</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Bulk auto-activation: disabilitata · shared normalized conversation: obbligatoria · exact product
              multiset: obbligatorio · candidato unico: obbligatorio.
            </p>
          </Card>

          {data.candidates.length === 0 ? (
            <Card className="p-5">
              <Badge tone="neutral">0 ready</Badge>
              <p className="mt-3 text-sm font-semibold text-slate-900">
                Nessuna relazione deterministica da attivare.
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Il sistema non forza collegamenti quando manca una Conversation normalizzata condivisa o quando
                la corrispondenza prodotto non è univoca.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.candidates.map((candidate) => (
                <Card
                  key={`${candidate.relationship_type}:${candidate.source_entity_id}:${candidate.target_entity_id}`}
                  className="p-5"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="green">ready</Badge>
                        <Badge tone="neutral">{relationshipLabel(candidate.relationship_type)}</Badge>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-900">
                        {candidate.source_entity_id} → {candidate.target_entity_id}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Evidence: {candidate.evidence_type} · Conversation {candidate.conversation_id}
                      </p>
                    </div>
                    <RelationshipActivationButton candidate={candidate} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
