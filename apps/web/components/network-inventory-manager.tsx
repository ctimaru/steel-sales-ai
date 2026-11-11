import { saveManagedNetworkInventory } from "@/app/(workspace)/network/actions";
import { networkInventoryDate } from "@/components/network-profile-inventory";
import type { ManagedNetworkInventory, NetworkInventoryItem } from "@/lib/network-stock";

const fieldClass = "mt-1.5 h-10 w-full min-w-0 rounded-xl border border-[#d0ddd4] bg-white px-3 text-sm text-[#2d3934] outline-none focus:border-[#1a7651] focus:ring-2 focus:ring-[#e5efeb]";
const labelClass = "block min-w-0 text-xs font-semibold text-[#475e50]";
const publishButton = "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white hover:bg-[#226657]";
const draftButton = "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cddbd2] bg-white px-4 text-sm font-semibold text-[#175640]";
const units = [["t", "Tonnellate"], ["kg", "Chilogrammi"], ["m", "Metri"], ["bars", "Barre"], ["pcs", "Pezzi"]] as const;
const kinds = [["stock", "A magazzino"], ["incoming", "Prossimo arrivo"], ["production", "Produzione programmata"]] as const;

function StockForm({ organizationId, companyId, item, canPublish }: {
  organizationId: string; companyId: string; item?: NetworkInventoryItem; canPublish: boolean;
}) {
  return (
    <form action={saveManagedNetworkInventory} className="grid min-w-0 gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="network-stock-form">
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="network_company_id" value={companyId} />
      <input type="hidden" name="item_id" value={item?.id ?? ""} />
      <label className={labelClass}>Tipo disponibilità
        <select name="kind" required defaultValue={item?.kind ?? "stock"} className={fieldClass}>
          {kinds.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className={labelClass+" sm:col-span-1 lg:col-span-2"}>Prodotto / descrizione
        <input name="product_name" required minLength={2} maxLength={180} defaultValue={item?.product_name ?? ""}
          placeholder="Es. Tubo tondo saldato" className={fieldClass} />
      </label>
      <label className={labelClass}>Norma
        <input name="standard" maxLength={90} defaultValue={item?.standard ?? ""} placeholder="EN 10219" className={fieldClass} />
      </label>
      <label className={labelClass}>Grado acciaio
        <input name="grade" maxLength={90} defaultValue={item?.grade ?? ""} placeholder="S355J2H" className={fieldClass} />
      </label>
      <label className={labelClass}>Dimensioni
        <input name="dimensions" maxLength={160} defaultValue={item?.dimensions ?? ""} placeholder="Ø 323,9 × 6,3 · L.12 m" className={fieldClass} />
      </label>
      <label className={labelClass}>Quantità
        <input name="quantity" type="number" min="0.001" max="1000000000" step="0.001" required
          defaultValue={item?.quantity ?? ""} placeholder="Es. 12,500" className={fieldClass} />
      </label>
      <label className={labelClass}>Unità
        <select name="unit" defaultValue={item?.unit ?? "t"} className={fieldClass}>
          {units.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className={labelClass}>Magazzino / località (facoltativo)
        <input name="location" maxLength={180} defaultValue={item?.location ?? ""} placeholder="Es. Milano" className={fieldClass} />
      </label>
      <label className={labelClass}>Data prevista (obbligatoria per arrivi/produzioni pubblicati)
        <input name="available_on" type="date" defaultValue={item?.available_on ?? ""} className={fieldClass} />
      </label>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button type="submit" name="intent" value="draft" className={draftButton}>Salva bozza privata</button>
        <button type="submit" name="intent" value="published" disabled={!canPublish} className={publishButton+" disabled:cursor-not-allowed disabled:opacity-45"}>
          {item?.publication_status === "published" ? "Aggiorna pubblicazione" : "Pubblica nel Network"}
        </button>
        {item?.publication_status === "published" ? (
          <button type="submit" name="intent" value="draft" className={draftButton}>Rendi privata</button>
        ) : null}
        {item ? <button type="submit" name="intent" value="archived" className="min-h-11 rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-700">Archivia</button> : null}
      </div>
      <p className="text-[11px] leading-5 text-[#52665a] sm:col-span-2 lg:col-span-4">
        La pubblicazione è una scelta esplicita della tua azienda. Le quantità non sono una promessa vincolante e vanno riconfermate prima dell'ordine.
        I dati di clienti, offerte e listini restano privati.
      </p>
    </form>
  );
}

export function NetworkInventoryManager({ organizationId, companyId, inventory, canPublish }: {
  organizationId: string; companyId: string; inventory: ManagedNetworkInventory; canPublish: boolean;
}) {
  const items=inventory.items;
  return (
    <section id="stock" data-testid="network-stock-manager" className="rounded-3xl border border-[#dce6e0] bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#526d5d]">Sezione commerciale riservata</p>
          <h2 className="mt-1 text-xl font-semibold text-[#173f35]">Stock / Magazzino / Prossimi arrivi e produzioni</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#52665a]">Gestisci le giacenze e il calendario produttivo. Le bozze non compaiono nelle schede pubbliche.</p>
        </div>
        <span className="rounded-full bg-[#edf5f1] px-3 py-1 text-xs font-semibold text-[#175640]">
          {items.filter((item)=>item.publication_status==="published").length} pubblicate · {items.filter((item)=>item.publication_status==="draft").length} bozze
        </span>
      </div>
      {!canPublish && inventory.ready ? (
        <p className="mt-3 rounded-xl border border-[#e6d6b1] bg-[#fffbef] px-3 py-2 text-xs leading-5 text-[#67552f]" data-testid="network-stock-publishing-wait">
          Puoi preparare e aggiornare le bozze in privato. La pubblicazione sarà disponibile quando il profilo aziendale avrà completato la revisione nel Network.
        </p>
      ) : null}
      {!inventory.ready ? (
        <p className="mt-4 rounded-xl border border-[#e5c89a] bg-[#fffaf0] p-4 text-sm text-[#775523]">
          Gestione delle disponibilità in attivazione: lo schema dati deve essere installato prima di poter salvare o pubblicare.
        </p>
      ) : (
        <>
          <details open={items.length===0} className="mt-4 rounded-2xl border border-[#d7e6da] bg-[#f7faf8] p-3 sm:p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#175640]">+ Aggiungi disponibilità o produzione programmata</summary>
            <StockForm organizationId={organizationId} companyId={companyId} canPublish={canPublish} />
          </details>
          {items.length ? <div className="mt-4 space-y-2">
            {items.map((item)=>(
              <details key={item.id} className="rounded-2xl border border-[#e1e8e1] bg-white p-3 sm:p-4">
                <summary className="cursor-pointer">
                  <span className="inline-flex w-full flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 break-words font-semibold text-[#263c30]">{item.product_name}
                      <span className="ml-2 text-xs font-normal text-[#56695c]">{[item.standard,item.grade,item.dimensions].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-[#175640]">{item.quantity.toLocaleString("it-IT")} {item.unit}</span>
                    <span className={"rounded-full px-2.5 py-1 text-xs font-medium "+(item.publication_status==="published"?"bg-[#e7f4ea] text-[#175640]":"bg-[#f0f2f0] text-[#58655e]")}>
                      {item.publication_status==="published"?"Pubblico":"Bozza privata"}
                    </span>
                  </span>
                  {item.available_on?<span className="mt-1 block text-xs text-[#52665a]">Previsto: {networkInventoryDate(item.available_on)}</span>:null}
                </summary>
                <StockForm organizationId={organizationId} companyId={companyId} item={item} canPublish={canPublish} />
              </details>
            ))}
          </div>:<p className="mt-4 text-sm text-[#607269]">Nessuna disponibilità inserita. Inizia da una bozza; puoi pubblicarla quando i dati sono confermati.</p>}
        </>
      )}
    </section>
  );
}
