"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";

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
};

type Row = SupplierCandidate & { group: SupplierPickerGroup | "search"; reachable: boolean; reason: string | null };

const groupTitles: Record<SupplierPickerGroup | "search", { title: string; empty?: string }> = {
  search: { title: "Risultati della ricerca" },
  saved: { title: "Le tue aziende salvate" },
  recent: { title: "Già usati nelle tue richieste" },
  contacts: { title: "I tuoi contatti" },
  recommended: { title: "Consigliati per questa distinta" },
};

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
  rfqId, selected, canEdit,
}: {
  rfqId: string;
  selected: RfqPickerSelectedSupplier[];
  canEdit: boolean;
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
  const [pending, startTransition] = useTransition();
  const searchSeq = useRef(0);

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
    if (searchRows) return [{ group: "search" as const, rows: searchRows }];
    return (["saved", "recent", "contacts", "recommended"] as const)
      .map((group) => ({ group, rows: groups.filter((row) => row.group === group) }));
  }, [groups, searchRows]);

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

  return (
    <div data-testid="rfq-supplier-picker" className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <section aria-labelledby="rfq-picker-title" className="min-w-0 rounded-2xl border border-[#d6e5db] bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="rfq-picker-title" className="text-base font-bold text-[#143f30]">A chi chiedi l&apos;offerta?</h2>
          <p className="text-xs text-[#5c7063]">Spunta i fornitori e aggiungili. Niente viene inviato da qui.</p>
        </div>

        <div className="relative mt-3">
          <label htmlFor="rfq-picker-search" className="sr-only">Cerca un fornitore</label>
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6b8475]">⌕</span>
          <input id="rfq-picker-search" type="search" value={query} autoComplete="off"
            onChange={(event) => { setQuery(event.target.value); setMessage(null); }}
            placeholder="Cerca per nome, email, P.IVA o sito"
            className="h-11 w-full rounded-xl border border-[#c9dccf] bg-white pl-9 pr-3 text-sm text-[#173f35] outline-none focus:border-[#175640] focus:ring-2 focus:ring-[#175640]/15" />
        </div>

        {loading && !searchRows ? <p className="mt-4 text-sm text-[#5c7063]">Carico i fornitori…</p> : null}
        {loadError && !searchRows ? <p role="alert" className="mt-4 text-sm font-semibold text-[#8c431e]">{loadError}</p> : null}

        <div className="mt-3 space-y-4">
          {sections.map(({ group, rows }) => {
            if (group === "recommended" && !networkEnabled) {
              return (
                <div key={group} className="rounded-xl border border-dashed border-[#d4c58f] bg-[#fffaf0] p-3 text-xs leading-5 text-[#6b5520]">
                  <strong className="font-bold">Consigliati dal Network</strong> · disponibili con Network PRO: aziende che lavorano i prodotti della tua distinta.
                </div>
              );
            }
            if (!rows.length && group !== "search" && group !== "recommended") return null;
            const title = groupTitles[group].title;
            return (
              <section key={group} aria-label={title}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 px-1">
                  <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[#1a5144]">
                    {title} <span className="font-semibold text-[#6b7f73]">· {rows.length}</span>
                  </h3>
                  {group === "recommended" && familyText ? (
                    <p className="text-[11px] text-[#5c7063]">Aziende del Network che lavorano {familyText}</p>
                  ) : null}
                </div>
                {!rows.length ? (
                  <p className="rounded-xl bg-[#f6f9f7] px-3 py-3 text-xs text-[#5c7063]">
                    {group === "search"
                      ? "Nessun risultato. Puoi aggiungerlo a mano con la sua email."
                      : familyText
                        ? "Nessuna azienda contattabile del Network lavora " + familyText + " per ora. Cerca per nome o aggiungi a mano."
                        : "Non riconosco il tipo di prodotto della distinta: cerca per nome o aggiungi a mano."}
                  </p>
                ) : (
                  <ul className="divide-y divide-[#edf2ee] overflow-hidden rounded-xl border border-[#e1eae4]">
                    {rows.map((row) => {
                      const name = row.company_name || row.email || "Fornitore";
                      const isChecked = Boolean(checked[row.identity_key]);
                      const disabled = !row.reachable || !canEdit;
                      return (
                        <li key={group + ":" + row.identity_key}>
                          <label className={"flex min-h-14 items-center gap-3 px-3 py-2 " +
                            (disabled ? "cursor-not-allowed bg-[#fafbfa] opacity-70" : "cursor-pointer hover:bg-[#f4f9f5]") +
                            (isChecked ? " bg-[#eaf4ee]" : "")}>
                            <input type="checkbox" checked={isChecked} disabled={disabled} onChange={() => toggle(row)}
                              aria-label={"Seleziona " + name}
                              className="h-5 w-5 shrink-0 accent-[#175640]" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-[#173f35]">{name}</span>
                              <span className="block truncate text-[11px] text-[#5c7063]">
                                {[row.reason, row.reachable ? (row.email ?? channelLabel(row.delivery_channel)) : "Nessun contatto verificato: non si può ancora invitare"]
                                  .filter(Boolean).join(" · ")}
                              </span>
                            </span>
                            {row.country_code ? <span className="shrink-0 text-[10px] font-semibold text-[#6b7f73]">{row.country_code}</span> : null}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        {canEdit ? (
          <div className="mt-4 border-t border-[#e7eee9] pt-3">
            {manualOpen ? (
              <form onSubmit={addManual} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
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
                className="min-h-11 text-sm font-semibold text-[#175640] underline-offset-2 hover:underline">
                + Aggiungi un fornitore a mano con la sua email
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

      <aside aria-labelledby="rfq-picker-selected" className="rounded-2xl border border-[#d6e5db] bg-white p-3 sm:p-4 lg:sticky lg:top-24">
        <h2 id="rfq-picker-selected" className="text-sm font-bold text-[#143f30]">
          Destinatari <span className="font-semibold text-[#6b7f73]">· {selected.length}</span>
        </h2>
        {selected.length ? (
          <ul className="mt-2 space-y-1.5">
            {selected.map((supplier) => (
              <li key={supplier.id} className="flex items-center gap-2 rounded-lg bg-[#f5f9f6] px-2.5 py-2">
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
          <p className="mt-2 rounded-lg bg-[#f6f9f7] px-3 py-3 text-xs leading-5 text-[#5c7063]">
            Ancora nessuno. Spunta i fornitori a sinistra e premi «Aggiungi».
          </p>
        )}
        {selected.length ? (
          <a href="#rfq-review-send" data-testid="rfq-picker-review"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#175640] px-4 text-sm font-bold text-white hover:bg-[#104632]">
            Rivedi e invia →
          </a>
        ) : (
          <span aria-disabled="true"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#e6ede9] px-4 text-sm font-bold text-[#4b5d53]">
            Rivedi e invia →
          </span>
        )}
        <p className="mt-2 text-[11px] leading-4 text-[#5c7063]">L&apos;invio parte solo dopo la tua conferma finale.</p>
      </aside>
    </div>
  );
}
