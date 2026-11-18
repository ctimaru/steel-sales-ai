import Link from "next/link";

import { SupplierContactForm } from "@/components/supplier-contact-form";
import { canWriteWorkspace } from "@/lib/access-policy";
import { formatHubDate } from "@/lib/rfq-hub-overview";
import type { SupplierDirectoryData } from "@/lib/rfqh11-supplier";
import {
  buildSupplierBook,
  supplierBookCanAddContact,
  supplierBookFilter,
  supplierBookHref,
  supplierBookView,
  type SupplierBookCompany,
  type SupplierBookContact,
  type SupplierBookSaved,
  type SupplierBookView,
} from "@/lib/rfqhub-suppliers";
import { appRoutes } from "@/lib/routes";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fornitori RFQ", robots: privateNoIndexRobots };

const CONTACTS_SHOWN = 3;

type SavedRow = {
  network_company_id: string;
  created_at: string | null;
  network_companies: { legal_name: string | null; trading_name: string | null; country_code: string | null } | null;
};

/**
 * RFQHUB1B (founder decision, 18 Nov 2026): «Fornitori RFQ» = the supplier
 * address book. Active suppliers come from the RFQ history (RFQH11 profiles),
 * saved companies from the Network, contacts from the organization's
 * Commerciale. Read-only for viewers; nothing is sent from here.
 */
export default async function SupplierDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vista?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const view: SupplierBookView = supplierBookView(params.vista);

  const context = await getWorkspaceContext();
  const organizationId = context.organizationId;
  const canWrite = canWriteWorkspace(context.role);
  const supabase = await createClient();

  const [directory, savedResult] = await Promise.all([
    supabase.rpc("rfqh11_supplier_directory", {
      p_query: null, p_preferred_only: false, p_tag: null, p_limit: 200, p_offset: 0,
    }),
    supabase.from("network_saved_companies")
      .select("network_company_id,created_at,network_companies(legal_name,trading_name,country_code)")
      .eq("organization_id", organizationId)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const directoryData = directory.data && typeof directory.data === "object" && !Array.isArray(directory.data)
    ? (directory.data as SupplierDirectoryData) : null;
  const profiles = directoryData?.items ?? [];
  const saved: SupplierBookSaved[] = ((savedResult.data ?? []) as unknown as SavedRow[]).map((row) => ({
    network_company_id: row.network_company_id,
    name: row.network_companies?.trading_name?.trim() || row.network_companies?.legal_name || null,
    country_code: row.network_companies?.country_code ?? null,
    saved_at: row.created_at,
  }));

  const networkIds = [...new Set([
    ...profiles.map((p) => p.supplier_network_company_id).filter((id): id is string => Boolean(id)),
    ...saved.map((s) => s.network_company_id),
  ])];
  const profileCompanyIds = [...new Set(profiles.map((p) => p.supplier_company_id).filter((id): id is string => Boolean(id)))];

  let companies: SupplierBookCompany[] = [];
  let contacts: SupplierBookContact[] = [];
  let contactsError = false;
  if (networkIds.length || profileCompanyIds.length) {
    const filters = [
      networkIds.length ? "network_company_id.in.(" + networkIds.join(",") + ")" : null,
      profileCompanyIds.length ? "id.in.(" + profileCompanyIds.join(",") + ")" : null,
    ].filter(Boolean).join(",");
    const companyResult = await supabase.from("companies")
      .select("id,name,network_company_id")
      .eq("organization_id", organizationId)
      .or(filters)
      .limit(500);
    contactsError = Boolean(companyResult.error);
    companies = (companyResult.data ?? []) as SupplierBookCompany[];
    const companyIds = companies.map((c) => c.id);
    if (companyIds.length) {
      const contactResult = await supabase.from("contacts")
        .select("id,company_id,full_name,email,phone,role")
        .eq("organization_id", organizationId)
        .in("company_id", companyIds)
        .limit(1000);
      contactsError ||= Boolean(contactResult.error);
      contacts = (contactResult.data ?? []) as SupplierBookContact[];
    }
  }

  const book = buildSupplierBook({ profiles, saved, companies, contacts });
  const rows = supplierBookFilter(book, view, query);
  const tabs: { view: SupplierBookView; label: string; count: number }[] = [
    { view: "attivi", label: "Attivi", count: book.filter((r) => r.active).length },
    { view: "salvati", label: "Salvati", count: book.filter((r) => r.saved).length },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1180px] space-y-3 pb-8" data-testid="supplier-book">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--brand-primary)]">Ufficio acquisti</p>
          <h1 className="mt-0.5 text-xl font-extrabold text-[var(--brand-deep)]">Fornitori</h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">La tua rubrica fornitori: chi usi nelle richieste, le aziende salvate e i tuoi contatti per ciascuna.</p>
        </div>
        <Link href={appRoutes.network.directory}
          className="app-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-bold">
          Cerca nel Network →
        </Link>
      </header>

      <section aria-label="Rubrica fornitori" data-testid="supplier-book-list"
        className="min-w-0 rounded-xl border border-[var(--border)] bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav aria-label="Filtra fornitori" className="flex flex-wrap gap-1.5">
            {tabs.map((tab) => (
              <Link key={tab.view} href={supplierBookHref(tab.view, query)} aria-current={view === tab.view ? "page" : undefined}
                data-testid={"supplier-book-tab-" + tab.view}
                className={"inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold " +
                  (view === tab.view ? "border-[#175640] bg-[#175640] text-white" : "border-[#d6e5db] bg-white text-[#2f5a45] hover:bg-[#f2f8f4]")}>
                {tab.label}
                {tab.count ? <span className={"rounded-full px-1.5 text-[10px] font-bold " + (view === tab.view ? "bg-white/20" : "bg-[#eef2f0] text-[#3f544a]")}>{tab.count}</span> : null}
              </Link>
            ))}
          </nav>
          <form method="get" action="/rfq-hub/suppliers" role="search" className="flex min-w-0 items-center gap-1.5">
            {view !== "attivi" ? <input type="hidden" name="vista" value={view} /> : null}
            <label className="sr-only" htmlFor="supplier-book-search">Cerca fornitore o contatto</label>
            <input id="supplier-book-search" name="q" type="search" defaultValue={query} maxLength={80} placeholder="Cerca fornitore o contatto"
              className="h-9 w-44 min-w-0 rounded-lg border border-[#d6e5db] bg-white px-2.5 text-xs text-[var(--brand-deep)] sm:w-56" />
          </form>
        </div>

        {directory.error ? (
          <p role="status" className="mt-2 text-[11px] text-[var(--text-secondary)]">Lo storico delle richieste non è disponibile in questo momento.</p>
        ) : null}
        {contactsError ? (
          <p role="status" className="mt-2 text-[11px] text-[var(--text-secondary)]">I contatti non sono disponibili in questo momento.</p>
        ) : null}

        {!rows.length ? (
          <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
            {query ? "Nessun fornitore corrisponde alla ricerca."
              : view === "salvati" ? "Nessuna azienda salvata. Salvale dal Network con «Salva»."
              : "I fornitori compaiono qui quando li scegli in una richiesta."}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {rows.map((supplier) => {
              const shown = supplier.contacts.slice(0, CONTACTS_SHOWN);
              const hidden = supplier.contacts.slice(CONTACTS_SHOWN);
              return (
                <li key={supplier.key} data-testid="supplier-book-row" className="min-w-0 py-3">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="min-w-0 truncate text-sm font-bold text-[var(--brand-deep)]">{supplier.name}</span>
                        {supplier.preferred ? <span className="rounded-full bg-[#175640] px-2 py-0.5 text-[10px] font-bold text-white">Preferito</span> : null}
                        {supplier.saved ? <span className="rounded-full bg-[#e8f0f6] px-2 py-0.5 text-[10px] font-semibold text-[#284f6b]">Salvato nel Network</span> : null}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                        {supplier.active
                          ? supplier.rfqCount + (supplier.rfqCount === 1 ? " richiesta" : " richieste")
                            + (supplier.responseRatePct !== null ? " · risponde al " + Math.round(supplier.responseRatePct) + "%" : "")
                            + (supplier.lastUsedAt ? " · ultima " + formatHubDate(supplier.lastUsedAt) : "")
                          : "Salvata" + (supplier.savedAt ? " il " + formatHubDate(supplier.savedAt) : "") + " · non ancora usata nelle richieste"}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {supplier.profileId ? (
                        <Link href={appRoutes.rfqHub.supplier(supplier.profileId)}
                          className="inline-flex min-h-9 items-center rounded-lg bg-[var(--brand-primary-soft)] px-2.5 text-xs font-bold text-[var(--brand-deep)]">Scheda</Link>
                      ) : supplier.networkCompanyId ? (
                        <Link href={appRoutes.network.company(supplier.networkCompanyId)}
                          className="inline-flex min-h-9 items-center rounded-lg bg-[var(--brand-primary-soft)] px-2.5 text-xs font-bold text-[var(--brand-deep)]">Profilo</Link>
                      ) : null}
                    </span>
                  </div>

                  <div className="mt-1.5 min-w-0" data-testid="supplier-book-contacts">
                    {shown.length ? (
                      <ul className="space-y-0.5">
                        {shown.map((contact) => (
                          <li key={contact.id} className="min-w-0 break-words text-xs text-[var(--brand-deep)]">
                            <span className="font-semibold">{contact.full_name}</span>
                            {contact.role ? <span className="text-[var(--text-secondary)]"> · {contact.role}</span> : null}
                            {contact.email ? <> · <a href={"mailto:" + contact.email} className="text-[#175e43] underline-offset-2 hover:underline">{contact.email}</a></> : null}
                            {contact.phone ? <span className="text-[var(--text-secondary)]"> · {contact.phone}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {supplier.fallbackEmail ? "Email usata nelle richieste: " + supplier.fallbackEmail : "Nessun contatto salvato."}
                      </p>
                    )}
                    {hidden.length ? (
                      <details className="mt-0.5">
                        <summary className="cursor-pointer text-[11px] font-semibold text-[#2f5a45]">+{hidden.length} {hidden.length === 1 ? "altro contatto" : "altri contatti"}</summary>
                        <ul className="mt-0.5 space-y-0.5">
                          {hidden.map((contact) => (
                            <li key={contact.id} className="min-w-0 break-words text-xs text-[var(--brand-deep)]">
                              <span className="font-semibold">{contact.full_name}</span>
                              {contact.role ? <span className="text-[var(--text-secondary)]"> · {contact.role}</span> : null}
                              {contact.email ? <> · <a href={"mailto:" + contact.email} className="text-[#175e43] hover:underline">{contact.email}</a></> : null}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    {canWrite && supplierBookCanAddContact(supplier) ? (
                      <div className="mt-1.5">
                        <SupplierContactForm supplierName={supplier.name}
                          networkCompanyId={supplier.companyId ? null : supplier.networkCompanyId}
                          companyId={supplier.companyId} />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="px-1 text-[11px] text-[var(--text-secondary)]">
        I contatti restano nella tua azienda e compaiono nel passo «A chi lo chiedi» di ogni nuova richiesta.
      </p>
    </div>
  );
}
