import Link from "next/link";

import {
  dismissMarketplaceNotification,
  openMarketplaceNotification,
} from "@/app/(workspace)/marketplace/actions";
import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { MarketplaceCountdown } from "@/components/marketplace-countdown";
import {
  getMarketplaceNotifications,
  type MarketplaceMatchBand,
  type MarketplaceMatchLine,
} from "@/lib/marketplace";
import { appRoutes } from "@/lib/routes";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

function bandLabel(band: MarketplaceMatchBand) {
  if (band === "strong") return "Match forte";
  if (band === "good") return "Buon match";
  return "Match ampio";
}

function bandClasses(band: MarketplaceMatchBand) {
  if (band === "strong") return "bg-emerald-50 text-emerald-700";
  if (band === "good") return "bg-[#edf5f2] text-[#173f35]";
  return "bg-amber-50 text-amber-700";
}

function responseLabel(status: string | null) {
  if (!status) return null;
  if (status === "draft") return "Risposta in bozza";
  if (status === "submitted") return "Risposta inviata";
  if (status === "acknowledged") return "Presa in carico dal buyer";
  if (status === "declined") return "Risposta declinata";
  if (status === "withdrawn") return "Risposta ritirata";
  if (status === "closed") return "Risposta chiusa";
  return status;
}

function reasonLabel(code: string) {
  if (code === "product_family_exact") return "Famiglia prodotto";
  if (code === "standard_exact") return "Norma compatibile";
  if (code === "standard_unknown") return "Norma non dichiarata";
  if (code === "grade_exact") return "Grado compatibile";
  if (code === "grade_unknown") return "Grado non dichiarato";
  if (code === "company_verified") return "Profilo verificato";
  if (code.startsWith("dimension_") && code.endsWith("_exact")) {
    return "Range dimensionale compatibile";
  }
  if (code.startsWith("dimension_") && code.endsWith("_unknown")) {
    return "Range non dichiarato";
  }
  return null;
}

function visibleReasons(lines: MarketplaceMatchLine[]) {
  const labels = new Set<string>();
  for (const line of lines) {
    for (const code of line.reason_codes) {
      const label = reasonLabel(code);
      if (label) labels.add(label);
      if (labels.size >= 5) return [...labels];
    }
  }
  return [...labels];
}

function firstTeaser(item: {
  teaser: {
    teaser_lines: Array<{
      product_family_name: string;
      quantity_band: string;
      delivery_country_code: string;
      delivery_region?: string;
    }>;
  };
}) {
  return item.teaser.teaser_lines[0] ?? null;
}

export default async function MarketplaceNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ error, message }, context] = await Promise.all([
    searchParams,
    getWorkspaceContext(),
  ]);
  const inbox = await getMarketplaceNotifications(context.organizationId, {
    limit: 100,
    offset: 0,
  });

  const strongCount = inbox.items.filter(
    (item) => item.match.band === "strong",
  ).length;
  const goodCount = inbox.items.filter(
    (item) => item.match.band === "good",
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={appRoutes.marketplace.home}
          className="text-sm font-semibold text-[#66736e] hover:text-[#173f35]"
        >
          ← Torna alle opportunità
        </Link>
        <Link
          href={appRoutes.marketplace.responses}
          className="text-sm font-semibold text-[#173f35] hover:underline"
        >
          Risposte Marketplace →
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-[#dce2df] bg-white">
        <div className="h-1 bg-[#1a5144]" />
        <div className="p-6 sm:p-8">
          <div className="max-w-3xl">
            <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Matching Marketplace
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1d2824]">
              Opportunità per te
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              Match deterministici calcolati sullo scope tecnico pubblico del tuo
              Company Profile. Il punteggio spiega la compatibilità ma non concede
              accesso ai dettagli o diritto di risposta.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-[#e2e7e4] bg-[#f7f9f8] p-4">
              <p className="metric-number text-2xl font-semibold text-[#1d2824]">
                {inbox.total}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#66736e]">
                Opportunità attive
              </p>
            </div>
            <div className="rounded-2xl border border-[#e2e7e4] bg-[#f7f9f8] p-4">
              <p className="metric-number text-2xl font-semibold text-[#1d2824]">
                {inbox.unread}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#66736e]">
                Da leggere
              </p>
            </div>
            <div className="rounded-2xl border border-[#e2e7e4] bg-[#f7f9f8] p-4">
              <p className="metric-number text-2xl font-semibold text-[#1d2824]">
                {strongCount}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#66736e]">
                Match forti
              </p>
            </div>
            <div className="rounded-2xl border border-[#e2e7e4] bg-[#f7f9f8] p-4">
              <p className="metric-number text-2xl font-semibold text-[#1d2824]">
                {goodCount}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#66736e]">
                Buoni match
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#d9e8e2] bg-[#f3f7f5] px-5 py-4">
        <p className="text-sm font-semibold text-[#173f35]">
          Come viene calcolato
        </p>
        <p className="mt-1 text-sm leading-6 text-[#66736e]">
          Famiglia prodotto esatta obbligatoria. Norma, grado e range dimensionali
          dichiarati aumentano la confidenza; un mismatch esplicito esclude il
          supplier. Dati non dichiarati restano “unknown” e abbassano il punteggio,
          senza inventare capacità non presenti nel profilo.
        </p>
      </section>

      {inbox.items.length === 0 ? (
        <FirstUseEmptyState
          eyebrow="Matching supplier"
          title="Nessuna opportunità selezionata per il tuo profilo"
          description="Il matching usa lo scope tecnico pubblico del Company Profile. Prodotti, norme, gradi e range dimensionali dichiarati rendono la selezione più precisa senza inventare capacità non presenti."
          primaryAction={{
            href: appRoutes.network.manage,
            label: "Completa Company Profile",
          }}
          secondaryAction={{
            href: appRoutes.marketplace.home,
            label: "Vedi tutte le opportunità",
          }}
          note="Il punteggio di compatibilità non modifica i permessi di accesso o di risposta."
        />
      ) : (
        <section className="space-y-4">
          {inbox.items.map((item) => {
            const first = firstTeaser(item);
            const reasons = visibleReasons(item.match.lines);
            const response = responseLabel(item.response_status);

            return (
              <article
                key={item.notification_id}
                className={[
                  "rounded-3xl border bg-white p-5 sm:p-6",
                  item.status === "unread"
                    ? "border-[#b8d2c8] shadow-sm"
                    : "border-[#dce2df]",
                ].join(" ")}
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.status === "unread" ? (
                        <span className="rounded-full bg-[#1a5144] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
                          Nuova
                        </span>
                      ) : null}
                      <span
                        className={
                          "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] " +
                          bandClasses(item.match.band)
                        }
                      >
                        {bandLabel(item.match.band)} · {item.match.score}/100
                      </span>
                      <span className="rounded-full bg-[#f2f4f3] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]">
                        {item.teaser.buyer.visibility_mode === "anonymous"
                          ? "Buyer anonimo"
                          : "Buyer visibile"}
                      </span>
                    </div>

                    <h2 className="mt-4 text-lg font-semibold text-[#1d2824]">
                      {first?.product_family_name ?? "Opportunità Marketplace"}
                    </h2>

                    {first ? (
                      <p className="mt-2 text-sm text-[#66736e]">
                        {first.quantity_band}
                        {" · "}
                        Consegna {first.delivery_country_code}
                        {first.delivery_region
                          ? " · " + first.delivery_region
                          : ""}
                      </p>
                    ) : null}

                    <p className="mt-2 text-xs text-[#87938e]">
                      Compatibili {item.match.matched_line_count} /{" "}
                      {item.match.total_line_count} linee · algoritmo{" "}
                      {item.match.algorithm_version}
                    </p>

                    {reasons.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {reasons.map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full border border-[#dce2df] bg-[#f8faf9] px-2.5 py-1 text-[11px] font-semibold text-[#66736e]"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {response ? (
                      <p className="mt-4 text-xs font-semibold text-[#173f35]">
                        {response}
                      </p>
                    ) : null}
                  </div>

                  <div className="w-full rounded-2xl border border-[#e2e7e4] bg-[#f7f9f8] p-4 lg:w-56">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">
                      Tempo residuo
                    </p>
                    <div className="mt-2">
                      <MarketplaceCountdown
                        initialSeconds={item.teaser.seconds_remaining}
                      />
                    </div>

                    <form action={openMarketplaceNotification} className="mt-4">
                      <input
                        type="hidden"
                        name="notification_id"
                        value={item.notification_id}
                      />
                      <input
                        type="hidden"
                        name="request_id"
                        value={item.request_id}
                      />
                      <button className="w-full rounded-xl bg-[#1a5144] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#226657]">
                        Apri opportunità
                      </button>
                    </form>

                    <form action={dismissMarketplaceNotification} className="mt-2">
                      <input
                        type="hidden"
                        name="notification_id"
                        value={item.notification_id}
                      />
                      <button className="w-full rounded-xl border border-[#d7dfdb] bg-white px-4 py-2 text-xs font-semibold text-[#66736e] hover:bg-[#f2f4f3]">
                        Rimuovi da Per te
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
