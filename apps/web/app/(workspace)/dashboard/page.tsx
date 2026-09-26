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
import { appRoutes } from "@/lib/routes";
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
      <section className="overflow-hidden rounded-3xl border border-[#d9e0e4] bg-white shadow-[0_1px_2px_rgba(11,23,30,0.035),0_12px_36px_rgba(11,23,30,0.03)]">
        <div className="h-1 bg-[#1b4c5d]" />
        <div className="p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#28677a]">Company Workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#17232d] sm:text-4xl">
              {context.organizationName}
            </h1>
            <p className="mt-2 text-sm text-[#66737d]">
              {workspaceRoleLabel(context.role)} · Commercial Memory privata + Steel Network condiviso
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {context.platformSuperadmin ? (
              <Link
                href={appRoutes.platform.home}
                className="inline-flex h-10 items-center rounded-xl bg-[#1b4c5d] px-4 text-sm font-semibold text-white shadow-[0_1px_1px_rgba(11,23,30,0.12)] hover:bg-[#153542]"
              >
                Platform Console
              </Link>
            ) : null}
            {isAdmin && networkEnabled ? (
              <Link
                href={appRoutes.company.profile}
                className="inline-flex h-10 items-center rounded-xl border border-[#d9e0e4] bg-white px-4 text-sm font-semibold text-[#33454e]"
              >
                Gestisci profilo azienda
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href={appRoutes.operations.review} className="rounded-2xl bg-amber-50 p-4">
            <p className="metric-number text-2xl font-semibold text-amber-950">{metrics.reviewFlags}</p>
            <p className="mt-1 text-xs font-semibold text-amber-800">Elementi da verificare</p>
          </Link>
          <Link href={appRoutes.network.inquiries + "?box=received"} className="rounded-2xl bg-[#eef5f6] p-4">
            <p className="metric-number text-2xl font-semibold text-[#153542]">{received.total}</p>
            <p className="mt-1 text-xs font-semibold text-[#1b4c5d]">Inquiry ricevute</p>
          </Link>
          <Link href={appRoutes.network.activity + "?unread=1"} className="rounded-2xl bg-sky-50 p-4">
            <p className="metric-number text-2xl font-semibold text-sky-950">{activity.unread}</p>
            <p className="mt-1 text-xs font-semibold text-sky-700">Activity non lette</p>
          </Link>
          <Link href={appRoutes.operations.alerts} className="rounded-2xl bg-[#edf1f3] p-4">
            <p className="metric-number text-2xl font-semibold text-[#17232d]">{operational.rfqs + operational.offers + operational.orders}</p>
            <p className="mt-1 text-xs font-semibold text-[#52636c]">Entità commerciali operative</p>
          </Link>
        </div>

        <form action={appRoutes.commercial.search} method="get" className="mt-7">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              name="q"
              required
              minLength={2}
              placeholder="Cerca prodotto, qualità, norma, cliente o documento"
              className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-base text-[#17232d] outline-none transition focus:border-[#6e9eab] focus:ring-4 focus:ring-[#eef5f6]"
            />
            <button className="h-12 rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white">
              Cerca nello storico
            </button>
          </div>
          <div className="mt-3 flex justify-end">
            <Link href={appRoutes.commercial.search} className="text-xs font-semibold text-[#28677a]">
              Apri ricerca avanzata →
            </Link>
          </div>
        </form>
        </div>
      </section>

      {metrics.reviewFlags > 0 ? (
        <Link
          href={appRoutes.operations.review}
          className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Richiede attenzione</p>
            <p className="mt-1 text-base font-semibold text-amber-950">
              {metrics.reviewFlags} {metrics.reviewFlags === 1 ? "elemento da verificare" : "elementi da verificare"}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Apri le correzioni solo quando il sistema richiede una verifica: questi sono i casi in attesa di verifica.
            </p>
          </div>
          <span className="text-sm font-semibold text-amber-900">Apri correzioni →</span>
        </Link>
      ) : null}

      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-[#17232d]">Azioni rapide</h2>
          <p className="mt-1 text-sm text-[#66737d]">Le attività più utili per il tuo ruolo nel workspace.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href={appRoutes.commercial.search} className="rounded-2xl border border-[#d9e0e4] bg-white p-5 hover:border-[#8fb7c1]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#28677a]">Commercial Memory</p>
            <h3 className="mt-3 font-semibold text-[#17232d]">Cerca nello storico</h3>
            <p className="mt-2 text-sm leading-6 text-[#66737d]">Prodotti, prezzi, richieste, offerte e fonti originali.</p>
          </Link>

          {networkEnabled ? (
            <Link href={appRoutes.network.directory} className="rounded-2xl border border-[#d9e0e4] bg-white p-5 hover:border-[#8fb7c1]">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#28677a]">Steel Network</p>
              <h3 className="mt-3 font-semibold text-[#17232d]">Trova aziende</h3>
              <p className="mt-2 text-sm leading-6 text-[#66737d]">Esplora profili pubblicati, prodotti, capability e mercati.</p>
            </Link>
          ) : null}

          {canWrite ? (
            <Link href={appRoutes.operations.uploads} className="rounded-2xl border border-[#d9e0e4] bg-white p-5 hover:border-[#8fb7c1]">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8b9aa1]">Operations</p>
              <h3 className="mt-3 font-semibold text-[#17232d]">Importa documenti</h3>
              <p className="mt-2 text-sm leading-6 text-[#66737d]">Aggiungi email, PDF ed Excel alla memoria commerciale.</p>
            </Link>
          ) : null}

          {networkEnabled ? (
            <Link href={appRoutes.network.inquiries} className="rounded-2xl border border-[#d9e0e4] bg-white p-5 hover:border-[#8fb7c1]">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8b9aa1]">B2B Interaction</p>
              <h3 className="mt-3 font-semibold text-[#17232d]">Apri Inquiry</h3>
              <p className="mt-2 text-sm leading-6 text-[#66737d]">{sent.total} inviate · {received.total} ricevute.</p>
            </Link>
          ) : null}
        </div>
      </section>

      {networkEnabled ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#d9e0e4] bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-[#17232d]">Il tuo Network</h2>
                <p className="mt-1 text-sm text-[#66737d]">Interesse privato e aggiornamenti pubblicati.</p>
              </div>
              <Link href={appRoutes.network.directory} className="text-xs font-semibold text-[#28677a]">Apri Network →</Link>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Link href={appRoutes.network.saved} className="rounded-xl bg-[#f7f9fa] p-3 text-center">
                <p className="metric-number text-xl font-semibold text-[#17232d]">{saved.length}</p>
                <p className="mt-1 text-[11px] text-[#66737d]">Salvate</p>
              </Link>
              <Link href={appRoutes.network.following} className="rounded-xl bg-[#f7f9fa] p-3 text-center">
                <p className="metric-number text-xl font-semibold text-[#17232d]">{followed.total}</p>
                <p className="mt-1 text-[11px] text-[#66737d]">Seguite</p>
              </Link>
              <Link href={appRoutes.network.activity} className="rounded-xl bg-[#f7f9fa] p-3 text-center">
                <p className="metric-number text-xl font-semibold text-[#17232d]">{activity.unread}</p>
                <p className="mt-1 text-[11px] text-[#66737d]">Non lette</p>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-[#d9e0e4] bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-[#17232d]">Inquiry B2B</h2>
                <p className="mt-1 text-sm text-[#66737d]">Conversazioni strutturate tra organizzazioni.</p>
              </div>
              <Link href={appRoutes.network.inquiries} className="text-xs font-semibold text-[#28677a]">Gestisci →</Link>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#eef5f6] p-4">
                <p className="metric-number text-2xl font-semibold text-[#153542]">{received.total}</p>
                <p className="mt-1 text-xs text-[#1b4c5d]">Ricevute</p>
              </div>
              <div className="rounded-xl bg-[#f7f9fa] p-4">
                <p className="metric-number text-2xl font-semibold text-[#17232d]">{sent.total}</p>
                <p className="mt-1 text-xs text-[#66737d]">Inviate</p>
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

      <section className="rounded-2xl border border-[#c8dce1] bg-[#eef5f6]/50 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#28677a]">Workspace normalizzato</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#28677a]">Commercial Memory</p>
            <h2 className="mt-2 text-lg font-semibold text-[#17232d]">Memoria commerciale privata</h2>
            <p className="mt-1 text-sm text-[#66737d]">Questi dati appartengono esclusivamente al tuo workspace aziendale.</p>
          </div>
          <Link href={appRoutes.commercial.search} className="text-sm font-semibold text-[#1b4c5d]">Cerca nello storico →</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            ["RFQ", operational.rfqs],
            ["Offerte", operational.offers],
            ["Ordini", operational.orders],
            ["Conversazioni commerciali", metrics.threads],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl bg-white/80 p-3">
              <p className="metric-number text-2xl font-semibold text-[#17232d]">{Number(value).toLocaleString("it-IT")}</p>
              <p className="text-xs text-[#66737d]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[#17232d]">Attività commerciale recente</h2>
              <p className="mt-1 text-xs text-[#66737d]">Dati privati del workspace.</p>
            </div>
            <Link href={appRoutes.commercial.search} className="text-xs font-semibold text-[#33454e]">Apri storico →</Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {recent.map((row) => (
            <Link
              href={row.operationalHref ?? appRoutes.commercial.conversation(row.conversationId)}
              key={row.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 transition hover:border-slate-300 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={row.role === "offered" ? "green" : row.role === "requested" ? "blue" : "violet"}>
                    {roleLabel(row.role)}
                  </Badge>
                  <span className="text-xs text-[#8b9aa1]">{row.date}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[#22313a]">{row.product}</p>
                <p className="mt-1 line-clamp-1 text-xs text-[#66737d]">{row.grade} · {row.standard} · {row.company}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm font-semibold text-[#22313a]">{row.price ?? "—"}</p>
                <p className="mt-1 text-xs text-[#8b9aa1]">{Math.round(row.confidence * 100)}% affidabilità</p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
