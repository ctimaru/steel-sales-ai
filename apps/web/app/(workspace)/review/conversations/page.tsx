import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { loadConversationBackfillReadiness } from "./actions";
import { ConversationBackfillButton } from "./conversation-backfill-button";

function entityLabel(type: string) {
  if (type === "rfq") return "RFQ";
  if (type === "offer") return "Offer";
  return "Order";
}

function evidenceLabel(type: string) {
  return type === "source_message"
    ? "source_message_id → messages.conversation_id"
    : "source_observation.source_conversation_id → conversations.external_thread_id";
}

export default async function ConversationBackfillPage() {
  const result = await loadConversationBackfillReadiness();
  const data = result.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href="/review/relationships" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
          ← Relationship readiness
        </Link>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
          PA2.22 · Conversation Relationship Backfill Readiness
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Conversation backfill controllato
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Collega RFQ, Offer e Order a Conversation normalizzate solo tramite identità strutturate esatte.
          Nessuna inferenza da oggetto email, cliente, dominio, testo libero o somiglianza del thread legacy.
        </p>
      </div>

      {result.error || !data ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {result.error ?? "Readiness Conversation non disponibile."}
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-4 lg:grid-cols-7">
              <div>
                <p className="text-xs text-slate-400">Entità totali</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.entities_total}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Ready</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.ready}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Già collegate</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.already_linked}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Unresolved</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.unresolved}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">RFQ ready</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.rfq_ready}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Offer ready</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.offer_ready}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Order ready</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.order_ready}</p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Bulk auto-backfill: disabilitato · source_message exact: abilitato · source_conversation_id exact:
              abilitato · subject inference: disabilitata · email domain inference: disabilitata · free-text
              inference: disabilitata.
            </p>
          </Card>

          {data.candidates.length === 0 ? (
            <Card className="p-5">
              <Badge tone="neutral">0 ready</Badge>
              <p className="mt-3 text-sm font-semibold text-slate-900">
                Nessuna Conversation deterministica da collegare.
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Il sistema resta fail-closed finché non esiste una corrispondenza strutturata esatta.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.candidates.map((candidate) => (
                <Card key={`${candidate.entity_type}:${candidate.entity_id}`} className="p-5">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="green">ready</Badge>
                        <Badge tone="neutral">{entityLabel(candidate.entity_type)}</Badge>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-900">
                        {candidate.entity_id} → {candidate.candidate_conversation_id}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Evidence: {evidenceLabel(candidate.evidence_type)} · {candidate.line_count} linee
                      </p>
                    </div>
                    <ConversationBackfillButton candidate={candidate} />
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
