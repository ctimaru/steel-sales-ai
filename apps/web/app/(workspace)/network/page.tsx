import Link from "next/link";
import { redirect } from "next/navigation";

import {
  followNetworkCompany,
  removeSavedNetworkCompany,
  saveNetworkCompany,
  unfollowNetworkCompany,
} from "@/app/(workspace)/network/actions";
import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { FocusHeader, FocusPage, FocusSectionHeader } from "@/components/focus-ui";
import { NetworkAccessGate } from "@/components/network-access-gate";
import { PilotEvent } from "@/components/pilot-event";
import { canWriteWorkspace } from "@/lib/access-policy";
import {
  getFollowedNetworkCompanies,
  getNetworkTaxonomy,
  getSavedNetworkCompanies,
  searchNetwork,
} from "@/lib/network";
import { getNetworkAccessState } from "@/lib/network-access";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { appRoutes } from "@/lib/routes";
import { getWorkspaceContext } from "@/lib/workspace-context";

function selectClass() {
  return "h-11 w-full rounded-xl border border-[#dce2df] bg-white px-3 text-sm text-[#2b3d46] outline-none transition focus:border-[#82aa9b] focus:ring-4 focus:ring-[#e1ece8]";
}

const companyTypeDoors = [
  { key: "", label: "Tutta la filiera" },
  { key: "producer", label: "Produttori" },
  { key: "trader_distributor", label: "Commercianti" },
  { key: "processor_service_provider", label: "Terzisti" },
  { key: "end_user", label: "Utilizzatori" },
] as const;

function companyTypeHref(role: string) {
  const query = new URLSearchParams();
  if (role) query.set("role", role);
  query.set("product", "tubes_pipes");
  query.set("country", "IT");
  return `/network?${query.toString()}`;
}

function currentDirectoryPath(params: {
  q?: string;
  role?: string;
  product?: string;
  capability?: string;
  country?: string;
  market?: string;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `/network?${serialized}` : "/network";
}

function compactList(items: { name: string }[], limit = 2) {
  return items.slice(0, limit);
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
    message?: string;
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
  const canWrite = canWriteWorkspace(context.role);

  const [taxonomy, results, saved, followed] = await Promise.all([
    getNetworkTaxonomy(),
    searchNetwork({
      query: params.q,
      role: params.role,
      product: params.product,
      capability: params.capability,
      country: params.country,
      market: params.market,
    }),
    getSavedNetworkCompanies(),
    getFollowedNetworkCompanies(context.organizationId),
  ]);

  const savedIds = new Set(saved.map((item) => item.network_company_id));
  const followedIds = new Set(followed.items.map((item) => item.network_company_id));
  const hasAdvancedFilters = Boolean(
    params.role ||
      params.product ||
      params.capability ||
      params.country ||
      params.market,
  );
  const quickTubeContext =
    params.product === "tubes_pipes" && (params.country ?? "").toUpperCase() === "IT";
  const returnTo = currentDirectoryPath(params);

  return (
    <FocusPage className="max-w-[1180px]">
      <PilotEvent eventName="network_directory_viewed" metadata={{ surface: "network_directory" }} />
      {params.q || hasAdvancedFilters ? (
        <PilotEvent
          eventName="network_search_completed"
          outcome={results.total > 0 ? "success" : "empty"}
          resultCount={results.total}
          metadata={{ surface: "network_directory" }}
        />
      ) : null}

      <FocusHeader
        eyebrow="Network"
        title="Trova aziende steel"
        description={
          <>
            Cerca aziende per nome o dominio e restringi solo quando serve per ruolo, prodotto,
            capability, mercato o paese.
            <span className="mt-2 block text-xs font-semibold text-[#5d6a65]">
              Directory privata del Network · la Commercial Memory resta separata
            </span>
          </>
        }
      />

      {params.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {params.error}
        </div>
      ) : null}
      {params.message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {params.message}
        </div>
      ) : null}

      <section className="rounded-3xl border border-[#b8d2c8] bg-[#edf5f2] p-5 sm:p-6">
        <p className="app-kicker">Ricerca aziende</p>
        <h2 className="mt-2 text-xl font-semibold text-[#173f35] sm:text-2xl">
          Nome o dominio
        </h2>
        <p className="mt-1 text-sm leading-6 text-[#52615b]">
          Parti dall&apos;identità aziendale. I filtri tecnici servono dopo, non prima.
        </p>

        <form className="mt-5 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="network-company-search" className="sr-only">
              Nome azienda o dominio
            </label>
            <input
              id="network-company-search"
              name="q"
              type="search"
              aria-label="Nome azienda o dominio"
              defaultValue={params.q ?? ""}
              placeholder="Es. Padana Tubi, acciaitubi.it..."
              className="h-12 min-w-0 flex-1 rounded-xl border border-[#c9d9d3] bg-white px-4 text-sm text-[#1d2824] outline-none placeholder:text-[#5d6a65] focus:border-[#438d7a] focus:ring-4 focus:ring-[#dcebe6]"
            />
            {params.role ? <input type="hidden" name="role" value={params.role} /> : null}
            {params.product ? <input type="hidden" name="product" value={params.product} /> : null}
            {params.capability ? <input type="hidden" name="capability" value={params.capability} /> : null}
            {params.country ? <input type="hidden" name="country" value={params.country} /> : null}
            {params.market ? <input type="hidden" name="market" value={params.market} /> : null}
            <button className="app-primary min-h-12 rounded-xl px-6 text-sm font-semibold">
              Cerca
            </button>
            {params.q || hasAdvancedFilters ? (
              <Link
                href={appRoutes.network.directory}
                className="app-secondary inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold"
              >
                Azzera
              </Link>
            ) : null}
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Tipologia azienda">
          <span className="mr-1 text-xs font-semibold text-[#5d6a65]">Italia · Tubes & Pipes</span>
          {companyTypeDoors.map((door) => {
            const active = quickTubeContext && (params.role ?? "") === door.key;
            return (
              <Link
                key={door.key || "all"}
                href={companyTypeHref(door.key)}
                aria-current={active ? "page" : undefined}
                aria-label={door.key === "processor_service_provider" ? "Carpenterie & terzisti" : door.label}
                className={[
                  "inline-flex min-h-10 items-center rounded-full border px-3.5 text-xs font-semibold transition",
                  active
                    ? "border-[#82aa9b] bg-white text-[#173f35]"
                    : "border-[#cfe0d9] bg-white/70 text-[#43524c] hover:border-[#9db9af] hover:bg-white",
                ].join(" ")}
              >
                {door.label}
              </Link>
            );
          })}
        </div>

        <details open={hasAdvancedFilters} className="mt-4 rounded-2xl border border-[#cfe0d9] bg-white/70">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#43524c]">
            Filtri
            <span className="ml-2 text-xs font-normal text-[#5d6a65]">
              {hasAdvancedFilters
                ? "· filtri attivi"
                : "· ruolo, prodotto, capability, mercato e paese"}
            </span>
          </summary>
          <form className="grid gap-3 border-t border-[#d9e8e2] p-4 sm:grid-cols-2 lg:grid-cols-5">
            {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
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
            <div className="flex gap-2">
              <input
                name="country"
                defaultValue={params.country ?? ""}
                maxLength={2}
                placeholder="Paese, es. IT"
                aria-label="Paese"
                className="h-11 min-w-0 flex-1 rounded-xl border border-[#dce2df] bg-white px-3 text-sm uppercase text-[#2b3d46] outline-none placeholder:normal-case placeholder:text-[#5d6a65] focus:border-[#82aa9b] focus:ring-4 focus:ring-[#e1ece8]"
              />
              <button className="app-primary h-11 rounded-xl px-4 text-xs font-semibold">
                Applica
              </button>
            </div>
          </form>
        </details>
      </section>

      <section aria-labelledby="network-results">
        <FocusSectionHeader
          eyebrow="Directory"
          title={
            <span id="network-results">
              {results.total.toLocaleString("it-IT")} {results.total === 1 ? "azienda" : "aziende"}
            </span>
          }
          description="Profili industriali pubblicati nel Network."
          action={
            <div className="flex flex-wrap gap-2 text-xs">
              <Link
                href={appRoutes.network.saved}
                className="rounded-full border border-[#d7dfdb] bg-white px-3 py-1.5 font-semibold text-[#43524c] hover:border-[#9db9af]"
              >
                Salvate · {saved.length}
              </Link>
              <Link
                href={appRoutes.network.following}
                className="rounded-full border border-[#d7dfdb] bg-white px-3 py-1.5 font-semibold text-[#43524c] hover:border-[#9db9af]"
              >
                Seguite · {followed.total}
              </Link>
            </div>
          }
        />

        {results.items.length === 0 ? (
          params.q || hasAdvancedFilters ? (
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
          <div className="overflow-hidden rounded-2xl border border-[#dce2df] bg-white">
            {results.items.map((company, index) => {
              const isSaved = savedIds.has(company.id);
              const isFollowed = followedIds.has(company.id);

              return (
                <article
                  key={company.id}
                  className={[
                    "grid gap-4 p-4 transition hover:bg-[#f8faf9] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center",
                    index > 0 ? "border-t border-[#edf1ef]" : "",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5d6a65]">
                        {company.country_code || "—"}
                      </span>
                      {company.verification_status === "verified" ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Verificata
                        </span>
                      ) : null}
                      {company.claimed_status === "unclaimed" ? (
                        <span className="rounded-full bg-[#fff4e8] px-2 py-0.5 text-[10px] font-bold text-[#8a461f]">
                          Profilo rivendicabile
                        </span>
                      ) : null}
                    </div>
                    <Link
                      href={appRoutes.network.company(company.id)}
                      className="mt-1 block truncate text-base font-semibold text-[#1d2824] hover:text-[#173f35] hover:underline"
                    >
                      {company.legal_name}
                    </Link>
                    <p className="mt-1 truncate text-xs text-[#5d6a65]">
                      {company.trading_name || company.website_domain || "Profilo Network"}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5d6a65]">Ruolo & prodotti</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {compactList(company.roles).map((role) => (
                        <span key={role.name} className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-xs font-semibold text-[#173f35]">
                          {role.name}
                        </span>
                      ))}
                      {compactList(company.products).map((product) => (
                        <span key={product.name} className="rounded-full bg-[#f2f4f3] px-2.5 py-1 text-xs text-[#43524c]">
                          {product.name}
                        </span>
                      ))}
                      {company.roles.length === 0 && company.products.length === 0 ? (
                        <span className="text-xs text-[#5d6a65]">Non ancora classificata</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5d6a65]">Capability</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {compactList(company.capabilities).map((capability) => (
                        <span key={capability.name} className="rounded-full border border-[#dce2df] bg-white px-2.5 py-1 text-xs text-[#43524c]">
                          {capability.name}
                        </span>
                      ))}
                      {company.capabilities.length === 0 ? (
                        <span className="text-xs text-[#5d6a65]">Non pubblicate</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {canWrite ? (
                      <>
                        <form action={isSaved ? removeSavedNetworkCompany : saveNetworkCompany}>
                          <input type="hidden" name="network_company_id" value={company.id} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <button
                            className={[
                              "inline-flex min-h-10 items-center rounded-xl border px-3 text-xs font-semibold transition",
                              isSaved
                                ? "border-[#9db9af] bg-[#edf5f2] text-[#173f35]"
                                : "border-[#d7dfdb] bg-white text-[#43524c] hover:border-[#9db9af]",
                            ].join(" ")}
                          >
                            {isSaved ? "Salvata" : "Salva"}
                          </button>
                        </form>
                        <form action={isFollowed ? unfollowNetworkCompany : followNetworkCompany}>
                          <input type="hidden" name="network_company_id" value={company.id} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <button
                            className={[
                              "inline-flex min-h-10 items-center rounded-xl border px-3 text-xs font-semibold transition",
                              isFollowed
                                ? "border-[#9db9af] bg-[#edf5f2] text-[#173f35]"
                                : "border-[#d7dfdb] bg-white text-[#43524c] hover:border-[#9db9af]",
                            ].join(" ")}
                          >
                            {isFollowed ? "Seguita" : "Segui"}
                          </button>
                        </form>
                      </>
                    ) : null}
                    <Link
                      href={appRoutes.network.company(company.id)}
                      className="app-primary inline-flex min-h-10 items-center rounded-xl px-3.5 text-xs font-semibold"
                    >
                      Apri
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </FocusPage>
  );
}
