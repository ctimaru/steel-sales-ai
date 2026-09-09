import Link from "next/link";

import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDashboardData } from "@/lib/commercial-data";

function roleTone(role: string) {
  if (role === "offered") return "green" as const;
  if (role === "requested") return "blue" as const;
  if (role === "ordered") return "violet" as const;
  return "neutral" as const;
}

export default async function DashboardPage() {
  const { metrics, recent, mode } = await getDashboardData();
  const cleanRate = metrics.observations
    ? ((metrics.observations - metrics.reviewFlags) / metrics.observations) * 100
    : 100;

  const roleDistribution = [
    { label: "Richieste", key: "requested", value: metrics.requested, bar: "bg-sky-500" },
    { label: "Offerte", key: "offered", value: metrics.offered, bar: "bg-emerald-500" },
    { label: "Ordini", key: "ordered", value: metrics.ordered, bar: "bg-violet-500" },
    { label: "Consegne", key: "delivered", value: metrics.delivered, bar: "bg-slate-700" },
  ];

  return (
    <div className="mx-auto max-w-[1440px] space-y-7">
      <section className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
        <div className="grid gap-8 px-6 py-7 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end lg:px-9 lg:py-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Commercial Intelligence
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${mode === "live" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {mode === "live" ? "Live data" : "Preview data"}
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-[32px] font-semibold leading-[1.08] tracking-[-0.035em] text-slate-950 sm:text-[38px]">
              La memoria commerciale,
              <span className="text-slate-400"> pronta da interrogare.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-[13px] leading-6 text-slate-500">
              Richieste, offerte, ordini e consegne ricostruiti dall’archivio email con tracciabilità fino alla fonte.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Link
              href="/review"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Review Queue
              <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                {metrics.reviewFlags}
              </span>
            </Link>
            <Link
              href="/explorer"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0b1725] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#13283f]"
            >
              Apri Commercial Explorer
              <span className="ml-2 text-slate-400">→</span>
            </Link>
          </div>
        </div>

        <div className="grid border-t border-slate-100 bg-slate-50/60 sm:grid-cols-3">
          <div className="border-b border-slate-100 px-6 py-4 sm:border-b-0 sm:border-r sm:px-8">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Archivio</p>
            <p className="mt-1.5 text-xs font-semibold text-slate-700">
              {metrics.emails} email · {metrics.threads} thread
            </p>
          </div>
          <div className="border-b border-slate-100 px-6 py-4 sm:border-b-0 sm:border-r sm:px-8">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Parser</p>
            <p className="mt-1.5 text-xs font-semibold text-slate-700">
              v3.1 · {metrics.avgConfidence.toFixed(1)}% confidence media
            </p>
          </div>
          <div className="px-6 py-4 sm:px-8">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Qualità dati</p>
            <p className="mt-1.5 text-xs font-semibold text-slate-700">
              {cleanRate.toFixed(1)}% senza warning · {metrics.reviewFlags} review
            </p>
          </div>
        </div>
      </section>

      {mode === "awaiting_assignment" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3.5 text-xs leading-5 text-amber-900">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          <div>
            <span className="font-semibold">Dataset pronto.</span> Le tabelle app-facing sono già popolate; manca solo l’assegnazione al primo utente Supabase Auth per passare dalla preview alla lettura live.
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Email archiviate"
          value={metrics.emails}
          note={`${metrics.messages} messaggi e segmenti ricostruiti`}
        />
        <KpiCard
          label="Thread commerciali"
          value={metrics.threads}
          note="Conversazioni ricostruite e deduplicate"
        />
        <KpiCard
          label="Osservazioni"
          value={metrics.observations.toLocaleString("it-IT")}
          note="Prodotti, quantità, prezzi e disponibilità"
        />
        <KpiCard
          label="Confidence media"
          value={`${metrics.avgConfidence.toFixed(1)}%`}
          note={`${metrics.reviewFlags} warning residui da verificare`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <Card className="overflow-hidden border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.035)]">
          <CardHeader className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Timeline commerciale</p>
                <h2 className="mt-2 text-[17px] font-semibold tracking-tight text-slate-950">Attività recente</h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  {mode === "live" ? "Ultimi record disponibili nel database." : "Campione rappresentativo del dataset validato."}
                </p>
              </div>
              <Link href="/explorer" className="shrink-0 text-[11px] font-semibold text-slate-500 transition hover:text-slate-950">
                Vedi tutto →
              </Link>
            </div>
          </CardHeader>

          <div className="divide-y divide-slate-100">
            {recent.map((row) => (
              <Link
                href={`/conversations/${row.conversationId}`}
                key={row.id}
                className="grid gap-4 px-5 py-4 transition hover:bg-slate-50/80 sm:grid-cols-[minmax(0,1fr)_140px_110px] sm:items-center sm:px-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={roleTone(row.role)}>{row.role}</Badge>
                    {row.availability && row.availability !== "unknown" ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        {row.availability}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2.5 truncate text-[13px] font-semibold text-slate-900">{row.product}</p>
                  <p className="mt-1 truncate text-[10px] text-slate-400">
                    {row.grade} · {row.standard} · {row.company}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Prezzo</p>
                  <p className="mt-1.5 text-xs font-semibold text-slate-800">{row.price ?? "—"}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-[10px] text-slate-400">{row.date}</p>
                  <p className="mt-1.5 text-[10px] font-semibold text-slate-500">
                    {Math.round(row.confidence * 100)}% confidence
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.035)]">
            <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Dataset mix</p>
              <h2 className="mt-2 text-[17px] font-semibold tracking-tight text-slate-950">Flusso commerciale</h2>
            </CardHeader>
            <CardContent className="space-y-5 p-5 sm:p-6">
              {roleDistribution.map((item) => {
                const width = metrics.observations ? `${(item.value / metrics.observations) * 100}%` : "0%";
                return (
                  <div key={item.key}>
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-700">{item.label}</p>
                        <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-400">{item.key}</p>
                      </div>
                      <p className="text-sm font-semibold tracking-tight text-slate-900">{item.value}</p>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${item.bar}`} style={{ width }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-[#d8e3ee] bg-[#eef4f8] shadow-none">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#55718a]">Next focus</p>
                  <h3 className="mt-2 text-sm font-semibold text-[#17324d]">Commercial Explorer</h3>
                  <p className="mt-2 text-[11px] leading-5 text-[#5f7488]">
                    Cerca dimensioni, qualità e norme per ricostruire l’intero percorso richiesta → offerta → ordine.
                  </p>
                </div>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-sm font-semibold text-[#17324d] shadow-sm">→</span>
              </div>
              <Link
                href="/explorer"
                className="mt-4 inline-flex text-[11px] font-bold text-[#17324d] hover:underline"
              >
                Esplora lo storico commerciale
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
