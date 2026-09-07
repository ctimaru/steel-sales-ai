import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { reviewFlags } from "@/lib/demo-data";

export default function ReviewPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-slate-500">Data Quality</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Review Queue
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            I soli 3 warning residui del parser v3.1. Nessun blocker critico su negazioni,
            dimensioni 2D o grade conflicts.
          </p>
        </div>
        <Badge tone="amber">{reviewFlags.length} da verificare</Badge>
      </div>

      <div className="mt-7 space-y-4">
        {reviewFlags.map((flag) => (
          <Card key={flag.id}>
            <CardContent className="grid gap-5 lg:grid-cols-[1fr_1fr_180px] lg:items-center">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="amber">warning</Badge>
                  <Badge tone="neutral">{flag.status}</Badge>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-950">{flag.subject}</p>
                <p className="mt-1 text-sm text-slate-500">{flag.product}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Evidenza
                </p>
                <p className="mt-2 text-sm italic leading-6 text-slate-600">“{flag.source}”</p>
                <p className="mt-2 text-[11px] text-slate-400">{flag.inferred}</p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600">
                  {Math.round(flag.confidence * 100)}% confidence
                </div>
                <button
                  disabled
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white opacity-50"
                  title="Attivo dopo promozione app-facing"
                >
                  Conferma
                </button>
                <button
                  disabled
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 opacity-50"
                  title="Attivo dopo promozione app-facing"
                >
                  Correggi
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-5 text-xs leading-5 text-slate-400">
        Le azioni restano disabilitate nell’MVP visuale: verranno collegate a una superficie
        RLS app-facing, mai direttamente allo schema staging.
      </p>
    </div>
  );
}
