"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";

import {
  addSupplierToBuyerRfq,
  addSuppliersToBuyerRfqBulk,
  getBuyerRfqSupplierPicker,
  removeSupplierFromBuyerRfq,
  searchBuyerRfqSuppliers,
  type SupplierCandidate,
  type SupplierPickerCandidate,
  type SupplierPickerGroup,
} from "@/app/(workspace)/marketplace/rfq-hub/actions";

/**
 * DISTINTA2 (founder decision, 18 Nov 2026): step 2 «A chi lo chiedi».
 * One place to choose the recipients of a draft RFQ: saved Network companies,
 * suppliers already used, private contacts and Network companies recommended
 * for the product families of the bill. Nothing is sent from here: «Rivedi e
 * invia» leads to the explicit confirmation below.
 */

export type RfqPickerSelectedSupplier = {
  id: string;
  name: string;
  email: string | null;
  channel: "email" | "platform" | "both";
  removable: boolean;
  networkCompanyId?: string | null;
};

/** DISTINTA2B: the Network company the request started from (server-verified). */
export type RfqPickerPinnedCompany = {
  id: string;
  name: string;
  country: string;
  role: string | null;
  products: string[];
};

type Row = SupplierCandidate & { group: SupplierPickerGroup | "search"; reachable: boolean; reason: string | null };

const groupTitles: Record<SupplierPickerGroup | "search", { title: string }> = {
  search: { title: "Risultati della ricerca" },
  saved: { title: "Salvati" },
  recent: { title: "Già usati" },
  contacts: { title: "Contatti" },
  recommended: { title: "Consigliati" },
};
const ROWS_PER_PAGE = 6;

const familyLabels: Record<string, string> = {
  tubes_pipes: "tubi",
  flat_products: "prodotti piani",
  long_products: "prodotti lunghi",
};

const MAX_BATCH = 20;

function channelLabel(channel: SupplierCandidate["delivery_channel"]) {
  return channel === "both" ? "Email e piattaforma" : channel === "platform" ? "Piattaforma" : "Email";
}

export function RfqSupplierPicker({
  rfqId, selected, canEdit, pinned = null, sendPanel = null,
}: {
  rfqId: string;
  selected: RfqPickerSelectedSupplier[];
  canEdit: boolean;
  pinned?: RfqPickerPinnedCompany | null;
  /** DISTINTA2D: step 3 (send), shown under the recipients in the right column. */
  sendPanel?: ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [networkEnabled, setNetworkEnabled] = useState(true);
  const [families, setFamilies] = useState<string[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [searchRows, setSearchRows] = useState<Row[] | null>(null);
  const [checked, setChecked] = useState<Record<string, Row>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [tab, setTab] = useState<SupplierPickerGroup | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const searchSeq = useRef(0);
  // DISTINTA2B: the starting company is proposed (and pre-checked once), never added.
  const [pinnedRow, setPinnedRow] = useState<Row | "unreachable" | null>(null);
  const pinnedPrechecked = useRef(false);
  const pinnedAlreadySelected = Boolean(pinned && selected.some((supplier) => supplier.networkCompanyId === pinned.id));

  // Reload the groups whenever the recipients change (added or removed).
  const selectedKey = selected.map((supplier) => supplier.id).join(",");
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBuyerRfqSupplierPicker(rfqId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.error ?? "Non è stato possibile caricare i fornitori.");
        return;
      }
      setLoadError("");
      setNetworkEnabled(result.networkEnabled !== false);
      setFamilies(result.families ?? []);
      setGroups((result.candidates ?? []) as Row[]);
    });
    return () => { cancelled = true; };
  }, [rfqId, selectedKey]);

  useEffect(() => {
    if (!pinned || loading || pinnedAlreadySelected) return;
    const inGroups = groups.find((row) => row.supplier_network_company_id === pinned.id);
    if (inGroups) { setPinnedRow(inGroups); return; }
    let cancelled = false;
    searchBuyerRfqSuppliers(rfqId, pinned.name).then((result) => {
      if (cancelled) return;
      const match = result.ok
        ? (result.candidates ?? []).find((candidate) => candidate.supplier_network_company_id === pinned.id)
        : undefined;
      setPinnedRow(match ? { ...match, group: "search", reachable: true, reason: null } : "unreachable");
    });
    return () => { cancelled = true; };
  }, [pinned, loading, groups, rfqId, pinnedAlreadySelected]);

  useEffect(() => {
    if (!pinnedRow || pinnedRow === "unreachable" || pinnedPrechecked.current || !canEdit || !pinnedRow.reachable) return;
    pinnedPrechecked.current = true;
    setChecked((current) => ({ ...current, [pinnedRow.identity_key]: pinnedRow }));
  }, [pinnedRow, canEdit]);

  // Search by name, email, VAT or domain across contacts, history and Network.
  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2) { setSearchRows(null); return; }
    const seq = ++searchSeq.current;
    const timer = window.setTimeout(() => {
      searchBuyerRfqSuppliers(rfqId, clean).then((result) => {
        if (seq !== searchSeq.current) return;
        setSearchRows(result.ok
          ? (result.candidates ?? []).map((candidate) => ({ ...candidate, group: "search" as const, reachable: true, reason: null }))
          : []);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, rfqId]);

  const sections = useMemo<Array<{ group: SupplierPickerGroup | "search"; rows: Row[] }>>(() => {
    if (searchRows) return [{ group: "search" as const, rows: searchRows
      .filter((row) => !(pinned && row.supplier_network_company_id === pinned.id)) }];
    return (["saved", "recent", "contacts", "recommended"] as const)
      .map((group) => ({ group, rows: groups.filter((row) => row.group === group
        && !(pinned && row.supplier_network_company_id === pinned.id)) }));
  }, [groups, searchRows, pinned]);

  const checkedRows = Object.values(checked);
  const familyText = families.map((key) => familyLabels[key] ?? key).join(", ");

  function toggle(row: Row) {
    if (!row.reachable || !canEdit) return;
    const isChecked = Boolean(checked[row.identity_key]);
    if (!isChecked && checkedRows.length >= MAX_BATCH) {
      setMessage({ tone: "error", text: "Puoi aggiungerne fino a " + MAX_BATCH + " per volta." });
      return;
    }
    setMessage(null);
    setChecked((current) => {
      const next = { ...current };
      if (isChecked) delete next[row.identity_key];
      else next[row.identity_key] = row;
      return next;
    });
  }

  function addChecked() {
    if (!checkedRows.length) return;
    setMessage(null);
    startTransition(async () => {
      const result = await addSuppliersToBuyerRfqBulk({
        rfqId,
        candidates: checkedRows.map((row) => ({
          identity_key: row.identity_key, source: row.source, company_name: row.company_name,
          contact_name: row.contact_name, email: row.email, country_code: row.country_code,
          delivery_channel: row.delivery_channel, supplier_company_id: row.supplier_company_id,
          supplier_contact_id: row.supplier_contact_id, supplier_network_company_id: row.supplier_network_company_id,
          supplier_network_contact_id: row.supplier_network_contact_id,
          supplier_organization_id: row.supplier_organization_id, last_used_at: row.last_used_at,
          preferred: row.preferred,
        })),
      });
      const added = result.addedKeys.length;
      setChecked((current) => {
        const next = { ...current };
        for (const key of result.addedKeys) delete next[key];
        return next;
      });
      if (added) setQuery("");
      setMessage(result.failed.length
        ? { tone: "error", text: (added ? added + (added === 1 ? " fornitore aggiunto alla RFQ. " : " fornitori aggiunti alla RFQ. ") : "")
            + "Non aggiunti: " + result.failed.map((item) => item.error).filter(Boolean).slice(0, 2).join(" ") }
        : { tone: "ok", text: added + (added === 1 ? " fornitore aggiunto alla RFQ." : " fornitori aggiunti alla RFQ.") });
      router.refresh();
    });
  }

  function addManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    if (!email) { setMessage({ tone: "error", text: "Inserisci l'email del fornitore." }); return; }
    const target = event.currentTarget;
    startTransition(async () => {
      const result = await addSupplierToBuyerRfq({ rfqId, identitySource: "manual", supplierName: name || null, supplierEmail: email });
      if (!result.ok) { setMessage({ tone: "error", text: result.error ?? "Aggiunta non riuscita." }); return; }
      target.reset();
      setManualOpen(false);
      setMessage({ tone: "ok", text: "1 fornitore aggiunto alla RFQ." });
      router.refresh();
    });
  }

  function remove(supplier: RfqPickerSelectedSupplier) {
    setRemoving(supplier.id);
    setMessage(null);
    startTransition(async () => {
      const result = await removeSupplierFromBuyerRfq(rfqId, supplier.id);
      setRemoving(null);
      if (!result.ok) { setMessage({ tone: "error", text: result.error ?? "Non è stato possibile togliere il fornitore." }); return; }
      setMessage({ tone: "ok", text: supplier.name + " tolto dalla RFQ." });
      router.refresh();
    });
  }

  // DISTINTA2D: one group at a time (tabs), a few rows at a time.
  const visibleGroups = (["saved", "recent", "contacts", "recommended"] as const)
    .filter((group) => group === "recommended" || sections.some((section) => section.group === group && section.rows.length > 0));
  const defaultTab: SupplierPickerGroup = (["saved", "recent", "contacts"] as const)
    .find((group) => sections.some((section) => section.group === group && section.rows.length > 0)) ?? "recommended";
  const activeTab: SupplierPickerGroup = tab && visibleGroups.includes(tab) ? tab : defaultTab;
  const activeRows = searchRows
    ? (sections[0]?.rows ?? [])
    : (sections.find((section) => section.group === activeTab)?.rows ?? []);
  const shownRows = expanded ? activeRows : activeRows.slice(0, ROWS_PER_PAGE);

  function renderRow(row: Row) {
    const name = row.company_name || row.email || "Fornitore";
    const isChecked = Boolean(checked[row.identity_key]);
    const disabled = !row.reachable || !canEdit;
    return (
      <li key={row.group + ":" + row.identity_key}>
        <label className={"flex min-h-12 items-center gap-3 px-3 py-2 " +
          (disabled ? "cursor-not-allowed bg-[#fafbfa] opacity-70" : "cursor-pointer hover:bg-[#f4f9f5]") +
          (isChecked ? " bg-[#eaf4ee]" : "")}>
          <input type="checkbox" checked={isChecked} disabled={disabled} onChange={() => toggle(row)}
            aria-label={"Seleziona " + name}
            className="h-5 w-5 shrink-0 accent-[#175640]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[#173f35]">{name}</span>
            <span className="block truncate text-[11px] text-[#5c7063]">
              {row.reachable ? (row.reason ?? channelLabel(row.delivery_channel)) : "Nessun contatto verificato: non si può ancora invitare"}
            </span>
          </span>
          {row.country_code ? <span className="shrink-0 text-[10px] font-semibold text-[#6b7f73]">{row.country_code}</span> : null}
        </label>
      </li>
    );
  }

  function emptyText() {
    if (searchRows) return "Nessun risultato. Puoi aggiungerlo a mano con la sua email.";
    if (activeTab !== "recommended") return "Nessuno in questo gruppo.";
    return familyText
      ? "Nessuna azienda contattabile del Network lavora " + familyText + " per ora. Cerca per nome o aggiungi a mano."
      : "Non riconosco il tipo di prodotto della distinta: cerca per nome o aggiungi a mano.";
  }

  return (
    <div data-testid="rfq-supplier-picker" className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <section aria-labelledby="rfq-picker-title" className="min-w-0 rounded-2xl border border-[#d6e5db] bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="rfq-picker-title" className="text-base font-bold text-[#143f30]">A chi chiedi l&apos;offerta?</h2>
          <p className="text-[11px] text-[#5c7063]">Spunta e aggiungi. Da qui non parte nulla.</p>
        </div>

        {pinned ? (
          <section aria-label="Da cui sei partito" data-testid="rfq-picker-pinned" className="mt-3">
            <h3 className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#1a5144]">Da cui sei partito</h3>
            {(() => {
              const subtitle = ["Dal Network", pinned.role, pinned.products.join(", "), pinned.country !== "—" ? pinned.country : null]
                .filter(Boolean).join(" · ");
              if (pinnedAlreadySelected) {
                return (
                  <p className="rounded-xl border border-[#cfe3d7] bg-[#f4faf6] px-3 py-2.5 text-sm">
                    <span className="font-semibold text-[#173f35]">{pinned.name}</span>
                    <span className="block text-[11px] text-[#2f5a45]">Già tra i destinatari ✓</span>
                  </p>
                );
              }
              if (pinnedRow === "unreachable") {
                return (
                  <p className="rounded-xl border border-dashed border-[#d6c9a4] bg-[#fffaf0] px-3 py-2.5 text-sm">
                    <span className="font-semibold text-[#173f35]">{pinned.name}</span>
                    <span className="block text-[11px] leading-4 text-[#6b5520]">
                      Nessun contatto verificato: non si può ancora invitare. Se hai la sua email, aggiungila a mano.
                    </span>
                  </p>
                );
              }
              if (!pinnedRow) return <p className="px-1 text-xs text-[#5c7063]">Cerco {pinned.name}…</p>;
              const isChecked = Boolean(checked[pinnedRow.identity_key]);
              return (
                <label className={"flex min-h-12 items-center gap-3 rounded-xl border border-[#b9d3c4] px-3 py-2 " +
                  (canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-70") + (isChecked ? " bg-[#eaf4ee]" : " bg-white")}>
                  <input type="checkbox" checked={isChecked} disabled={!canEdit} onChange={() => toggle(pinnedRow)}
                    aria-label={"Seleziona " + pinned.name} className="h-5 w-5 shrink-0 accent-[#175640]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#173f35]">{pinned.name}</span>
                    <span className="block truncate text-[11px] text-[#5c7063]">{subtitle}</span>
                  </span>
                </label>
              );
            })()}
          </section>
        ) : null}

        <div className="relative mt-3">
          <label htmlFor="rfq-picker-search" className="sr-only">Cerca un fornitore</label>
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6b8475]">⌕</span>
          <input id="rfq-picker-search" type="search" value={query} autoComplete="off"
            onChange={(event) => { setQuery(event.target.value); setMessage(null); setExpanded(false); }}
            placeholder="Cerca per nome, email, P.IVA o sito"
            className="h-11 w-full rounded-xl border border-[#c9dccf] bg-white pl-9 pr-3 text-sm text-[#173f35] outline-none focus:border-[#175640] focus:ring-2 focus:ring-[#175640]/15" />
        </div>

        {!searchRows ? (
          <div role="tablist" aria-label="Gruppi di fornitori" className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
            {visibleGroups.map((group) => {
              const count = sections.find((section) => section.group === group)?.rows.length ?? 0;
              const selectedTab = group === activeTab;
              return (
                <button key={group} type="button" role="tab" aria-selected={selectedTab}
                  onClick={() => { setTab(group); setExpanded(false); }}
                  className={"shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition " +
                    (selectedTab ? "border-[#175640] bg-[#175640] text-white" : "border-[#d6e5db] bg-white text-[#2f5a45] hover:bg-[#f2f8f4]")}>
                  {groupTitles[group].title} <span className={selectedTab ? "text-white/80" : "text-[#6b7f73]"}>{count}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#1a5144]">
            {groupTitles.search.title} · {activeRows.length}
          </p>
        )}

        <div role={searchRows ? undefined : "tabpanel"} className="mt-2">
          {loading && !searchRows ? <p className="px-1 py-3 text-sm text-[#5c7063]">Carico i fornitori…</p>
            : loadError && !searchRows ? <p role="alert" className="px-1 py-3 text-sm font-semibold text-[#8c431e]">{loadError}</p>
            : !searchRows && activeTab === "recommended" && !networkEnabled ? (
              <p className="rounded-xl border border-dashed border-[#d4c58f] bg-[#fffaf0] p-3 text-xs leading-5 text-[#6b5520]">
                <strong className="font-bold">Consigliati dal Network</strong> · disponibili con Network PRO: aziende che lavorano i prodotti della tua distinta.
              </p>
            ) : !activeRows.length ? (
              <p className="rounded-xl bg-[#f6f9f7] px-3 py-3 text-xs text-[#5c7063]">{emptyText()}</p>
            ) : (
              <>
                {!searchRows && activeTab === "recommended" && familyText ? (
                  <p className="mb-1.5 px-1 text-[11px] text-[#5c7063]">Aziende del Network che lavorano {familyText}</p>
                ) : null}
                <ul className="divide-y divide-[#edf2ee] overflow-hidden rounded-xl border border-[#e1eae4]">
                  {shownRows.map(renderRow)}
                </ul>
                {activeRows.length > ROWS_PER_PAGE ? (
                  <button type="button" onClick={() => setExpanded((value) => !value)}
                    className="mt-1.5 min-h-9 px-1 text-xs font-semibold text-[#175640] underline-offset-2 hover:underline">
                    {expanded ? "Mostra meno" : "Mostra altri " + (activeRows.length - ROWS_PER_PAGE)}
                  </button>
                ) : null}
              </>
            )}
        </div>

        {canEdit ? (
          <div className="mt-3 border-t border-[#e7eee9] pt-2">
            {manualOpen ? (
              <form onSubmit={addManual} className="grid gap-2 pt-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <label className="sr-only" htmlFor="rfq-picker-manual-name">Nome del fornitore</label>
                <input id="rfq-picker-manual-name" name="name" placeholder="Nome azienda (facoltativo)"
                  className="h-11 rounded-xl border border-[#c9dccf] px-3 text-sm outline-none focus:border-[#175640]" />
                <label className="sr-only" htmlFor="rfq-picker-manual-email">Email del fornitore</label>
                <input id="rfq-picker-manual-email" name="email" type="email" required placeholder="offerte@fornitore.it"
                  className="h-11 rounded-xl border border-[#c9dccf] px-3 text-sm outline-none focus:border-[#175640]" />
                <button type="submit" disabled={pending}
                  className="h-11 rounded-xl border border-[#175640] px-4 text-sm font-bold text-[#175640] hover:bg-[#eef7f1] disabled:opacity-50">
                  Aggiungi
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setManualOpen(true)}
                className="min-h-10 text-xs font-semibold text-[#175640] underline-offset-2 hover:underline">
                + Aggiungi a mano con l&apos;email
              </button>
            )}
          </div>
        ) : null}

        {checkedRows.length ? (
          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#b9d3c4] bg-[#f3faf6] p-2.5 shadow-[0_8px_24px_rgba(19,65,43,0.12)] lg:bottom-3">
            <p className="text-xs font-semibold text-[#1d5748]">{checkedRows.length} selezionati</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setChecked({})} disabled={pending}
                className="min-h-10 px-2 text-xs font-semibold text-[#245f4f] underline disabled:opacity-50">Deseleziona</button>
              <button type="button" onClick={addChecked} disabled={pending}
                className="min-h-10 rounded-lg bg-[#175640] px-4 text-sm font-bold text-white hover:bg-[#104632] disabled:opacity-50">
                {pending ? "Aggiungo…" : "Aggiungi " + checkedRows.length + " alla RFQ"}
              </button>
            </div>
          </div>
        ) : null}

        <p role="status" aria-live="polite"
          className={"min-h-5 pt-2 text-xs font-semibold " + (message?.tone === "error" ? "text-[#8c431e]" : "text-[#1d5748]")}>
          {message ? (message.tone === "ok" ? "✓ " : "") + message.text : ""}
        </p>
      </section>

      <aside aria-label="Destinatari e invio" className="min-w-0 space-y-3 lg:sticky lg:top-24">
        <section aria-labelledby="rfq-picker-selected" className="rounded-2xl border border-[#d6e5db] bg-white p-3 sm:p-4">
          <h2 id="rfq-picker-selected" className="text-sm font-bold text-[#143f30]">
            Destinatari <span className="font-semibold text-[#6b7f73]">· {selected.length}</span>
          </h2>
          {selected.length ? (
            <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
              {selected.map((supplier) => (
                <li key={supplier.id} className="flex items-center gap-2 rounded-lg bg-[#f5f9f6] px-2.5 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-[#173f35]">{supplier.name}</span>
                    <span className="block truncate text-[10px] text-[#5c7063]">{supplier.email ?? channelLabel(supplier.channel)}</span>
                  </span>
                  {canEdit && supplier.removable ? (
                    <button type="button" onClick={() => remove(supplier)} disabled={pending}
                      aria-label={"Togli " + supplier.name}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#6b5b4a] hover:bg-[#f6ebe4] disabled:opacity-50">
                      {removing === supplier.id ? "…" : "×"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs leading-5 text-[#5c7063]">Ancora nessuno: spunta i fornitori e premi «Aggiungi».</p>
          )}
        </section>
        {sendPanel}
      </aside>
    </div>
  );
}
