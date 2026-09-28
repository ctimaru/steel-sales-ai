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
  if (role === "admin") return "Amministratore aziendale";
  if (role === "viewer") return "Sola lettura";
  return "Membro";
}

export default async function DashboardPage() {
  const context = await getWorkspaceContext();
  const networkEnabled = isNetworkFrontendEnabled();

  const [commercial, received, sent, activity, followed, saved] = await Promise.all([
    getDashboardData(),
    networkEnabled
      ? getNetworkInquiries(context.organizationId, "received")
      : Promise.resolve({ items: [], total: 0 }),
    networkEnabled
      ? getNetworkInquiries(context.organizationId, "sent")
      : Promise.resolve({ items: [], total: 0 }),
    networkEnabled
      ? getNetworkActivityFeed(context.organizationId, true)
      : Promise.resolve({ items: [], total: 0, unread: 0 }),
    networkEnabled
      ? getFollowedNetworkCompanies(context.organizationId)
      : Promise.resolve({ items: [], total: 0 }),
    networkEnabled ? getSavedNetworkCompanies() : Promise.resolve([]),
  ]);

  const { metrics, recent, mode, operational } = commercial;
  const isAdmin = context.role === "admin";
  const canWrite = context.role !== "viewer";

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="overflow-hidden rounded-3xl border border-[#dce7f7] bg-white shadow-[0_1px_2px_rgba(30,43,69,0.025),0_12px_36px_rgba(30,43,69,0.035)]">
        <div className="h-1 bg-[#2f6fed]" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#2f6fed]">
              Workspace
            </span>
            <span className="rounded-full bg-[#f2f5f9] px-3 py-1 text-[11px] font-semibold text-[#64748b]">
              Privato
            </span>
          </div>

          <div className="mt-4 max-w-4xl">
            <h1 className="text-3xl font-semibold tracking-tight text-[#1e2b45] sm:text-4xl">
              Il centro operativo della tua azienda
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#68788e] sm:text-base">
              Questa pagina riunisce ciò che richiede attenzione, la memoria commerciale privata,
              le attività recenti e l’accesso agli spazi condivisi. È il punto di partenza per capire
              subito cosa sta succedendo e dove intervenire.
            </p>
            <p className="mt-3 text-xs font-semibold text-[#7e8da1]">
              {workspaceRoleLabel(context.role)} · Area privata aziendale
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[#e6edf7] bg-[#f8fbff] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2f6fed]">Priorità operative</p>
              <p className="mt-2 text-sm leading-6 text-[#5f7087]">
                Correzioni, inquiry e segnali che richiedono la tua attenzione.
              </p>
            </div>
            <div className="rounded-2xl border border-[#e6edf7] bg-[#f8fbff] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2f6fed]">Commercial Memory</p>
              <p className="mt-2 text-sm leading-6 text-[#5f7087]">
                RFQ, offerte, ordini, aziende, conversazioni e storico normalizzato.
              </p>
            </div>
            <div className="rounded-2xl border border-[#e6edf7] bg-[#f8fbff] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2f6fed]">Ecosistema condiviso</p>
              <p className="mt-2 text-sm leading-6 text-[#5f7087]">
                Network, Marketplace e Knowledge, separati dai dati commerciali privati.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f8da3]">Oggi nel workspace</p>
          <h2 className="mt-1 text-xl font-semibold text-[#1e2b45]">Cosa richiede attenzione</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={appRoutes.operations.review}
            className={`rounded-2xl border p-5 transition ${
              metrics.reviewFlags > 0
                ? "border-amber-200 bg-amber-50 hover:border-amber-300"
                : "border-[#e1e8f2] bg-white hover:border-[#bdd1f4]"
            }`}
          >
            <p className="metric-number text-3xl font-semibold text-[#1e2b45]">{metrics.reviewFlags}</p>
            <p className="mt-1 text-xs font-semibold text-[#68788e]">Elementi da verificare</p>
            <section className="rounded-3xl border border-[#dbe7f7] bg-[#f8fbff] p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Commercial Memory</p>
            <h2 className="mt-2 text-xl font-semibold text-[#1e2b45]">Memoria commerciale privata</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#68788e]">
              Storico normalizzato di prodotti, aziende, richieste, offerte, ordini, conversazioni e fonti originali.
            </p>
          </div>
          <Link href={appRoutes.commercial.search} className="text-sm font-semibold text-[#2f6fed]">
            Ricerca nello storico →
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["RFQ", operational.rfqs],
            ["Offerte", operational.offers],
            ["Ordini", operational.orders],
            ["Conversazioni", metrics.threads],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
              <p className="metric-number text-2xl font-semibold text-[#1e2b45]">
                {Number(value).toLocaleString("it-IT")}
              </p>
              <p className="mt-1 text-xs text-[#68788e]">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Link href={appRoutes.commercial.products} className="rounded-2xl border border-[#e1e8f2] bg-white p-5 hover:border-[#bdd1f4]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Prodotti</p>
            <h3 className="mt-3 font-semibold text-[#1e2b45]">Product 360</h3>
            <p className="mt-2 text-sm leading-6 text-[#68788e]">Richieste, offerte, ordini, prezzi e documenti per prodotto.</p>
          </Link>
          <Link href={appRoutes.commercial.companies} className="rounded-2xl border border-[#e1e8f2] bg-white p-5 hover:border-[#bdd1f4]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Aziende</p>
            <h3 className="mt-3 font-semibold text-[#1e2b45]">Company 360 commerciale</h3>
            <p className="mt-2 text-sm leading-6 text-[#68788e]">Storico privato per cliente, fornitore e relazione commerciale.</p>
          </Link>
          <Link href={appRoutes.commercial.assistant} className="rounded-2xl border border-[#e1e8f2] bg-white p-5 hover:border-[#bdd1f4]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Assistente</p>
            <h3 className="mt-3 font-semibold text-[#1e2b45]">Lavora sulla memoria</h3>
            <p className="mt-2 text-sm leading-6 text-[#68788e]">Interroga il corpus aziendale mantenendo fonti e contesto.</p>
          </Link>
          <Link href={appRoutes.commercial.search} className="rounded-2xl border border-[#e1e8f2] bg-white p-5 hover:border-[#bdd1f4]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f8da3]">Ricerca</p>
            <h3 className="mt-3 font-semibold text-[#1e2b45]">Cerca nello storico</h3>
            <p className="mt-2 text-sm leading-6 text-[#68788e]">Trova rapidamente prodotto, norma, cliente, prezzo o documento.</p>
          </Link>
        </div>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[#1e2b45]">Attività commerciale recente</h2>
              <p className="mt-1 text-xs text-[#68788e]">Ultimi segnali dalla memoria privata del workspace.</p>
            </div>
            <Link href={appRoutes.commercial.search} className="text-xs font-semibold text-[#2f6fed]">
              Apri storico →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {recent.map((row) => (
            <Link
              href={row.operationalHref ?? appRoutes.commercial.conversation(row.conversationId)}
              key={row.id}
              className="flex flex-col gap-3 rounded-xl border border-[#edf1f6] p-4 transition hover:border-[#cfdcf0] sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={row.role === "offered" ? "green" : row.role === "requested" ? "blue" : "violet"}>
                    {roleLabel(row.role)}
                  </Badge>
                  <span className="text-xs text-[#91a0b2]">{row.date}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[#2f4059]">{row.product}</p>
                <p className="mt-1 line-clamp-1 text-xs text-[#68788e]">
                  {row.grade} · {row.standard} · {row.company}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm font-semibold text-[#2f4059]">{row.price ?? "—"}</p>
                <p className="mt-1 text-xs text-[#91a0b2]">{Math.round(row.confidence * 100)}% affidabilità</p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <section>
        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f8da3]">Workspace privato</p>
          <h2 className="mt-1 text-xl font-semibold text-[#1e2b45]">Operations e configurazione</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {canWrite ? (
            <Link href={appRoutes.operations.uploads} className="rounded-2xl border border-[#e1e8f2] bg-white p-5 hover:border-[#bdd1f4]">
              <h3 className="font-semibold text-[#1e2b45]">Importa documenti</h3>
              <p className="mt-2 text-sm leading-6 text-[#68788e]">Email, PDF ed Excel nella Commercial Memory.</p>
            </Link>
          ) : null}
          {canWrite ? (
            <Link href={appRoutes.operations.review} className="rounded-2xl border border-[#e1e8f2] bg-white p-5 hover:border-[#bdd1f4]">
              <h3 className="font-semibold text-[#1e2b45]">Correzioni</h3>
              <p className="mt-2 text-sm leading-6 text-[#68788e]">Risolvi solo i casi che richiedono intervento umano.</p>
            </Link>
          ) : null}
          <Link href={appRoutes.operations.alerts} className="rounded-2xl border border-[#e1e8f2] bg-white p-5 hover:border-[#bdd1f4]">
            <h3 className="font-semibold text-[#1e2b45]">Alert operativi</h3>
            <p className="mt-2 text-sm leading-6 text-[#68788e]">Controlla eccezioni e segnali operativi del workspace.</p>
          </Link>
          {isAdmin ? (
            <Link href={appRoutes.company.dataSources} className="rounded-2xl border border-[#e1e8f2] bg-white p-5 hover:border-[#bdd1f4]">
              <h3 className="font-semibold text-[#1e2b45]">Fonti e import</h3>
              <p className="mt-2 text-sm leading-6 text-[#68788e]">Gestisci le sorgenti che alimentano la memoria aziendale.</p>
            </Link>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Spazi condivisi</p>
          <h2 className="mt-1 text-xl font-semibold text-[#1e2b45]">Ecosistema Steel Sales AI</h2>
          <p className="mt-1 text-sm text-[#68788e]">Queste superfici non fanno parte della Commercial Memory privata.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {networkEnabled ? (
            <Link href={appRoutes.network.directory} className="rounded-3xl border border-[#dbe7f7] bg-white p-6 hover:border-[#bdd1f4] hover:shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-[#eef5ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#2f6fed]">
                  Condiviso
                </span>
                <span className="text-xs font-semibold text-[#2f6fed]">Apri →</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#1e2b45]">Network</h3>
              <p className="mt-2 text-sm leading-6 text-[#68788e]">
                Company Profile, directory industriale, aziende seguite, activity e inquiry B2B.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[#f8fafd] p-3">
                  <p className="metric-number text-lg font-semibold text-[#1e2b45]">{saved.length}</p>
                  <p className="text-[10px] text-[#7e8da1]">Salvate</p>
                </div>
                <div className="rounded-xl bg-[#f8fafd] p-3">
                  <p className="metric-number text-lg font-semibold text-[#1e2b45]">{followed.total}</p>
                  <p className="text-[10px] text-[#7e8da1]">Seguite</p>
                </div>
                <div className="rounded-xl bg-[#f8fafd] p-3">
                  <p className="metric-number text-lg font-semibold text-[#1e2b45]">{received.total}</p>
                  <p className="text-[10px] text-[#7e8da1]">Inquiry</p>
                </div>
              </div>
            </Link>
          ) : null}

          {networkEnabled ? (
            <Link href={appRoutes.marketplace.home} className="rounded-3xl border border-[#dbe7f7] bg-[#f8fbff] p-6 hover:border-[#bdd1f4]">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-[#eef5ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#2f6fed]">
                  Condiviso
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                  Prossima priorità
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#1e2b45]">Marketplace</h3>
              <p className="mt-2 text-sm leading-6 text-[#68788e]">
                Demand Board per richieste prodotto visibili o anonime, countdown e futuro unlock delle opportunità.
              </p>
              <p className="mt-5 text-xs font-semibold text-[#2f6fed]">Apri la foundation →</p>
            </Link>
          ) : null}

          <Link href={appRoutes.knowledge.home} className="rounded-3xl border border-[#dbe7f7] bg-white p-6 hover:border-[#bdd1f4] hover:shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-[#eef5ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#2f6fed]">
                Condiviso
              </span>
              <span className="text-xs font-semibold text-[#2f6fed]">Apri →</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[#1e2b45]">Knowledge</h3>
            <p className="mt-2 text-sm leading-6 text-[#68788e]">
              Norme, gradi, dimensioni e pesi tecnici riutilizzabili in tutto il SaaS.
            </p>
            <p className="mt-5 text-xs text-[#7e8da1]">Tolleranze: coverage strutturata in costruzione.</p>
          </Link>
        </div>
      </section>

      {mode === "awaiting_assignment" ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Il corpus validato è disponibile, ma deve ancora essere associato al workspace.
        </Card>
      ) : null}

      {networkEnabled && sent.total > 0 ? (
        <p className="text-xs text-[#91a0b2]">
          Inquiry inviate nel Network: {sent.total}. Lo storico delle inquiry resta nello spazio condiviso Network.
        </p>
      ) : null}
    </div>
  );
}
