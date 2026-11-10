import Link from "next/link";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { canWriteWorkspace } from "@/lib/access-policy";
import { appRoutes } from "@/lib/routes";
import { commercialSearchHref } from "@/lib/commercial-search-context";
import { getWorkspaceContext } from "@/lib/workspace-context";

import { loadCompanyActivationStatus, loadCompanyDirectory } from "./actions";

export const dynamic = "force-dynamic";

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

const companyTypeLabels: Record<string, string> = {
  customer: "Cliente", client: "Cliente", buyer: "Cliente",
  supplier: "Fornitore", vendor: "Fornitore", mill: "Produttore", producer: "Produttore",
  distributor: "Distributore", trader: "Trader", service_center: "Centro servizi",
  both: "Cliente e fornitore", other: "Altro",
};
function companyTypeLabel(value: string) {
  return companyTypeLabels[value.trim().toLowerCase()] ?? value;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const [directory, activation, context] = await Promise.all([
    loadCompanyDirectory(query || undefined),
    loadCompanyActivationStatus(),
    getWorkspaceContext(),
  ]);
  const canWrite = canWriteWorkspace(context.role);

  return (
    <div className="mx-auto max-w-5xl space-y-4" data-testid="companies-clean-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#3e7957]">Commerciale</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#143f30]">Aziende</h1>
        </div>
        <details className="group relative [&_summary::-webkit-details-marker]:hidden">
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-full border border-[#d6e5db] bg-white px-4 text-sm font-semibold text-[#175640] hover:bg-[#f2f8f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
            Altro <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
          </summary>
          <div className="mt-1 flex min-w-[240px] flex-col gap-1 rounded-xl border border-[#d6e5db] bg-white p-2 text-sm font-semibold shadow-lg sm:absolute sm:right-0 sm:top-full sm:z-30">
            <Link href={appRoutes.commercial.home + "?prospects=1#commercial-prospects"} className="rounded-lg px-3 py-2 text-[#254f3d] hover:bg-[#eef6f1]">Aziende da seguire</Link>
            <Link href={appRoutes.network.directory} className="rounded-lg px-3 py-2 text-[#254f3d] hover:bg-[#eef6f1]">Scopri aziende nel Network</Link>
            <Link href={commercialSearchHref(query, "companies")} className="rounded-lg px-3 py-2 text-[#254f3d] hover:bg-[#eef6f1]">Cerca nello storico aziende</Link>
          </div>
        </details>
      </div>

      {activation.unresolvedContacts > 0 ? (
        <p data-testid="companies-identity-alert"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[#ecd9a8] bg-[#fff8e6] px-4 py-2.5 text-sm text-[#6b4a07]">
          <span className="font-semibold">Da verificare</span>
          <span>{activation.unresolvedContacts === 1
            ? "1 contatto da collegare a un’azienda."
            : `${activation.unresolvedContacts} contatti da collegare a un’azienda.`}</span>
          <Link href={appRoutes.operations.reviewIdentities} className="font-semibold underline underline-offset-2">Collega ora →</Link>
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#4f6b5b]">
          <span className="font-semibold text-[#143f30]">{directory.total}</span> {directory.total === 1 ? "azienda" : "aziende"}{query ? ` per “${query}”` : ""}
          {query ? <> · <Link href={appRoutes.commercial.companies} className="font-semibold text-[#175640] underline underline-offset-2">Azzera ricerca</Link></> : null}
        </p>
        <form method="get" role="search" className="relative min-w-0 sm:w-[320px]">
          <label htmlFor="companies-q" className="sr-only">Cerca azienda, P.IVA o paese</label>
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#7a9184]">⌕</span>
          <input id="companies-q" type="search" name="q" defaultValue={query} maxLength={80}
            placeholder="Cerca azienda, P.IVA o paese"
            className="min-h-10 w-full rounded-full border border-[#d6e5db] bg-white pl-8 pr-4 text-sm text-[#143f30] placeholder:text-[#7a9184] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]" />
          <button type="submit" className="sr-only">Cerca aziende</button>
        </form>
      </div>

      {directory.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {directory.error}
        </div>
      ) : directory.companies.length === 0 ? (
        query ? (
          <FirstUseEmptyState
            eyebrow="Ricerca senza risultati"
            title="Nessuna azienda corrisponde a questa ricerca"
            description="L’elenco mostra solo le aziende del tuo workspace. Azzera la ricerca oppure prova con una ragione sociale, una P.IVA o un paese meno specifici."
            primaryAction={{
              href: appRoutes.commercial.companies,
              label: "Azzera ricerca",
            }}
            secondaryAction={{
              href: appRoutes.commercial.search,
              label: "Cerca nello storico",
            }}
          />
        ) : (
          <FirstUseEmptyState
            title="Le aziende nasceranno dallo storico commerciale"
            description={
              activation.unresolvedContacts > 0
                ? "Ci sono contatti ancora da collegare a un’azienda. Collegali per vedere qui conversazioni, RFQ, offerte e ordini."
                : "Non ci sono ancora aziende. Importa lo storico commerciale: le aziende vengono create o collegate solo quando l’identità è verificata."
            }
            primaryAction={
              activation.unresolvedContacts > 0
                ? {
                    href: appRoutes.operations.reviewIdentities,
                    label: "Collega i contatti",
                  }
                : {
                    href: canWrite
                      ? appRoutes.operations.uploads
                      : appRoutes.commercial.explorer,
                    label: canWrite
                      ? "Importa i primi documenti"
                      : "Apri Commercial Explorer",
                  }
            }
            secondaryAction={{
              href: appRoutes.network.directory,
              label: "Esplora il Network pubblico",
            }}
            note="La scheda privata dell’azienda e il profilo pubblico nel Network restano separati."
          />
        )
      ) : (
        <section aria-label="Elenco aziende" className="overflow-hidden rounded-2xl border border-[#d6e5db] bg-white">
          <div className="divide-y divide-[#edf3ef]">
            {directory.companies.map((company) => (
              <Link
                key={company.company_id}
                href={appRoutes.commercial.company(company.company_id)}
                data-testid="company-row"
                className="group flex min-h-[68px] items-center gap-3 px-4 py-3 transition hover:bg-[#f5faf7] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#175640] sm:px-5"
              >
                <span aria-hidden="true" title={company.verified ? "Identità verificata" : "Identità da verificare"}
                  className={"h-2.5 w-2.5 shrink-0 rounded-full " + (company.verified ? "bg-[#3d8a63]" : "bg-[#d9a62e]")} />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[#143f30]">{company.name}</span>
                    {company.company_type ? (
                      <span className="shrink-0 rounded-full bg-[#eef5f0] px-2 py-0.5 text-[11px] font-semibold text-[#315e49]">{companyTypeLabel(company.company_type)}</span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-[#5c7063]">
                    {[company.country, company.vat_number].filter(Boolean).join(" · ") || "Dati aziendali non disponibili"}
                    {company.verified ? "" : " · identità da verificare"}
                    <span className="sr-only">{company.verified ? " · identità verificata" : ""}</span>
                  </span>
                </span>
                <span className="hidden shrink-0 items-center gap-4 text-right md:flex">
                  {([["RFQ", company.rfq_count], ["Offerte", company.offer_count], ["Ordini", company.order_count]] as const).map(([label, value]) => (
                    <span key={label} className="w-14">
                      <span className="block text-base font-bold tabular-nums text-[#0f3a2b]">{String(value)}</span>
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#6b7d73]">{label}</span>
                    </span>
                  ))}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs tabular-nums text-[#5c7063]">{dateLabel(company.last_activity_at)}</span>
                  <span className="block text-[11px] text-[#6b7d73]">{String(company.contact_count)} contatti · {String(company.message_count)} msg</span>
                </span>
                <span aria-hidden="true" className="hidden text-[#9ab5a5] transition group-hover:translate-x-0.5 group-hover:text-[#175640] sm:inline">›</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
