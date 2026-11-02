import Link from "next/link";
import { redirect } from "next/navigation";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { NetworkCountryFlag } from "@/components/network-country-flag";
import { NetworkRfqSelectionBar } from "@/components/network-rfq-selection-bar";
import { NetworkSaveToggle } from "@/components/network-save-toggle";
import { getSavedNetworkCompanies } from "@/lib/network";
import { requireNetworkAccess } from "@/lib/network-access";
import { networkCountryName } from "@/lib/network-eu-countries";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { getNetworkRecipientReadiness, type RecipientReadinessStatus } from "@/lib/network-recipient-readiness";
import { getNetworkRfqReachability, type RfqChannel } from "@/lib/network-rfq-reachability";
import { isRfqReachable, networkRfqSelectionEnabled } from "@/lib/network-rfq-supplier-handoff";
import { canWriteWorkspace } from "@/lib/access-policy";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

/** NET-UX LOT1B — founder decision (2 Nov 2026): a private list each user keeps
 * to work on later. From here: open the profile, connect, or select companies
 * and prepare an RFQ (requests are sent only from the RFQ Hub). */
async function inChunks<T>(ids: string[], load: (chunk: string[]) => Promise<Map<string, T>>) {
  const result = new Map<string, T>();
  for (let index = 0; index < ids.length; index += 24) {
    const chunk = await load(ids.slice(index, index + 24)).catch(() => new Map<string, T>());
    chunk.forEach((value, key) => result.set(key, value));
  }
  return result;
}

function domainOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export default async function SavedNetworkCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");
  await requireNetworkAccess();
  const context = await getWorkspaceContext();
  const { error, message } = await searchParams;
  const saved = (await getSavedNetworkCompanies(context.organizationId).catch(() => []))
    .filter((item) => item.company && item.company.publication_status === "published");
  const ids = saved.map((item) => item.network_company_id);
  const readiness = await inChunks<RecipientReadinessStatus>(ids, (chunk) =>
    getNetworkRecipientReadiness(context.organizationId, chunk));
  const channels = await inChunks<RfqChannel>(ids, (chunk) =>
    getNetworkRfqReachability(context.organizationId, chunk, readiness));
  const rfqSelection = networkRfqSelectionEnabled();
  const canEdit = canWriteWorkspace(context.role);

  return (
    <main className="mx-auto max-w-[1180px] space-y-4 pb-8" data-testid="network-saved-list">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#173f35]">Aziende salvate</h1>
          <p className="mt-1 text-sm text-[#52615b]">
            La tua lista privata: la vedi solo tu e l&apos;azienda non riceve alcun avviso. Da qui puoi aprire i profili,
            connetterti o selezionare le aziende per una RFQ.
          </p>
        </div>
        <p className="text-xs text-[#52615b]">
          <strong className="tabular-nums text-[#173f35]">{saved.length}</strong> salvate
        </p>
      </header>

      {message ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}

      {saved.length ? (
        <section aria-label="Aziende salvate" className="overflow-hidden rounded-2xl border border-[#d7e3dc] bg-white">
          <div className="hidden gap-3 border-b border-[#e8eeeb] bg-[#f9fbfa] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#52615b] md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <span>Azienda</span><span>Paese</span><span>Contatto</span><span className="sr-only">Azioni</span>
          </div>
          {saved.map((item) => {
            const company = item.company;
            const name = company.trading_name || company.legal_name;
            const status = readiness.get(company.id);
            const channel = channels.get(company.id);
            const selectable = rfqSelection && isRfqReachable(status, channel);
            const country = (company.country_code || "").toUpperCase();
            return (
              <article key={company.id} data-testid="network-saved-row"
                className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#e8eeeb] px-3 py-3 last:border-b-0 hover:bg-[#f6faf8] sm:px-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div className="flex min-w-0 items-center gap-3">
                  {selectable ? (
                    <input type="checkbox" form="network-rfq-selection" name="supplier" value={company.id}
                      aria-label={"Seleziona " + name + " per una RFQ"} className="relative z-10 h-5 w-5 shrink-0 accent-[#175640]" />
                  ) : null}
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-[#173f35]">
                      <Link href={"/network/" + company.id} aria-label={"Apri profilo di " + name}
                        className="after:absolute after:inset-0 after:content-[''] hover:underline">{name}</Link>
                    </h2>
                    <p className="truncate text-xs text-[#52615b]">{domainOf(company.website_url) ?? "Sito non indicato"}</p>
                  </div>
                </div>
                <p className="hidden items-center gap-1.5 text-xs text-[#173f35] md:flex">
                  <NetworkCountryFlag code={country} /> {networkCountryName(country) || country}
                </p>
                <div className="hidden text-xs md:block">
                  {status === "available" ? (
                    <Link href={"/network/" + company.id + "/connect"} aria-label={"Connetti con " + name}
                      className="ui-action ui-action-primary relative z-10 inline-flex min-h-10 items-center rounded-lg px-3 font-semibold">Connetti</Link>
                  ) : status === "connected" ? <span className="font-semibold text-[#175640]">✓ Connessa</span>
                    : status === "pending" ? <span className="font-semibold text-[#175640]">Richiesta inviata</span>
                    : channel === "email" ? <span className="font-semibold text-[#175640]">Contattabile via email</span>
                    : <span className="text-[#647269]">Non ancora attiva</span>}
                </div>
                {canEdit ? <NetworkSaveToggle companyId={company.id} name={name} saved returnTo="/network/saved" compact /> : <span />}
              </article>
            );
          })}
        </section>
      ) : (
        <FirstUseEmptyState
          eyebrow="Lista privata"
          title="Non hai ancora salvato aziende"
          description="Nella ricerca o nel profilo di un'azienda premi ☆ per aggiungerla qui. Potrai riprenderla più tardi, connetterti o includerla in una RFQ."
          primaryAction={{ label: "Cerca aziende", href: "/network" }}
        />
      )}
      {rfqSelection && saved.length ? (
        <NetworkRfqSelectionBar userId={context.userId} organizationId={context.organizationId} />
      ) : null}
    </main>
  );
}
