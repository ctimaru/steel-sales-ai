import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { conversations } from "@/lib/demo-data";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversation = conversations[id as keyof typeof conversations];

  if (!conversation) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/explorer" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
        ← Commercial Explorer
      </Link>
      <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="green">{conversation.status}</Badge>
            <span className="text-xs text-slate-400">{conversation.company}</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {conversation.subject}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Thread commerciale ricostruito con provenienza per ogni osservazione.
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {conversation.events.map((event, index) => (
          <Card key={`${event.at}-${index}`}>
            <CardContent className="grid gap-5 lg:grid-cols-[150px_1fr_0.9fr]">
              <div>
                <Badge
                  tone={
                    event.role === "requested"
                      ? "blue"
                      : event.role === "offered"
                        ? "green"
                        : "violet"
                  }
                >
                  {event.role}
                </Badge>
                <p className="mt-3 text-xs leading-5 text-slate-400">{event.at}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                  {event.title}
                </p>
                <p className="mt-2 text-base font-semibold text-slate-950">{event.product}</p>
                <p className="mt-2 text-sm text-slate-600">{event.detail}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex justify-between gap-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Source text
                  </p>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {Math.round(event.confidence * 100)}%
                  </span>
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
