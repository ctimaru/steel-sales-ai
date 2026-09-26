import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDashboardData } from "@/lib/commercial-data";
import {
  getFollowedNetworkCompanies,
  getNetworkActivityFeed,
  getNetworkInquiries,
  getSavedNetworkCompanies,
} from "@/lib/network";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { getWorkspaceContext } from "@/lib/workspace-context";

function roleLabel(role: string) {
  if (role === "requested") return "Richiesta";
  if (role === "offered") return "Offerta";
  if (role === "ordered") return "Ordine";
  if (role === "delivered") return "Consegna";
  return role;
}

function workspaceRoleLabel(role: string) {
  if (role === "admin") return "Organization Admin";
  if (role === "viewer") return "Viewer";
  return "Member";
}

export default async function DashboardPage() {
  const context = await getWorkspaceContext();
  const networkEnabled = isNetworkFrontendEnabled();

  const [commercial, received, sent, activity, followed, saved] = await Promise.all([
    getDashboardData(),
    networkEnabled ? getNetworkInquiries(context.organizationId, "received") : Promise.resolve({ items: [], total: 0 }),
    networkEnabled ? getNetworkInquiries(context.organizationId, "sent") : Promise.resolve({ items: [], total: 0 }),
    networkEnabled ? getNetworkActivityFeed(context.organizationId, true) : Promise.resolve({ items: [], total: 0, unread: 0 }),
    networkEnabled ? getFollowedNetworkCompanies(context.organizationId) : Promise.resolve({ items: [], total: 0 }),
    networkEnabled ? getSavedNetworkCompanies() : Promise.resolve([]),
  ]);

  const { metrics, recent, mode, operational } = commercial;
  const isAdmin = context.role === "admin";
  const canWrite = context.role !== "viewer";

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Company Workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {context.organizationName}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {workspaceRoleLabel(context.role)} · Commercial Memory privata + Steel Network condiviso
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {context.platformSuperadmin ? (
              <Link
                href="/platform"
                className="inline-flex h-10 items-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white"
              >
                Platform Console
              </Link>
            ) : null}
            {isAdmin && networkEnabled ? (
              <Link
                href="/network/manage"
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                Gestisci profilo azienda
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/review" className="rounded-2xl bg-amber-50 p-4">
            <p className="text-2xl font-semibold text-amber-950">{metrics.reviewFlags}</p>
            <p className="mt-1 text-xs font-semibold text-amber-800">Elementi da verificare</p>
          </Link>
          <Link href="/network/inquiries?box=received" className="rounded-2xl bg-indigo-50 p-4">
            <p className="text-2xl font-semibold text-indigo-950">{received.total}</p>
            <p className="mt-1 text-xs font-semibold text-indigo-700">Inquiry ricevute</p>
          </Link>
          <Link href="/network/activity?unread=1" className="rounded-2xl bg-sky-50 p-4">
            <p className="text-2xl font-semibold text-sky-950">{activity.unread}</p>
            <p className="mt-1 text-xs font-semibold text-sky-700">Activity non lette</p>
          </Link>
          <Link href="/alerts" className="rounded-2xl bg-slate-100 p-4">
            <p className="text-2xl font-semibold text-slate-950">{operational.rfqs + operational.offers + operational.orders}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">Entità commerciali operative</p>
          </Link>
        </div>

        <form action="/search" method="get" className="mt-7">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              name="q"
              required
              minLength={2}
              placeholder="Cerca prodotto, qualità, norma, cliente o documento"
              className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
            <button className="h-12 rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white">
              Cerca nello storico
            </button>
          </div>
        </form>
      </section>

      {metrics.reviewFlags > 0 ? (
        <Link
          href="/review"
          className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Richiede attenzione</p>
            <p className="mt-1 text-base font-semibold text-amber-950">
              {metrics.reviewFlags} {metrics.reviewFlags === 1 ? "elemento da verificare" : "elementi da verificare"}
            </p>
            <p className="mt-1 text-sm text-amber-800">Apri le correzioni solo quando il sistema richiede una verifica.</p>
          </div>
          <span className="text-sm font-semibold text-amber-900">Apri correzioni →</span>
        </Link>
      ) : null}

      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-slate-950">Azioni rapide</h2>
          <p className="mt-1 text-sm text-slate-500">Le attività più utili per il tuo ruolo nel workspace.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/search" className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-300">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">Commercial Memory</p>
            <h3 className="mt-3 font-semibold text-slate-950">Cerca nello storico</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Prodotti, prezzi, richieste, offerte e fonti originali.</p>
          </Link>

          {networkEnabled ? (
            <Link href="/network" className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-300">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">Steel Network</p>
              <h3 className="mt-3 font-semibold text-slate-950">Trova aziende</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">Esplora profili pubblicati, prodotti, capability e mercati.</p>
            </Link>
          ) : null}

          {canWrite ? (
            <Link href="/uploads" className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-300">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Operations</p>
              <h3 className="mt-3 font-semibold text-slate-950">Importa documenti</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">Aggiungi email, PDF ed Excel alla memoria commerciale.</p>
            </Link>
          ) : null}

          {networkEnabled ? (
            <Link href="/network/inquiries" className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-300">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">B2B Interaction</p>
              <h3 className="mt-3 font-semibold text-slate-950">Apri Inquiry</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{sent.total} inviate · {received.total} ricevute.</p>
            </Link>
          ) : null}
        </div>
      </section>

      {networkEnabled ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-950">Il tuo Network</h2>
                <p className="mt-1 text-sm text-slate-500">Interesse privato e aggiornamenti pubblicati.</p>
              </div>
              <Link href="/network" className="text-xs font-semibold text-indigo-600">Apri Network →</Link>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Link href="/network/saved" className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-xl font-semibold text-slate-950">{saved.length}</p>
                <p className="mt-1 text-[11px] text-slate-500">Salvate</p>
              </Link>
              <Link href="/network/following" className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-xl font-semibold text-slate-950">{followed.total}</p>
                <p className="mt-1 text-[11px] text-slate-500">Seguite</p>
              </Link>
              <Link href="/network/activity" className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-xl font-semibold text-slate-950">{activity.unread}</p>
                <p className="mt-1 text-[11px] text-slate-500">Non lette</p>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-950">Inquiry B2B</h2>
                <p className="mt-1 text-sm text-slate-500">Conversazioni strutturate tra organizzazioni.</p>
              </div>
              <Link href="/network/inquiries" className="text-xs font-semibold text-indigo-600">Gestisci →</Link>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-indigo-50 p-4">
                <p className="text-2xl font-semibold text-indigo-950">{received.total}</p>
                <p className="mt-1 text-xs text-indigo-700">Ricevute</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-2xl font-semibold text-slate-950">{sent.total}</p>
                <p className="mt-1 text-xs text-slate-500">Inviate</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {mode === "awaiting_assignment" ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Il corpus validato è disponibile, ma deve ancora essere associato al workspace.
        </Card>
      ) : null}

      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">Workspace normalizzato</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">Commercial Memory</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Memoria commerciale privata</h2>
            <p className="mt-1 text-sm text-slate-500">Questi dati appartengono esclusivamente al tuo workspace aziendale.</p>
          </div>
          <Link href="/search" className="text-sm font-semibold text-indigo-700">Cerca nello storico →</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            ["RFQ", operational.rfqs],
            ["Offerte", operational.offers],
            ["Ordini", operational.orders],
            ["Conversazioni commerciali", metrics.threads],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl bg-white/80 p-3">
              <p className="text-2xl font-semibold text-slate-950">{Number(value).toLocaleString("it-IT")}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Attività commerciale recente</h2>
              <p className="mt-1 text-xs text-slate-500">Dati privati del workspace.</p>
            </div>
            <Link href="/search" className="text-xs font-semibold text-slate-700">Apri storico →</Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {recent.map((row) => (
            <Link
              href={row.operationalHref ?? `/conversations/${row.conversationId}`}
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
                <p className="mt-1 line-clamp-1 text-xs text-slate-500">{row.grade} · {row.standard} · {row.company}</p>
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
