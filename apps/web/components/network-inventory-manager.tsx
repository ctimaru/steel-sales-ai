"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCompanyInventory } from "@/app/(workspace)/network/actions";
import { networkInventoryDate } from "@/components/network-profile-inventory";
import {
  filterCompanyInventory,
  inventoryUnitLabel,
  inventoryUpdatedLabel,
  summarizeCompanyInventory,
} from "@/lib/company-inventory-workspace";
import type { ManagedNetworkInventory, NetworkInventoryItem, NetworkInventoryKind } from "@/lib/network-stock";

const fieldClass = "mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-[#d0ddd4] bg-white px-3 py-2 text-sm text-[#2d3934] outline-none focus:border-[#1a7651] focus:ring-2 focus:ring-[#e5efeb]";
const labelClass = "block min-w-0 text-xs font-semibold text-[#475e50]";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a7651] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45";
const primaryButton = buttonClass + " bg-[#1a5144] text-white hover:bg-[#226657]";
const secondaryButton = buttonClass + " border border-[#cddbd2] bg-white text-[#175640] hover:bg-[#f3f7f4]";
const units = [["t", "Tonnellate"], ["kg", "Chilogrammi"], ["m", "Metri"], ["bars", "Barre"], ["pcs", "Pezzi"]] as const;
const kinds = [["stock", "A magazzino"], ["incoming", "In arrivo"], ["production", "Produzione programmata"]] as const;
const kindLabels: Record<NetworkInventoryKind, string> = {
  stock: "A magazzino", incoming: "In arrivo", production: "Produzione programmata",
};
const quantities = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 });

function AvailabilityIcon({ kind, className = "h-5 w-5" }: { kind: NetworkInventoryKind; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {kind === "stock" ? <><path d="m3 9 9-5 9 5v11H3Z" /><path d="M8 20v-8h8v8M8 16h8M3 9h18" /></> : null}
      {kind === "incoming" ? <><path d="M3 5h11v12H3ZM14 10h4l3 4v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></> : null}
      {kind === "production" ? <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 10h16m-12 5 2 2 5-4" /></> : null}
    </svg>
  );
}

function StockForm({ organizationId, companyId, item, canPublish, onSaved, onCancel }: {
  organizationId: string;
  companyId: string;
  item?: NetworkInventoryItem;
  canPublish: boolean;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const saving = useRef(false);
  const published = item?.publication_status === "published";

  useEffect(() => {
    if (error) {
      errorRef.current?.focus({ preventScroll: true });
      errorRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [error]);

  async function submit(formData: FormData) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await saveCompanyInventory(formData);
      if (result.status === "saved") {
        onSaved(result.message);
      } else {
        setError(result.message);
      }
    } catch {
      setError("L’esito del salvataggio non è confermato. I dati del modulo sono conservati: controlla l’elenco aggiornato prima di riprovare.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <form action={submit} onReset={(event) => event.preventDefault()} data-testid="network-stock-form" data-item-id={item?.id ?? "new"} aria-busy={busy}>
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="network_company_id" value={companyId} />
      <input type="hidden" name="item_id" value={item?.id ?? ""} />
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <legend className="sr-only">Dati della disponibilità</legend>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className={labelClass}>Tipo disponibilità
            <select name="kind" aria-label="Tipo disponibilità" required defaultValue={item?.kind ?? "stock"} className={fieldClass}>
              {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={labelClass}>Prodotto / descrizione
            <input name="product_name" required minLength={2} maxLength={180} defaultValue={item?.product_name ?? ""} placeholder="Es. Tubo tondo saldato" className={fieldClass} />
          </label>
          <div className="flex min-w-0 flex-wrap gap-3">
            <label className={labelClass + " flex-1 basis-40"}>Quantità
              <input name="quantity" type="number" min="0.001" max="1000000000" step="0.001" required defaultValue={item?.quantity ?? ""} placeholder="Es. 12,5" className={fieldClass} />
            </label>
            <label className={labelClass + " flex-1 basis-40"}>Unità
              <select name="unit" aria-label="Unità" defaultValue={item?.unit ?? "t"} className={fieldClass}>
                {units.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Data prevista
              <input name="available_on" type="date" defaultValue={item?.available_on ?? ""} aria-describedby="stock-date-help" className={fieldClass} />
            </label>
            <p id="stock-date-help" className="mt-1.5 text-[11px] leading-5 text-[#596b61]">Obbligatoria per pubblicare un arrivo o una produzione programmata. Per lo stock non viene registrata.</p>
          </div>
          <label className={labelClass + " sm:col-span-2"}>Magazzino / località (facoltativo)
            <input name="location" maxLength={180} defaultValue={item?.location ?? ""} placeholder="Es. Milano" className={fieldClass} />
          </label>
        </div>

        <div className="min-w-0 rounded-xl border border-[#e1e8e2] bg-[#f7faf8] p-3 sm:p-4">
          <h4 className="text-sm font-semibold text-[#263c30]">Specifiche tecniche</h4>
          <p className="mt-1 text-xs leading-5 text-[#596b61]">Aggiungi i dettagli disponibili per rendere riconoscibile il prodotto.</p>
          <div className="mt-3 grid min-w-0 gap-4 sm:grid-cols-2">
            <label className={labelClass}>Norma
              <input name="standard" maxLength={90} defaultValue={item?.standard ?? ""} placeholder="EN 10219" className={fieldClass} />
            </label>
            <label className={labelClass}>Grado acciaio
              <input name="grade" maxLength={90} defaultValue={item?.grade ?? ""} placeholder="S355J2H" className={fieldClass} />
            </label>
            <label className={labelClass + " sm:col-span-2"}>Dimensioni
              <input name="dimensions" maxLength={160} defaultValue={item?.dimensions ?? ""} placeholder="Ø 323,9 × 6,3 · L. 12 m" className={fieldClass} />
            </label>
          </div>
        </div>

        {error ? <p ref={errorRef} tabIndex={-1} role="alert" data-testid="stock-feedback" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800 outline-none">{error}</p> : null}

        <div className="border-t border-[#e1e8e2] pt-4">
          <p className="text-xs leading-5 text-[#596b61]">La pubblicazione richiede una tua scelta esplicita. Quantità e date vanno riconfermate prima dell’ordine.</p>
          <div data-testid="stock-editor-actions" className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {published ? (
              <>
                <button type="submit" name="intent" value="published" disabled={!canPublish} className={primaryButton}>Aggiorna pubblicazione</button>
                <button type="submit" name="intent" value="draft" className={secondaryButton}>Rendi privata</button>
              </>
            ) : (
              <>
                <button type="submit" name="intent" value="draft" className={primaryButton}>Salva bozza privata</button>
                <button type="submit" name="intent" value="published" disabled={!canPublish} className={secondaryButton}>Pubblica nel Network</button>
              </>
            )}
            {item ? <button type="submit" name="intent" value="archived" className={buttonClass + " border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"}>Archivia</button> : null}
            <button type="button" onClick={onCancel} className={secondaryButton}>Annulla</button>
          </div>
          {busy ? <p role="status" className="mt-3 text-xs text-[#52645b]">Salvataggio in corso…</p> : null}
        </div>
      </fieldset>
    </form>
  );
}

type StockEditor = { key: number; item?: NetworkInventoryItem };

export function NetworkInventoryManager({ organizationId, companyId, inventory, canPublish }: {
  organizationId: string;
  companyId: string;
  inventory: ManagedNetworkInventory;
  canPublish: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | NetworkInventoryKind>("all");
  const [visibility, setVisibility] = useState<"all" | "draft" | "published">("all");
  const [editor, setEditor] = useState<StockEditor | null>(null);
  const [notice, setNotice] = useState("");
  const [refreshing, startRefresh] = useTransition();
  const editorCounter = useRef(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const items = inventory.items;
  const summary = summarizeCompanyInventory(items);
  const filtered = filterCompanyInventory(items, { query, kind, visibility });
  const filtersActive = Boolean(query.trim()) || kind !== "all" || visibility !== "all";

  useEffect(() => {
    if (editor) {
      editorRef.current?.focus({ preventScroll: true });
      editorRef.current?.scrollIntoView({ block: "start" });
    }
  }, [editor]);

  useEffect(() => {
    if (notice && !editor) {
      noticeRef.current?.focus({ preventScroll: true });
      noticeRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [notice, editor]);

  function openEditor(item?: NetworkInventoryItem) {
    if (editor || refreshing) return;
    setNotice("");
    editorCounter.current += 1;
    setEditor({ key: editorCounter.current, item });
  }

  function cancelEditor() {
    const opener = editor?.item ? editButtons.current.get(editor.item.id) : addRef.current;
    setEditor(null);
    requestAnimationFrame(() => {
      (opener?.isConnected ? opener : addRef.current)?.focus();
    });
  }

  function saved(message: string) {
    setEditor(null);
    setNotice(message);
    startRefresh(() => router.refresh());
  }

  function clearFilters() {
    setQuery("");
    setKind("all");
    setVisibility("all");
  }

  return (
    <section id="stock" data-testid="network-stock-manager" aria-labelledby="stock-heading" className="min-w-0 space-y-5 rounded-3xl border border-[#dce6e0] bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#526d5d]">Disponibilità commerciali</p>
          <h2 id="stock-heading" className="mt-1 text-xl font-semibold tracking-tight text-[#173f35]">Stock e arrivi</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#52665a]">Organizza giacenze, arrivi e produzioni. Prepara una bozza e scegli quando pubblicarla nel Network.</p>
        </div>
        <button ref={addRef} type="button" onClick={() => openEditor()} disabled={!inventory.ready || Boolean(editor) || refreshing} className={primaryButton + " w-full shrink-0 sm:w-auto"}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-4 w-4"><path d="M10 4v12M4 10h12" /></svg>
          Aggiungi disponibilità
        </button>
      </div>

      {!inventory.ready ? (
        <div data-testid="stock-unavailable" role="status" className="rounded-2xl border border-[#e5c89a] bg-[#fffaf0] p-4">
          <h3 className="text-sm font-semibold text-[#775523]">Disponibilità momentaneamente non disponibili</h3>
          <p className="mt-1 text-sm leading-6 text-[#775523]">Non è stato possibile caricare i dati. Riprova aggiornando la pagina tra poco.</p>
        </div>
      ) : (
        <>
          {!canPublish ? (
            <p data-testid="network-stock-publishing-wait" className="rounded-xl border border-[#e6d6b1] bg-[#fffbef] px-4 py-3 text-xs leading-5 text-[#67552f]">
              Puoi preparare e aggiornare le bozze in privato. Finché il profilo aziendale è in revisione, nessuna disponibilità è visibile nel Network, comprese quelle già contrassegnate come pubblicate.
            </p>
          ) : null}

          <div data-testid="stock-metrics" className="rounded-2xl border border-[#e1e8e2] bg-[#f7faf8] p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
              {([
                ["stock", "A magazzino", summary.stock],
                ["incoming", "In arrivo", summary.incoming],
                ["production", "Produzioni", summary.production],
              ] as const).map(([metricKind, label, count]) => (
                <div key={metricKind} data-testid={"stock-metric-" + metricKind} className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e1e8e2] bg-white p-2.5 sm:block sm:p-3">
                  <div className="flex w-12 shrink-0 items-center justify-between gap-2 sm:w-full">
                    <p className="text-2xl font-semibold tabular-nums tracking-tight text-[#173f35]">{count}</p>
                    <AvailabilityIcon kind={metricKind} className="hidden h-5 w-5 shrink-0 text-[#688073] sm:block" />
                  </div>
                  <p className="min-w-0 break-words text-xs font-medium leading-5 text-[#52665a] sm:mt-1">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#52665a]">
              <span className="rounded-full border border-[#d9e3dc] bg-white px-2.5 py-1 font-medium">{summary.draft} {summary.draft === 1 ? "bozza privata" : "bozze private"}</span>
              <span className="rounded-full border border-[#cddfd3] bg-[#eaf4ed] px-2.5 py-1 font-medium text-[#175640]">{summary.published} {summary.published === 1 ? "pubblicata" : "pubblicate"}</span>
              <span className="w-full pt-1 sm:ml-auto sm:w-auto sm:pt-0">{summary.total === 100 ? "Mostrate le 100 posizioni più recenti" : summary.total + (summary.total === 1 ? " posizione caricata" : " posizioni caricate")}</span>
            </div>
          </div>

          {notice ? <p ref={noticeRef} tabIndex={-1} role="status" data-testid="stock-feedback" className="rounded-xl border border-[#cddfd3] bg-[#edf6ef] px-4 py-3 text-sm leading-6 text-[#175640] outline-none">{notice}</p> : null}
          {refreshing ? <p role="status" className="text-xs text-[#52665a]">Aggiornamento dell’elenco…</p> : null}

          {editor ? (
            <div ref={editorRef} tabIndex={-1} role="region" data-testid="stock-editor" aria-labelledby="stock-editor-heading" className="min-w-0 scroll-mt-24 rounded-2xl border border-[#afc9bb] bg-white p-3 outline-none ring-2 ring-[#edf4ef] sm:p-5">
              <div className="mb-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#526d5d]">{editor.item ? "Aggiorna disponibilità" : "Nuova disponibilità"}</p>
                <h3 id="stock-editor-heading" className="mt-1 break-words text-lg font-semibold text-[#173f35]">{editor.item?.product_name ?? "Prepara una disponibilità"}</h3>
                <p className="mt-1 text-xs leading-5 text-[#596b61]">Salva i dati quando sono pronti. Annulla chiude il modulo senza conservare le modifiche.</p>
              </div>
              <StockForm key={editor.key} organizationId={organizationId} companyId={companyId} item={editor.item} canPublish={canPublish} onSaved={saved} onCancel={cancelEditor} />
            </div>
          ) : null}

          {items.length ? (
            <div className="space-y-4">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <label className={labelClass + " sm:col-span-2 xl:col-span-1"}>Cerca disponibilità
                  <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Prodotto, specifiche o località" className={fieldClass} />
                </label>
                <label className={labelClass}>Filtra per tipo
                  <select aria-label="Filtra per tipo" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className={fieldClass}>
                    <option value="all">Tutti i tipi</option>
                    {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className={labelClass}>Filtra per visibilità
                  <select aria-label="Filtra per visibilità" value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)} className={fieldClass}>
                    <option value="all">Tutte le disponibilità</option>
                    <option value="draft">Bozze private</option>
                    <option value="published">Pubblicate</option>
                  </select>
                </label>
              </div>
              <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
                <p aria-live="polite" className="text-xs text-[#596b61]">{filtered.length} {filtered.length === 1 ? "posizione mostrata" : "posizioni mostrate"} su {summary.total} {summary.total === 1 ? "caricata" : "caricate"}</p>
                {filtersActive ? <button type="button" onClick={clearFilters} className="min-h-11 rounded-lg px-2 text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a7651]">Azzera filtri</button> : null}
              </div>

              {filtered.length ? (
                <div data-testid="stock-list" className="space-y-3">
                  {filtered.map((item) => {
                    const specification = [item.standard, item.grade, item.dimensions].filter(Boolean).join(" · ");
                    const updated = inventoryUpdatedLabel(item.updated_at);
                    const date = networkInventoryDate(item.available_on);
                    const published = item.publication_status === "published";
                    return (
                      <article key={item.id} data-testid="stock-card" data-item-id={item.id} data-kind={item.kind} data-publication-status={item.publication_status} className="min-w-0 rounded-2xl border border-[#dce6e0] bg-white p-3 sm:p-4">
                        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 text-xs font-medium text-[#526d5d]"><AvailabilityIcon kind={item.kind} className="h-4 w-4 shrink-0" />{kindLabels[item.kind]}</p>
                            <h3 className="mt-2 break-words text-base font-semibold leading-6 text-[#263c30]">{item.product_name}</h3>
                            {specification ? <p className="mt-1 break-words text-xs leading-5 text-[#52665a]">{specification}</p> : null}
                          </div>
                          <p className="max-w-full shrink-0 rounded-xl bg-[#edf5f0] px-3 py-2 text-base font-semibold tabular-nums text-[#175640]">{quantities.format(item.quantity)} <span className="text-xs font-medium">{inventoryUnitLabel(item.unit)}</span></p>
                        </div>
                        <div className="mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-[#52665a]">
                          <span className="break-words">{item.location || "Località non indicata"}</span>
                          {item.kind !== "stock" ? <span>Data prevista: {date ?? "da indicare"}</span> : null}
                          <span>{updated ? "Aggiornata il " + updated : "Data di aggiornamento non disponibile"}</span>
                        </div>
                        <div className="mt-4 flex flex-col gap-3 border-t border-[#e7ece8] pt-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                            <span className={"rounded-full px-2.5 py-1 text-xs font-medium " + (published ? "bg-[#e7f4ea] text-[#175640]" : "bg-[#f0f2f0] text-[#58655e]")}>{published ? "Pubblicata" : "Bozza privata"}</span>
                            <span className="text-[11px] text-[#68786c]">Dichiarata dall’azienda</span>
                          </div>
                          <button ref={(button) => { if (button) editButtons.current.set(item.id, button); else editButtons.current.delete(item.id); }} type="button" onClick={() => openEditor(item)} disabled={Boolean(editor) || refreshing} className={secondaryButton + " w-full shrink-0 sm:w-auto"}>Modifica disponibilità</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div data-testid="stock-filter-empty" className="rounded-2xl border border-dashed border-[#cddbd2] bg-[#f7faf8] p-5 text-center">
                  <h3 className="text-sm font-semibold text-[#263c30]">Nessuna disponibilità corrisponde ai filtri</h3>
                  <p className="mt-2 text-sm leading-6 text-[#596b61]">Prova un’altra ricerca oppure azzera i filtri per ritrovare tutte le posizioni caricate.</p>
                </div>
              )}
            </div>
          ) : (
            <div data-testid="stock-empty" className="rounded-2xl border border-dashed border-[#cddbd2] bg-[#f7faf8] px-4 py-7 text-center sm:py-9">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-[#dce6e0] bg-white text-[#527261]"><AvailabilityIcon kind="stock" className="h-6 w-6" /></span>
              <h3 className="mt-3 text-base font-semibold text-[#263c30]">La prima disponibilità parte da una bozza</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#596b61]">Aggiungi una giacenza, un prossimo arrivo o una produzione programmata. Potrai pubblicarla nel Network quando i dati saranno confermati.</p>
            </div>
          )}
        </>
      )}

      <div className="flex flex-col items-start justify-between gap-3 border-t border-[#e1e8e2] pt-4 sm:flex-row sm:items-center">
        <p className="max-w-2xl text-xs leading-5 text-[#596b61]">Clienti, offerte e listini restano nello storico commerciale privato. Un catalogo tecnico descrive l’offerta aziendale e non attesta una disponibilità a magazzino.</p>
        <a href="#products-catalogues" className={secondaryButton + " w-full shrink-0 sm:w-auto"}>Gestisci cataloghi ufficiali</a>
      </div>
    </section>
  );
}
