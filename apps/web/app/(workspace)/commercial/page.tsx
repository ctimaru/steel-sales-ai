import Link from "next/link";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { PilotEvent } from "@/components/pilot-event";
import { FocusHeader, FocusPage, FocusSectionHeader } from "@/components/focus-ui";
import { Badge } from "@/components/ui/badge";
import { getDashboardData } from "@/lib/commercial-data";
import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

function roleLabel(role: string) {
  if (role === "requested") return "RFQ";
  if (role === "offered") return "Offerta";
  if (role === "ordered") return "Ordine";
  if (role === "delivered") return "Consegna";
  return role;
}

const coreTools = [
  {
    href: appRoutes.commercial.products,
    title: "Prodotti",
    description: "Product 360 con richieste, offerte, ordini, prezzi ed evidenze.",
    meta: "Product 360",
  },
  {
    href: appRoutes.commercial.companies,
    title: "Aziende",
    description: "Company 360 con clienti, fornitori e storico delle relazioni private.",
    meta: "Company 360",
  },
  {
    href: appRoutes.commercial.assistant,
    title: "Assistente",
    description: "Interroga la memoria commerciale mantenendo fonti e provenienza.",
    meta: "AI privata",
  },
] as const;

const intelligenceGroups = [
  {
    title: "Prezzi & mercato",
    description: "Capisci prezzi, variazioni e segnali dal tuo storico commerciale.",
    links: [
      ["Prezzi", appRoutes.commercial.priceIntelligence],
      ["Mercato", appRoutes.commercial.marketIntelligence],
      ["Explorer", appRoutes.commercial.explorer],
    ],
  },
  {
    title: "Opportunità commerciali",
    description: "Trova domanda, account da riattivare e possibilità di conversione.",
    links: [
      ["Segnali di domanda", appRoutes.commercial.demand],
      ["Riattivazione", appRoutes.commercial.reengagement],
      ["Conversione", appRoutes.commercial.conversion],
    ],
  },
  {
    title: "Relazioni",
    description: "Ricostruisci connessioni tra conversazioni, aziende e trattative.",
    links: [["Relazioni cross-thread", appRoutes.commercial.crossThreadRelationships]],
  },
] as const;

export default async function CommercialHomePage() {
  const { metrics, recent, mode, operational } = await getDashboardData();

  const metricCards = [
    { label: "RFQ", value: operational.rfqs },
    { label: "Offerte", value: operational.offers },
    { label: "Ordini", value: operational.orders },
    { label: "Da verificare", value: metrics.reviewFlags },
  ];

  return (
    <FocusPage className="max-w-[1120px]">
      <PilotEvent eventName="commercial_home_viewed" metadata={{ surface: "commercial_home" }} />
      <FocusHeader
        eyebrow="Commerciale"
        title="La memoria commerciale della tua azienda"
        description={
          <>
            Cerca subito ciò che ti serve e usa Product 360, Company 360 e intelligence solo quando
            vuoi approfondire. Tutto resta nel workspace privato della tua organizzazione.
            <span className="mt-2 block text-xs font-semibold text-[#5d6a65]">
              {mode === "live"
                ? "Dati live"
                : mode === "demo"
                  ? "Modalità demo"
                  : "Dati in attesa di associazione"}
            </span>
          </>
        }
      />

      <section className="rounded-3xl border border-[#b8d2c8] bg-[#edf5f2] p-5 sm:p-6">
        <p className="app-kicker">Cerca nella Commercial Memory</p>
        <h2 className="mt-2 text-xl font-semibold text-[#173f35] sm:text-2xl">
          Prodotto, cliente, RFQ, offerta, ordine o prezzo
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#52615b]">
          Parti da una parola, una misura, una norma, un grado o il nome di un&apos;azienda.
        </p>

        <form
          action={appRoutes.commercial.search}
          method="get"
          className="mt-5 flex flex-col gap-2 sm:flex-row"
        >
          <label htmlFor="commercial-memory-search" className="sr-only">
            Cerca nella memoria commerciale
          </label>
          <input
            id="commercial-memory-search"
            name="q"
            type="search"
            placeholder="Es. S355J2H, EN 10219, 100x100x5, cliente..."
            className="h-12 min-w-0 flex-1 rounded-xl border border-[#c9d9d3] bg-white px-4 text-sm text-[#1d2824] outline-none placeholder:text-[#5d6a65] focus:border-[#438d7a] focus:ring-4 focus:ring-[#dcebe6]"
          />
          <button
            type="submit"
            className="app-primary min-h-12 rounded-xl px-6 text-sm font-semibold"
          >
            Cerca
          </button>
        </form>
      </section>

      <section aria-labelledby="commercial-overview">
        <FocusSectionHeader
          eyebrow="Memoria disponibile"
          title={<span id="commercial-overview">Cosa contiene il workspace</span>}
          action={
            <Link href={appRoutes.commercial.explorer} className="text-xs font-semibold text-[#173f35] hover:underline">
              Esplora tutto →
            </Link>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metricCards.map((item) => (
            <div key={item.label} className="rounded-2xl border border-[#dce2df] bg-white p-4">
              <p className="metric-number text-2xl font-semibold text-[#173f35]">{item.value}</p>
              <p className="mt-1 text-xs font-semibold text-[#5d6a65]">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="commercial-recent">
        <FocusSectionHeader
          eyebrow="Attività recente"
          title={<span id="commercial-recent">Ultimi movimenti</span>}
          action={
            <Link href={appRoutes.commercial.search} className="text-xs font-semibold text-[#173f35] hover:underline">
              Apri storico →
            </Link>
          }
        />

        {recent.length === 0 ? (
          <FirstUseEmptyState
            eyebrow="Memoria ancora vuota"
            title="Qui compariranno le ultime RFQ, offerte e ordini"
            description="Quando il workspace contiene dati commerciali, questa sezione mostra solo gli ultimi movimenti utili."
            primaryAction={{
              href: appRoutes.commercial.search,
              label: "Apri la ricerca",
            }}
            compact
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#dce2df] bg-white">
            {recent.slice(0, 5).map((row, index) => (
              <Link
                key={row.id}
                href={row.operationalHref ?? appRoutes.commercial.conversation(row.conversationId)}
                className={[
                  "flex flex-col gap-3 p-4 transition hover:bg-[#f8faf9] sm:flex-row sm:items-center sm:justify-between",
                  index > 0 ? "border-t border-[#edf1ef]" : "",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={row.role === "offered" ? "green" : row.role === "requested" ? "blue" : "violet"}>
                      {roleLabel(row.role)}
                    </Badge>
                    <span className="text-xs text-[#5d6a65]">{row.date}</span>
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-[#1d2824]">{row.product}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-[#5d6a65]">
                    {row.grade} · {row.standard} · {row.company}
                  </p>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-sm font-semibold text-[#1d2824]">{row.price ?? "—"}</p>
                  <p className="mt-1 text-xs text-[#5d6a65]">
                    {Math.round(row.confidence * 100)}% affidabilità
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="commercial-tools">
        <FocusSectionHeader
          eyebrow="Approfondisci"
          title={<span id="commercial-tools">Tre modi per leggere la memoria</span>}
        />

        <div className="grid gap-3 md:grid-cols-3">
          {coreTools.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#b8d2c8] hover:shadow-sm"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5d6a65]">
                {item.meta}
              </p>
              <div className="mt-2 flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-[#1d2824]">{item.title}</h3>
                <span className="font-semibold text-[#173f35]" aria-hidden="true">
                  →
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#5d6a65]">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="commercial-intelligence">
        <FocusSectionHeader
          eyebrow="Intelligence"
          title={<span id="commercial-intelligence">Analizza solo quando serve</span>}
          description="Gli strumenti avanzati sono raggruppati per obiettivo commerciale, non per architettura interna."
        />

        <div className="grid gap-3 lg:grid-cols-3">
          {intelligenceGroups.map((group) => (
            <div key={group.title} className="rounded-2xl border border-[#dce2df] bg-white p-5">
              <h3 className="text-base font-semibold text-[#1d2824]">{group.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#5d6a65]">{group.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.links.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="inline-flex min-h-10 items-center rounded-xl border border-[#d7dfdb] bg-[#f8faf9] px-3 text-xs font-semibold text-[#173f35] transition hover:border-[#9db9af] hover:bg-[#edf5f2]"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="rounded-xl border border-[#d9e8e2] bg-[#f3f7f5] px-4 py-3 text-xs leading-5 text-[#52615b]">
        La Commercial Memory è privata per la tua organizzazione. Network e Marketplace restano spazi separati
        e non pubblicano automaticamente dati commerciali interni.
      </p>
    </FocusPage>
  );
}
