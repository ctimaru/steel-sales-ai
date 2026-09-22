import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { loadCompanyDirectory } from "./actions";

export const dynamic = "force-dynamic";

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const directory = await loadCompanyDirectory(query || undefined);

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Commercial Memory</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Clienti / aziende</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Una vista unica delle Company normalizzate del workspace: contatti, conversazioni, RFQ,
          offerte, ordini e attività prodotto collegate solo tramite identità verificate.
        </p>
      </div>

      {directory.unresolved_identity_count !== null ? (
        <Card className={directory.unresolved_identity_count > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}>
          <CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className={`text-sm font-semibold ${directory.unresolved_identity_count > 0 ? "text-amber-950" : "text-emerald-950"}`}>
                {directory.unresolved_identity_count > 0
                  ? `${directory.unresolved_identity_count} identità aziendali da confermare nel workspace`
                  : "Nessuna identità aziendale in attesa"}
              </p>
              <p className={`mt-1 text-sm ${directory.unresolved_identity_count > 0 ? "text-amber-800" : "text-emerald-800"}`}>
                Le attività entrano nella Company 360 solo dopo una conferma esplicita Contact→Company.
              </p>
            </div>
            {directory.unresolved_identity_count > 0 ? (
              <Link
                href="/review/identities"
                className="shrink-0 rounded-lg bg-amber-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800"
              >
                Gestisci identità
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <form method="get" className="flex flex-col gap-3 sm:flex-row">
          <input
            name="q"
            defaultValue={query}
            placeholder="Cerca azienda, P.IVA o paese"
            className="h-12 flex-1 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
          />
          <button className="h-12 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-500">
            Cerca aziende
          </button>
        </form>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span>{directory.total} aziende{query ? ` per “${query}”` : ""}</span>
          {query ? <Link href="/customers" className="font-semibold text-indigo-600">Azzera ricerca</Link> : null}
        </div>
      </section>

      {directory.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {directory.error}
        </div>
      ) : directory.companies.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-900">Nessuna Company trovata</p>
          <p className="mt-1 text-sm text-slate-500">
            Le aziende appariranno qui quando verranno create o verificate nel workspace.
          </p>
        </div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {directory.companies.map((company) => (
            <Link
              key={company.company_id}
              href={`/customers/${company.company_id}`}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    {company.verified ? <Badge tone="green">Identità verificata</Badge> : <Badge tone="amber">Identità da verificare</Badge>}
                    {company.company_type ? <Badge tone="neutral">{company.company_type}</Badge> : null}
                  </div>
                  <h2 className="mt-3 truncate text-lg font-semibold text-slate-950">{company.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {[company.country, company.vat_number].filter(Boolean).join(" · ") || "Dati aziendali essenziali non disponibili"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ultima attività</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{dateLabel(company.last_activity_at)}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-5 gap-2 border-t border-slate-100 pt-4 text-center">
                {[
                  ["Contatti", company.contact_count],
                  ["Messaggi", company.message_count],
                  ["RFQ", company.rfq_count],
                  ["Offerte", company.offer_count],
                  ["Ordini", company.order_count],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-slate-50 px-2 py-2">
                    <p className="text-base font-semibold text-slate-900">{String(value)}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
