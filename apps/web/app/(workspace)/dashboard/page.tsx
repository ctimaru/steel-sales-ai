import Link from "next/link";

import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDashboardData } from "@/lib/commercial-data";

export default async function DashboardPage() {
  const { metrics, recent, mode } = await getDashboardData();

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold text-slate-500">M2 · Frontend MVP</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Dashboard commerciale
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            KPI e attività commerciale letti dalle superfici app-facing protette da RLS.
          </p>
        </div>
        <Link
          href="/explorer"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white"
        >
          Apri Commercial Explorer
        </Link>
      </div>

      {mode === "awaiting_assignment" ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Il dataset validato è già nelle tabelle app-facing, ma non è ancora assegnato a un utente Auth.
          I valori mostrati restano il riferimento validato finché non completiamo il primo accesso.
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Email archiviate" value={metrics.emails} note="Archivio Zimbra validato" />
        <KpiCard label="Thread ricostruiti" value={metrics.threads} note={`${metrics.messages} messaggi/segmenti ricostruiti`} />
        <KpiCard label="Osservazioni" value={metrics.observations.toLocaleString("it-IT")} note="Richieste, offerte, ordini e consegne" />
        <KpiCard label="Confidenza media" value={`${metrics.avgConfidence.toFixed(1)}%`} note={`${metrics.reviewFlags} record ancora in review`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Attività commerciale recente</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {mode === "live" ? "Dati live dal database." : "Riferimento validato del dataset."}
                </p>
              </div>
              <Link href="/explorer" className="text-xs font-semibold text-slate-700">Vedi tutto →</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.map((row) => (
              <Link
                href={`/conversations/${row.conversationId}`}
                key={row.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 transition hover:border-slate-300 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={row.role === "offered" ? "green" : row.role === "requested" ? "blue" : "violet"}>{row.role}</Badge>
                    <span className="text-xs text-slate-400">{row.date}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{row.product}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">{row.grade} · {row.standard} · {row.company}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-semibold text-slate-900">{row.price ?? "—"}</p>
                  <p className="mt-1 text-xs text-slate-400">{Math.round(row.confidence * 100)}% confidence</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Distribuzione item_role</h2>
            <p className="mt-1 text-xs text-slate-500">{metrics.observations.toLocaleString("it-IT")} osservazioni commerciali.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              ["Requested", metrics.requested, "bg-blue-500"],
              ["Offered", metrics.offered, "bg-emerald-500"],
              ["Ordered", metrics.ordered, "bg-violet-500"],
              ["Delivered", metrics.delivered, "bg-slate-600"],
            ].map(([label, value, color]) => {
              const numeric = Number(value);
              const width = metrics.observations ? `${(numeric / metrics.observations) * 100}%` : "0%";
              return (
                <div key={String(label)}>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">{label}</span>
                    <span className="text-slate-400">{numeric}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${color}`} style={{ width }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
