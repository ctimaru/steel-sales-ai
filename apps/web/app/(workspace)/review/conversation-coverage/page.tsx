import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { loadStructuredConversationCoverage } from "./actions";
import { ConversationExpansionButton } from "./conversation-expansion-button";

export default async function ConversationCoveragePage() {
  const result = await loadStructuredConversationCoverage();
  const data = result.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href="/review/conversations" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
          ← Conversation backfill
        </Link>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
          PA2.23 · Structured Conversation / Message Coverage Expansion
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Conversation coverage strutturata
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Normalizza un commercial thread in una Conversation usando esclusivamente source_conversation_id
          come external_thread_id. I Message non vengono sintetizzati: il legacy espone solo email_count aggregato.
        </p>
      </div>

      {result.error || !data ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {result.error ?? "Coverage Conversation non disponibile."}
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <p className="text-xs text-slate-400">Commercial thread</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.commercial_threads}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Conversation ready</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.conversation_ready}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Già normalizzate</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.conversation_already_normalized}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Conversation bloccate</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.conversation_blocked}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Message ready</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.message_ready}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Email legacy aggregate</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.source_email_count}</p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Identity: commercial_threads.source_conversation_id → conversations.external_thread_id · Company
              inference: disabilitata · Message synthesis: disabilitata · Bulk auto-expansion: disabilitata.
            </p>
          </Card>

          {data.candidates.length === 0 ? (
            <Card className="p-5">
              <Badge tone="neutral">0 ready</Badge>
              <p className="mt-3 text-sm font-semibold text-slate-900">
                Nessuna Conversation strutturata da creare.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.candidates.map((candidate) => (
                <Card key={candidate.commercial_thread_id} className="p-5">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="green">ready</Badge>
                        <Badge tone="neutral">{candidate.email_count} email aggregate</Badge>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-900">
                        {candidate.subject ?? candidate.commercial_thread_id}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {candidate.commercial_thread_id} → {candidate.source_conversation_id}
                      </p>
                    </div>
                    <ConversationExpansionButton candidate={candidate} />
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
