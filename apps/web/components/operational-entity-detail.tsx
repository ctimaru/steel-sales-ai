import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { OperationalEntityData } from "@/lib/commercial-data";

function tone(kind: OperationalEntityData["kind"]) {
  if (kind === "rfq") return "blue" as const;
  if (kind === "offer") return "green" as const;
  return "violet" as const;
}

function label(kind: OperationalEntityData["kind"]) {
  if (kind === "rfq") return "RFQ";
  if (kind === "offer") return "Offer";
  return "Order";
}

export function OperationalEntityDetail({ entity }: { entity: OperationalEntityData }) {
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/explorer" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
        ← Commercial Explorer
      </Link>

      <div className="mt-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tone(entity.kind)}>{label(entity.kind)}</Badge>
            <Badge tone="neutral">{entity.status}</Badge>
            {entity.companyId ? (
              <Link
                href={`/customers/${entity.companyId}`}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                {entity.company} · Company 360 →
              </Link>
            ) : (
              <Badge tone="amber">Cliente non attribuito</Badge>
            )}
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {label(entity.kind)} · {entity.id.slice(0, 8)}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Entità commerciale normalizzata · {entity.occurredAt} · {entity.lines.length} righe.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {entity.relationshipLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400"
            >
              {link.label} →
            </Link>
          ))}
          {entity.conversationHref ? (
            <Link
              href={entity.conversationHref}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400"
            >
              {entity.conversationLabel} →
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {entity.metadata.map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-xs font-semibold text-slate-400">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        {entity.lines.map((line, index) => (
          <Card key={line.id}>
            <CardContent className="grid gap-5 lg:grid-cols-[80px_1.25fr_0.75fr_1fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Riga {index + 1}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  {Math.round(line.confidence * 100)}%
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-950">{line.product}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {line.grade} · {line.standard}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Quantità: <b>{line.quantity}</b> · Prezzo: <b>{line.price}</b>
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Disponibilità</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{line.availability}</p>
                <p className="mt-3 text-xs text-slate-400">Source observation</p>
                <p className="mt-1 text-xs font-semibold text-slate-700">
                  {line.sourceObservationId ?? "—"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Provenance
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {line.sourceFilename ?? "Fonte strutturata"}
                </p>
                <p className="mt-2 text-sm italic leading-6 text-slate-600">
                  {line.sourceText ? `“${line.sourceText}”` : "Nessun source text disponibile."}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
