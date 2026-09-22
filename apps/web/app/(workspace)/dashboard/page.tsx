import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDashboardData } from "@/lib/commercial-data";

function roleLabel(role: string) {
  if (role === "requested") return "Richiesta";
  if (role === "offered") return "Offerta";
  if (role === "ordered") return "Ordine";
  if (role === "delivered") return "Consegna";
  return role;
}

export default async function DashboardPage() {
  const { metrics, recent, mode, operational } = await getDashboardData();

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:p-9">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-indigo-600">Commercial Memory</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Prima di fare un prezzo, trova quello che la tua azienda sa già.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            Cerca prodotti, richieste, offerte e prezzi nello storico commerciale. Ogni risultato utile
            deve riportarti alla fonte originale.
          </p>
        </div>

        <form action="/search" method="get" className="mt-7">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              name="q"
              required
              minLength={2}
              placeholder="Es. S355 273x8 12000 oppure P265GH 406,4 x 6,3"
              className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
            <button className="h-12 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white transition hover:bg-indigo-500">
              Cerca nello storico
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Ricerca rapida per prodotto, qualità, norma, cliente o documento.
            </p>
            <Link href="/search" className="text-xs font-semibold text-indigo-600">
              Apri ricerca avanzata →
            </Link>
          </div>
        </form>
      </section>

      {mode === "awaiting_assignment" ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Il corpus validato è disponibile, ma deve ancora essere associato al primo utente autenticato.
        </Card>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Azioni rapide</h2>
            <p className="mt-1 text-sm text-slate-500">Le azioni più comuni per lavorare sullo storico commerciale.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Link
            href="/uploads"
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">01</p>
            <h3 className="mt-3 font-semibold text-slate-950">Importa documenti</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Carica email, PDF ed Excel e rendili disponibili alla memoria commerciale.
            </p>
          </Link>
          <Link
            href="/products"
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">02</p>
            <h3 className="mt-3 font-semibold text-slate-950">Apri lo storico prodotto</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Ricostruisci prezzi, richieste, offerte e comparabili per prodotto.
            </p>
          </Link>
        </div>
      </section>

      {metrics.reviewFlags > 0 ? (
        <Link
          href="/review"
          className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 transition hover:border-amber-300 hover:bg-amber-100/70 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Richiede attenzione</p>
            <h2 className="mt-1 text-base font-semibold text-amber-950">
              {metrics.reviewFlags.toLocaleString("it-IT")} {metrics.reviewFlags === 1 ? "elemento da verificare" : "elementi da verificare"}
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              Controlla solo i casi che il sistema non considera ancora abbastanza affidabili.
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-amber-900">Apri correzioni →</span>
        </Link>
      ) : null}

      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">Workspace normalizzato</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          {[
            ["RFQ", operational.rfqs],
            ["Offerte", operational.offers],
            ["Ordini", operational.orders],
            ["Evidenze legacy", operational.legacyEvidence],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <p className="text-2xl font-semibold text-slate-950">{Number(value).toLocaleString("it-IT")}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Le attività operative recenti provengono dalle entità normalizzate. Le osservazioni legacy restano disponibili come evidenza e provenienza.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-500">Storico disponibile</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {metrics.observations.toLocaleString("it-IT")}
          </p>
          <p className="mt-1 text-xs text-slate-400">elementi commerciali</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-500">Conversazioni ricostruite</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {metrics.threads.toLocaleString("it-IT")}
          </p>
          <p className="mt-1 text-xs text-slate-400">conversazioni commerciali</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-500">Da verificare</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {metrics.reviewFlags.toLocaleString("it-IT")}
          </p>
          <p className="mt-1 text-xs text-slate-400">casi in attesa di verifica</p>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Attività commerciale recente</h2>
              <p className="mt-1 text-xs text-slate-500">
                {mode === "live" ? "Dati aggiornati dal workspace." : "Dati disponibili nello storico."}
              </p>
            </div>
            <Link href="/search" className="text-xs font-semibold text-slate-700">
              Cerca nello storico →
            </Link>
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
                  <Badge tone={row.role === "offered" ? "green" : row.role === "requested" ? "blue" : "violet"}>
                    {roleLabel(row.role)}
                  </Badge>
                  <span className="text-xs text-slate-400">{row.date}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">{row.product}</p>
                <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                  {row.grade} · {row.standard} · {row.company}
                </p>
                {row.sourceKind === "normalized" ? (
                  <p className="mt-1 text-[11px] font-semibold text-indigo-600">Entità normalizzata</p>
                ) : null}
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm font-semibold text-slate-900">{row.price ?? "—"}</p>
                <p className="mt-1 text-xs text-slate-400">{Math.round(row.confidence * 100)}% affidabilità</p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
