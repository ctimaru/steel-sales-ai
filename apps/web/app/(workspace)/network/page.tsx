import Link from "next/link";
import { redirect } from "next/navigation";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { FocusHeader, FocusPage } from "@/components/focus-ui";
import { NetworkAccessGate } from "@/components/network-access-gate";
import { PilotEvent } from "@/components/pilot-event";
import { getNetworkTaxonomy, searchNetwork } from "@/lib/network";
import { getNetworkAccessState } from "@/lib/network-access";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { appRoutes } from "@/lib/routes";
import { getWorkspaceContext } from "@/lib/workspace-context";

function selectClass() {
  return "h-11 w-full rounded-xl border border-[#dce2df] bg-white px-3 text-sm text-[#2b3d46] outline-none transition focus:border-[#b8d2c8] focus:ring-4 focus:ring-[#e1ece8]";
}

const companyTypeDoors = [
  {
    key: "",
    label: "Tutta la filiera",
    description: "Italia · Tubes & Pipes",
  },
  {
    key: "producer",
    label: "Produttori",
    description: "Tubifici e produttori",
  },
  {
    key: "trader_distributor",
    label: "Commercianti",
    description: "Distributori e stockholder",
  },
  {
    key: "processor_service_provider",
    label: "Carpenterie & terzisti",
    description: "Lavorazione tubo e service center",
  },
  {
    key: "end_user",
    label: "Utilizzatori",
    description: "OEM, EPC e industria",
  },
] as const;

function companyTypeHref(role: string) {
  const query = new URLSearchParams();
  if (role) query.set("role", role);
  query.set("product", "tubes_pipes");
  query.set("country", "IT");
  return `/network?${query.toString()}`;
}

export default async function NetworkDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    role?: string;
    product?: string;
    capability?: string;
    country?: string;
    market?: string;
    error?: string;
  }>;
}) {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");

  const context = await getWorkspaceContext();
  const access = await getNetworkAccessState(context.organizationId);

  if (!access.can_access_network) {
    return (
      <NetworkAccessGate
        access={access}
        organizationName={context.organizationName}
      />
    );
  }

  const params = await searchParams;
  const [taxonomy, results] = await Promise.all([
    getNetworkTaxonomy(),
    searchNetwork({
      query: params.q,
      role: params.role,
      product: params.product,
      capability: params.capability,
      country: params.country,
      market: params.market,
    }),
  ]);

  const hasAdvancedFilters = Boolean(
    params.role ||
      params.product ||
      params.capability ||
      params.country ||
      params.market,
  );
  const quickTubeContext =
    params.product === "tubes_pipes" && (params.country ?? "").toUpperCase() === "IT";

  return (
    <FocusPage>
      <PilotEvent eventName="network_directory_viewed" metadata={{ surface: "network_directory" }} />

      <FocusHeader
        eyebrow="Network"
        title="Trova aziende e costruisci relazioni nel settore steel"
        description="Cerca per nome o dominio. Tipologia e filtri servono solo per restringere i risultati; la Commercial Memory della tua azienda resta privata e separata. Ritrova e segui: le aziende salvate, quelle seguite e i loro aggiornamenti sono sempre nel menu Network. Contatta le aziende dal profilo quando hai trovato quella giusta."
      />

      <section id="directory" className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#66736e]">Directory aziende</p>
          <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">Da dove vuoi partire?</h2>
          <p className="mt-1 text-sm text-[#66736e]">Seleziona una tipologia solo se ti aiuta a restringere la ricerca.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {companyTypeDoors.map((door) => {
            const active = quickTubeContext && (params.role ?? "") === door.key;
            return (
              <Link
                key={door.key || "all"}
                href={companyTypeHref(door.key)}
                className={`rounded-full border px-4 py-2.5 transition ${
                  active
                    ? "border-[#1a5144] bg-[#edf5f2] shadow-[inset_0_0_0_1px_#d9e8e2]"
                    : "border-[#dce2df] bg-white hover:border-[#b8d2c8] hover:bg-[#f6f8f7]"
                }`}
              >
                <p className={`text-sm font-semibold ${active ? "text-[#1a5144]" : "text-[#1d2824]"}`}>
                  {door.label}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Ricerca</p>
          <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">Cerca un&apos;azienda</h2>
          <p className="mt-1 text-sm text-[#66736e]">
            Parti dal nome o dal dominio. Usa i filtri avanzati solo quando servono.
          </p>
        </div>

        <form className="mt-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              name="q"
              aria-label="Nome azienda o dominio"
              defaultValue={params.q ?? ""}
              placeholder="Nome azienda o dominio"
              className="h-12 min-w-0 flex-1 rounded-xl border border-[#d7dfdb] px-4 text-sm text-[#1d2824] outline-none transition placeholder:text-[#66736e] focus:border-[#b8d2c8] focus:ring-4 focus:ring-[#e1ece8]"
            />
            <button className="h-12 rounded-xl bg-[#1a5144] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#226657]">
              Cerca
            </button>
            {(params.q || hasAdvancedFilters) ? (
              <Link
                href="/network"
                className="inline-flex h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold text-[#66736e] hover:bg-[#f5f8fc] hover:text-[#1a5144]"
              >
                Azzera
              </Link>
            ) : null}
          </div>

          <details
            open={hasAdvancedFilters}
            className="rounded-2xl border border-[#e7edf5] bg-[#f6f8f7]"
          >
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#43524c]">
              Filtri avanzati
              {hasAdvancedFilters ? (
                <span className="ml-2 text-xs font-medium text-[#1a5144]">· filtri attivi</span>
              ) : (
                <span className="ml-2 text-xs font-normal text-[#8a99ac]">· ruolo, prodotto, capability, mercato e paese</span>
              )}
            </summary>
            <div className="grid gap-3 border-t border-[#e7edf5] p-4 sm:grid-cols-2 lg:grid-cols-5">
              <select name="role" aria-label="Ruolo azienda" defaultValue={params.role ?? ""} className={selectClass()}>
                <option value="">Tutti i ruoli</option>
                {taxonomy.roles.map((item) => (
                  <option key={item.canonical_key} value={item.canonical_key}>
                    {item.display_name}
                  </option>
                ))}
              </select>
              <select name="product" aria-label="Famiglia prodotto" defaultValue={params.product ?? ""} className={selectClass()}>
                <option value="">Tutti i prodotti</option>
                {taxonomy.products.map((item) => (
                  <option key={item.canonical_key} value={item.canonical_key}>
                    {item.display_name}
                  </option>
                ))}
              </select>
              <select name="capability" aria-label="Capability" defaultValue={params.capability ?? ""} className={selectClass()}>
                <option value="">Tutte le capability</option>
                {taxonomy.capabilities.map((item) => (
                  <option key={item.canonical_key} value={item.canonical_key}>
                    {item.display_name}
                  </option>
                ))}
              </select>
              <select name="market" aria-label="Mercato" defaultValue={params.market ?? ""} className={selectClass()}>
                <option value="">Tutti i mercati</option>
                {taxonomy.markets.map((item) => (
                  <option key={item.canonical_key} value={item.canonical_key}>
                    {item.display_name}
                  </option>
                ))}
              </select>
              <input
                name="country"
                defaultValue={params.country ?? ""}
                maxLength={2}
                placeholder="Paese, es. IT"
                aria-label="Paese"
                className="h-11 w-full rounded-xl border border-[#dce2df] bg-white px-3 text-sm uppercase text-[#2b3d46] outline-none transition placeholder:normal-case focus:border-[#b8d2c8] focus:ring-4 focus:ring-[#e1ece8]"
              />
            </div>
          </details>
        </form>
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#66736e]">Risultati</p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
              {results.total.toLocaleString("it-IT")} {results.total === 1 ? "azienda trovata" : "aziende trovate"}
            </h2>
          </div>
          <p className="text-xs text-[#8a99ac]">Profili pubblici del Network</p>
        </div>

        {results.items.length === 0 ? (
          (params.q || hasAdvancedFilters) ? (
            <FirstUseEmptyState
              eyebrow="Ricerca senza risultati"
              title="Nessuna azienda trovata con questi filtri"
              description="Il Network non inventa profili mancanti. Azzera i filtri oppure amplia la ricerca per tornare alla directory completa."
              primaryAction={{
                href: appRoutes.network.directory,
                label: "Azzera ricerca e filtri",
              }}
              secondaryAction={{
                href: appRoutes.network.saved,
                label: "Apri aziende salvate",
              }}
            />
          ) : (
            <FirstUseEmptyState
              title="Il Network crescerà con i Company Profile pubblici"
              description="Non ci sono ancora profili disponibili in questa vista. Puoi comunque completare il profilo della tua azienda così che sia pronto per discovery, matching e claim governato."
              primaryAction={{
                href: appRoutes.network.manage,
                label: "Completa Company Profile",
              }}
              secondaryAction={{
                href: appRoutes.home,
                label: "Torna al workspace",
              }}
            />
          )
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {results.items.map((company) => (
              <Link
                key={company.id}
                href={"/network/" + company.id}
                className="group rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:border-[#b8d2c8] hover:shadow-[0_8px_24px_rgba(30,43,69,0.05)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8a99ac]">
                      {company.country_code || "—"}
                    </p>
                    <h3 className="mt-1 truncate text-lg font-semibold text-[#1d2824]">
                      {company.legal_name}
                    </h3>
                    {company.trading_name ? (
                      <p className="mt-1 truncate text-sm text-[#66736e]">{company.trading_name}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {company.verification_status === "verified" ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-700">
                        Verificato
                      </span>
                    ) : null}
                    {company.claimed_status === "unclaimed" ? (
                      <span className="rounded-full bg-[#fff4e8] px-2.5 py-1 text-[10px] font-bold text-[#9a4e22]">
                        Profilo rivendicabile
                      </span>
                    ) : null}
                  </div>
                </div>

                {(company.roles.length > 0 || company.products.length > 0) ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {company.roles.slice(0, 2).map((role) => (
                      <span
                        key={role.key}
                        className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-xs font-semibold text-[#1a5144]"
                      >
                        {role.name}
                      </span>
                    ))}
                    {company.products.slice(0, 2).map((product) => (
                      <span
                        key={product.key + product.relationship_type}
                        className="rounded-full bg-[#f2f5f9] px-2.5 py-1 text-xs text-[#5d6a65]"
                      >
                        {product.name}
                      </span>
                    ))}
                  </div>
                ) : null}

                <p className="mt-5 text-xs font-semibold text-[#1a5144] group-hover:text-[#226657]">
                  Apri profilo →
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </FocusPage>
  );
}
