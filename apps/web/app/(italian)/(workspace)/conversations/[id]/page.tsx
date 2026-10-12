import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getConversationData } from "@/lib/commercial-data";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversation = await getConversationData(id);

  if (!conversation) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/explorer" className="text-xs font-semibold text-slate-500 hover:text-slate-900">← Commercial Explorer</Link>
      <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="green">{conversation.status}</Badge>
            {conversation.companyId ? (
              <Link
                href={`/customers/${conversation.companyId}`}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                {conversation.company} · Company 360 →
              </Link>
            ) : (
              <Badge tone="amber">Cliente non attribuito</Badge>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{conversation.subject}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Thread commerciale ricostruito con provenienza per ogni osservazione · {conversation.mode === "live" ? "live DB" : "demo"}.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Customer context</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              {conversation.companyId ? "Company normalizzata" : "Attribuzione cliente non risolta"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {conversation.companyId
                ? "Il collegamento deriva esclusivamente da Conversation / RFQ / Offer / Order normalizzati."
                : "Le osservazioni legacy restano evidenza del thread e non vengono usate per inferire il cliente."}
            </p>
          </div>
          <div className="flex gap-2 text-xs text-slate-500">
            <span>{conversation.normalized.rfqs} RFQ</span>
            <span>{conversation.normalized.offers} offerte</span>
            <span>{conversation.normalized.orders} ordini</span>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {conversation.events.map((event, index) => (
          <Card key={`${event.at}-${index}`}>
            <CardContent className="grid gap-5 lg:grid-cols-[150px_1fr_0.9fr]">
              <div>
                <Badge tone={event.role === "requested" ? "blue" : event.role === "offered" ? "green" : event.role === "ordered" ? "violet" : "neutral"}>{event.role}</Badge>
                <p className="mt-3 text-xs leading-5 text-slate-400">{event.at}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{event.title}</p>
                <p className="mt-2 text-base font-semibold text-slate-950">{event.product}</p>
                <p className="mt-2 text-sm text-slate-600">{event.detail}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex justify-between gap-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Source text</p>
                  <span className="text-[11px] font-semibold text-slate-500">{Math.round(event.confidence * 100)}%</span>
                </div>
                <p className="mt-2 text-sm italic leading-6 text-slate-600">“{event.source}”</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
