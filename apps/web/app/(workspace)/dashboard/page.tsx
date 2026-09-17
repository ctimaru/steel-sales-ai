import Link from "next/link";

import { GlobalSearch } from "@/components/global-search";
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
  const { metrics, recent, mode } = await getDashboardData();

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

        <div className="mt-7">
          <GlobalSearch />
        </div>
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
            <p className="mt-1 text-sm text-slate-500">I tre percorsi principali dell’MVP.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
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
              Ricostruisci prezzi, richieste, offerte e comparabili per prodotto canonico.
            </p>
          </Link>
          <Link
            href="/review"
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">03</p>
            <h3 className="mt-3 font-semibold text-slate-950">Correggi i dati</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Verifica i casi dubbi e correggi ciò che il sistema ha interpretato male.
            </p>
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-500">Storico disponibile</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {metrics.observations.toLocaleString("it-IT")}
          </p>
          <p className="mt-1 text-xs text-slate-400">osservazioni commerciali</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-500">Conversazioni ricostruite</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {metrics.threads.toLocaleString("it-IT")}
          </p>
          <p className="mt-1 text-xs text-slate-400">thread commerciali</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-500">Da verificare</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {metrics.reviewFlags.toLocaleString("it-IT")}
          </p>
          <p className="mt-1 text-xs text-slate-400">elementi nella review queue</p>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Attività commerciale recente</h2>
              <p className="mt-1 text-xs text-slate-500">
                {mode === "live" ? "Dati live dal workspace." : "Riferimento validato del corpus."}
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
