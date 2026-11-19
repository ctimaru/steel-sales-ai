import Link from "next/link";
import { redirect } from "next/navigation";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { canWriteWorkspace } from "@/lib/access-policy";
import { appRoutes } from "@/lib/routes";
import { commercialSearchHref } from "@/lib/commercial-search-context";
import { getWorkspaceContext } from "@/lib/workspace-context";

import styles from "@/components/commercial-cinematic.module.css";

import { loadClientDirectory, loadCompanyActivationStatus, type ClientSegment } from "./actions";

export const dynamic = "force-dynamic";

// COMM-CLIENTS1 (founder decision, 19 Nov 2026): «Aziende» becomes «Clienti».
//   Clienti    = aziende con almeno un ordine non annullato
//   Potenziali = aziende con richieste d'offerta o offerte, ancora senza ordini
// Le aziende con sole email restano cercabili in «Cerca nello storico». Le liste
// del Network (salvate, connesse) vivono nel Network e in Fornitori.

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

function listHref(segment: ClientSegment, query = "", page = 1) {
  const params = new URLSearchParams();
  if (segment === "prospects") params.set("lista", "potenziali");
  if (query) params.set("q", query);
  if (page > 1) params.set("p", String(page));
  const search = params.toString();
  return appRoutes.commercial.companies + (search ? "?" + search : "");
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lista?: string; p?: string }>;
}) {
  const params = await searchParams;
  // Vecchi segnalibri delle liste Network: portano dove le liste vivono ora.
  if (params.lista === "salvate") redirect(appRoutes.network.saved);
  if (params.lista === "connesse") redirect(appRoutes.network.connections);

  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const segment: ClientSegment = params.lista === "potenziali" ? "prospects" : "clients";
  const requestedPage = Number(params.p);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 1 && requestedPage <= 400 ? requestedPage : 1;
  const context = await getWorkspaceContext();
  const [directory, activation] = await Promise.all([
    loadClientDirectory(segment, query, page),
    loadCompanyActivationStatus(),
  ]);
  const pages = Math.max(1, Math.ceil(directory.total / directory.pageSize));
  // Pagina oltre la fine (ad es. dopo una ricerca): si torna all'ultima.
  if (!directory.error && directory.total > 0 && page > pages) redirect(listHref(segment, query, pages));
  const canWrite = canWriteWorkspace(context.role);
  const listTabs = [
    { key: "clients", label: "Clienti", count: directory.counts.clients },
    { key: "prospects", label: "Potenziali", count: directory.counts.prospects },
  ] as const;
  const nothingYet = !directory.error && !query && directory.counts.clients + directory.counts.prospects === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-4" data-testid="companies-clean-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#3e7957]">Ufficio commerciale</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#143f30]">Clienti</h1>
        </div>
        <details className="group relative [&_summary::-webkit-details-marker]:hidden">
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-full border border-[#d6e5db] bg-white px-4 text-sm font-semibold text-[#175640] hover:bg-[#f2f8f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
            Altro <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
          </summary>
          <div className="mt-1 flex min-w-[240px] flex-col gap-1 rounded-xl border border-[#d6e5db] bg-white p-2 text-sm font-semibold shadow-lg sm:absolute sm:right-0 sm:top-full sm:z-30">
            <Link href={appRoutes.network.directory} className="rounded-lg px-3 py-2 text-[#254f3d] hover:bg-[#eef6f1]">Scopri aziende nel Network</Link>
            <Link href={appRoutes.network.saved} className="rounded-lg px-3 py-2 text-[#254f3d] hover:bg-[#eef6f1]">Aziende salvate nel Network</Link>
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
        <nav aria-label="Clienti e potenziali" data-testid="companies-list-tabs" className="flex gap-1 overflow-x-auto">
          {listTabs.map((item) => (
            <Link key={item.key} href={listHref(item.key, query)} aria-current={item.key === segment ? "page" : undefined}
              className={"inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] " +
                (item.key === segment ? "bg-[#175640] " + styles.tabActive : "text-[#4f6b5b] hover:bg-[#e8f3ec] hover:text-[#143f30]")}>
              {item.label}
              {directory.error ? null : <span className="text-xs tabular-nums opacity-70">{item.count}</span>}
            </Link>
          ))}
        </nav>
        <form method="get" role="search" className="relative min-w-0 sm:w-[320px]">
          {segment === "prospects" ? <input type="hidden" name="lista" value="potenziali" /> : null}
          <label htmlFor="companies-q" className="sr-only">Cerca cliente, P.IVA o paese</label>
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#7a9184]">⌕</span>
          <input id="companies-q" type="search" name="q" defaultValue={query} maxLength={80}
            placeholder="Cerca cliente, P.IVA o paese"
            className="min-h-10 w-full rounded-full border border-[#d6e5db] bg-white pl-8 pr-4 text-sm text-[#143f30] placeholder:text-[#7a9184] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]" />
          <button type="submit" className="sr-only">Cerca clienti</button>
        </form>
      </div>

      <p className="px-1 text-xs text-[#5c7063]" data-testid="companies-segment-note">
        {segment === "clients"
          ? "Aziende che hanno fatto almeno un ordine. Le più recenti per ultimo ordine."
          : "Aziende che hanno chiesto un’offerta o l’hanno ricevuta, ma non hanno ancora ordinato."}
        {query ? <> · <Link href={listHref(segment)} className="font-semibold text-[#175640] underline underline-offset-2">Azzera ricerca</Link></> : null}
      </p>

      {directory.error ? (
        <div role="status" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {directory.error}
        </div>
      ) : nothingYet ? (
        <FirstUseEmptyState
          title="I clienti nasceranno dalle richieste d’offerta"
          description={
            activation.unresolvedContacts > 0
              ? "Ci sono contatti ancora da collegare a un’azienda. Collegali per vedere qui richieste, offerte e ordini dei tuoi clienti."
              : "Non ci sono ancora richieste, offerte o ordini collegati a un’azienda. Importa lo storico commerciale: le aziende vengono create o collegate solo quando l’identità è verificata."
          }
          primaryAction={
            activation.unresolvedContacts > 0
              ? { href: appRoutes.operations.reviewIdentities, label: "Collega i contatti" }
              : canWrite
                ? { href: appRoutes.operations.uploads, label: "Importa i primi documenti" }
                : { href: appRoutes.commercial.search, label: "Cerca nello storico" }
          }
          secondaryAction={{ href: appRoutes.network.directory, label: "Esplora il Network pubblico" }}
          note="La scheda privata dell’azienda e il profilo pubblico nel Network restano separati."
        />
      ) : directory.companies.length === 0 ? (
        <div className="rounded-2xl border border-[#d6e5db] bg-white px-5 py-8 text-center" data-testid="companies-empty">
          <p className="text-sm font-semibold text-[#143f30]">
            {query ? "Nessuna azienda corrisponde a questa ricerca"
              : segment === "clients" ? "Nessun cliente con ordini" : "Nessun potenziale cliente"}
          </p>
          <p className="mt-1 text-xs text-[#5c7063]">
            {query ? "Prova con una ragione sociale, una P.IVA o un paese meno specifici, oppure cerca in tutto lo storico."
              : segment === "clients" ? "Un’azienda diventa cliente con il primo ordine. Quelle con richieste o offerte sono tra i Potenziali."
              : "Tutte le aziende con richieste o offerte hanno già ordinato: le trovi tra i Clienti."}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link href={listHref(segment === "clients" ? "prospects" : "clients", query)}
              className="inline-flex min-h-10 items-center rounded-full border border-[#d6e5db] px-4 text-sm font-semibold text-[#175640] hover:bg-[#f2f8f4]">
              {segment === "clients" ? "Vedi i Potenziali" : "Vedi i Clienti"}
            </Link>
            {query ? (
              <Link href={commercialSearchHref(query, "companies")}
                className="inline-flex min-h-10 items-center rounded-full border border-[#d6e5db] px-4 text-sm font-semibold text-[#175640] hover:bg-[#f2f8f4]">
                Cerca nello storico
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <section aria-label={segment === "clients" ? "Elenco clienti" : "Elenco potenziali clienti"} className="overflow-hidden rounded-2xl border border-[#d6e5db] bg-white">
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
                    {company.company_type && !["other", "customer", "client", "buyer"].includes(company.company_type.trim().toLowerCase()) ? (
                      <span className="shrink-0 rounded-full bg-[#eef5f0] px-2 py-0.5 text-[11px] font-semibold text-[#315e49]">{companyTypeLabel(company.company_type)}</span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-[#5c7063]">
                    {[company.country, company.vat_number].filter(Boolean).join(" · ") || "Dati aziendali non disponibili"}
                    {company.verified ? "" : " · identità da verificare"}
                    <span className="sr-only">{company.verified ? " · identità verificata" : ""}</span>
                  </span>
                </span>
                <span className="hidden shrink-0 items-center gap-4 border-r border-[#edf3ef] pr-5 text-right md:flex">
                  {([["Richieste", company.rfq_count], ["Offerte", company.offer_count], ["Ordini", company.order_count]] as const).map(([label, value]) => (
                    <span key={label} className="w-16">
                      <span className="block text-base font-bold tabular-nums text-[#0f3a2b]">{String(value)}</span>
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#6b7d73]">{label}</span>
                    </span>
                  ))}
                </span>
                <span className="shrink-0 pl-1 text-right md:min-w-[132px]">
                  <span className="block text-xs tabular-nums text-[#5c7063]">
                    {dateLabel(segment === "clients" ? company.last_order_at : company.last_activity_at)}
                  </span>
                  <span className="block text-[11px] text-[#6b7d73]">{segment === "clients" ? "Ultimo ordine" : "Ultima attività"}</span>
                </span>
                <span aria-hidden="true" className="hidden text-[#9ab5a5] transition group-hover:translate-x-0.5 group-hover:text-[#175640] sm:inline">›</span>
              </Link>
            ))}
          </div>
          {pages > 1 ? (
            <nav aria-label="Pagine" className="flex items-center justify-between gap-2 border-t border-[#edf2ef] px-4 py-2.5" data-testid="companies-pager">
              {page > 1 ? (
                <Link href={listHref(segment, query, page - 1)} className="inline-flex min-h-9 items-center rounded-full border border-[#d6e5db] px-3 text-xs font-semibold text-[#175640] hover:bg-[#eef6f1]">← Precedenti</Link>
              ) : <span />}
              <span className="text-xs tabular-nums text-[#5c7063]">Pagina {Math.min(page, pages)} di {pages}</span>
              {page < pages ? (
                <Link href={listHref(segment, query, page + 1)} className="inline-flex min-h-9 items-center rounded-full border border-[#d6e5db] px-3 text-xs font-semibold text-[#175640] hover:bg-[#eef6f1]">Successive →</Link>
              ) : <span />}
            </nav>
          ) : null}
        </section>
      )}
    </div>
  );
}
