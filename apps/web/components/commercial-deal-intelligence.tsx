import "server-only";
import Link from "next/link";
import type { OperationalEntityData } from "@/lib/commercial-data";
import type { UnifiedCommercialItem } from "@/lib/commercial-unified-data";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

type Material = { description: string; specification: string; quantity: string; target: string | null };
type Source = { href: string; label: string };
export type CommercialDealFacts = {
  counterpartyLabel: string;
  counterparty: string;
  materials: Material[];
  quantity: string | null;
  price: string | null;
  priceNote: string;
  sources: Source[];
  rawStatus: string;
};
const isId = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const num = (v: unknown) => v == null || v === "" || !Number.isFinite(Number(v)) || Number(v) < 0
  ? null : Number(v);
const formatted = (v: unknown, digits = 2) => {
  const n = num(v);
  return n == null ? null : n.toLocaleString("it-IT", { maximumFractionDigits: digits });
};
const money = (v: unknown) => {
  const value = formatted(v);
  return value === null ? null : "€ " + value;
};
const join = (v: Array<string | null | undefined>) => v.filter(Boolean).join(" · ");

function inboundFacts(item: UnifiedCommercialItem, detail: OperationalEntityData | null): CommercialDealFacts | null {
  if (!detail || detail.mode !== "live") return null;
  const sources: Source[] = [{ href: item.href, label: "Record commerciale originale" }];
  if (detail.conversationHref) sources.push({ href: detail.conversationHref, label: "Conversazione di origine" });
  sources.push(...detail.relationshipLinks);
  const hasPrices = detail.lines.some(line => line.price && line.price !== "—");
  return {
    counterpartyLabel: item.kind === "inbound-rfq" ? "Cliente" : "Controparte",
    counterparty: detail.company && detail.company !== "Cliente non attribuito" ? detail.company : "Da associare",
    materials: detail.lines.map(line => ({
      description: line.product,
      specification: join([line.standard === "—" ? null : line.standard, line.grade === "—" ? null : line.grade]),
      quantity: line.quantity === "—" ? "Quantità non disponibile" : line.quantity,
      target: line.price && line.price !== "—" ? "Prezzo registrato " + line.price : null,
    })),
    quantity: null,
    price: null, // Prices are per line; never invent a deal total.
    priceNote: hasPrices ? "Prezzi unitari mostrati sui singoli articoli autorizzati." :
      "Prezzo non verificato in questa scheda. Controlla il record originale.",
    sources,
    rawStatus: detail.status,
  };
}

/** Read only. Each parent is scoped to active org and checked by Supabase RLS. */
async function procurementFacts(item: UnifiedCommercialItem): Promise<CommercialDealFacts | null> {
  const context = await getWorkspaceContext();
  if (!isId(item.id) || !context.organizationId) return null;
  const db = await createClient();
  let campaignId: string | null = item.kind === "campaign" ? item.id : item.campaignId;
  let supplierName: string | null = null;
  let totalOrderEur: unknown = null;
  let status: string | null = null;

  if (item.kind === "quote") {
    const { data: quote, error } = await db.from("buyer_rfq_quotes")
      .select("id,rfq_id,supplier_id,status")
      .eq("id", item.id).eq("organization_id", context.organizationId).maybeSingle();
    if (error || !quote || quote.rfq_id !== campaignId || !isId(quote.rfq_id)) return null;
    campaignId = quote.rfq_id;
    status = quote.status;
    if (isId(quote.supplier_id)) {
      const { data: supplier, error: supplierError } = await db.from("buyer_rfq_suppliers")
        .select("supplier_name").eq("id", quote.supplier_id)
        .eq("rfq_id", quote.rfq_id).maybeSingle();
      if (!supplierError && supplier?.supplier_name) supplierName = supplier.supplier_name;
    }
  }
  if (item.kind === "purchase-order") {
    const { data: po, error } = await db.from("buyer_purchase_order_drafts")
      .select("id,rfq_id,supplier_name_snapshot,total_eur,status")
      .eq("id", item.id).eq("organization_id", context.organizationId).maybeSingle();
    if (error || !po || po.rfq_id !== campaignId || !isId(po.rfq_id)) return null;
    campaignId = po.rfq_id;
    supplierName = po.supplier_name_snapshot;
    totalOrderEur = po.total_eur;
    status = po.status;
  }
  const sources: Source[] = [];
  let distintaId: string | null = item.kind === "distinta" ? item.id : null;
  if (campaignId) {
    if (!isId(campaignId)) return null;
    const { data: campaign, error } = await db.from("buyer_rfq_campaigns")
      .select("id,source_distinta_id,status")
      .eq("id", campaignId).eq("organization_id", context.organizationId).maybeSingle();
    if (error || !campaign) return null;
    distintaId = isId(campaign.source_distinta_id) ? campaign.source_distinta_id : null;
    status ??= campaign.status;
    sources.push({ href: appRoutes.rfqHub.campaign(campaign.id), label: "RFQ e documenti originali" });
  }
  if (!distintaId) return {
    counterpartyLabel: "Fornitore",
    counterparty: supplierName || "Da verificare nella RFQ",
    materials: [], quantity: null,
    price: item.kind === "purchase-order" ? money(totalOrderEur) : null,
    priceNote: "Distinta non disponibile per questo accesso. Apri la RFQ per verificare le condizioni.",
    sources, rawStatus: status || "—",
  };
  const { data: distinta, error: distintaError } = await db.from("buyer_distintas")
    .select("id,total_meters,total_tonnes")
    .eq("id", distintaId).eq("organization_id", context.organizationId).maybeSingle();
  if (distintaError || !distinta) return null;
  const { data: lines, error: lineError } = await db.from("buyer_distinta_lines")
    .select("description,standard_code,grade_code,quantity_mode,quantity,line_meters,line_tonnes,target_eur_t,target_eur_m")
    .eq("distinta_id", distinta.id).order("line_position", { ascending: true }).limit(5);
  if (lineError) return null;
  sources.push({ href: appRoutes.rfqHub.savedDistinta(distinta.id), label: "Distinta privata originale" });
  const metres = formatted(distinta.total_meters);
  const tonnes = formatted(distinta.total_tonnes, 3);
  const materials = (lines ?? []).map(line => {
    const mode = line.quantity_mode === "bars" ? "barre" :
      line.quantity_mode === "meters" ? "m" : line.quantity_mode === "tonnes" ? "t" : null;
    const targetT = money(line.target_eur_t);
    const targetM = money(line.target_eur_m);
    return {
      description: line.description || "Articolo senza descrizione",
      specification: join([line.standard_code, line.grade_code]),
      quantity: join([
        formatted(line.quantity) && mode ? formatted(line.quantity) + " " + mode : null,
        formatted(line.line_meters) === null ? null : formatted(line.line_meters) + " m",
        formatted(line.line_tonnes, 3) === null ? null : formatted(line.line_tonnes, 3) + " t",
      ]) || "Quantità non disponibile",
      target: join([targetT ? "Target " + targetT + "/t" : null, targetM ? "Target " + targetM + "/m" : null]) || null,
    };
  });
  return {
    counterpartyLabel: item.kind === "distinta" ? "Fornitori" : item.kind === "campaign" ? "Destinatari" : "Fornitore",
    counterparty: item.kind === "distinta" ? "Da selezionare" :
      item.kind === "campaign" ? "Verifica i destinatari nella RFQ" :
        supplierName || "Da verificare nella RFQ",
    materials,
    quantity: join([metres === null ? null : metres + " metri", tonnes === null ? null : tonnes + " tonnellate"]) || null,
    price: item.kind === "purchase-order" ? money(totalOrderEur) : null,
    priceNote: item.kind === "purchase-order"
      ? "Totale PO registrato, se disponibile. Verifica condizioni e versione nel record originale."
      : "I target sono per articolo e non rappresentano offerte ricevute. Confronta i prezzi nella RFQ autorizzata.",
    sources,
    rawStatus: status || "—",
  };
}

export async function loadCommercialDealFacts(
  item: UnifiedCommercialItem, detail: OperationalEntityData | null,
): Promise<CommercialDealFacts | null> {
  if (item.kind.startsWith("inbound-")) return inboundFacts(item, detail);
  try { return await procurementFacts(item); }
  catch { return null; } // Fail closed if membership or RLS data cannot be resolved.
}

export function CommercialDealIntelligence({ facts }: { facts: CommercialDealFacts | null }) {
  return (
    <section data-testid="commercial-deal-intelligence" aria-labelledby="commercial-deal-intelligence-title"
      className="rounded-xl border border-[#d3e6da] bg-[#f8fbf9] p-3 sm:p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#34745a]">Dati verificati · Workspace privato</p>
      <h4 id="commercial-deal-intelligence-title" className="mt-1 text-base font-semibold text-[#173f35]">Il quadro della trattativa</h4>
      {!facts ? (
        <p role="status" className="mt-2 text-xs text-[#52685b]">Dati di contesto non disponibili per questo accesso. Consulta il record originale.</p>
      ) : (
        <div className="mt-3 space-y-3">
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="min-w-0 rounded-lg border border-[#e3ece6] bg-white p-2.5">
              <dt className="font-semibold text-[#537265]">{facts.counterpartyLabel}</dt>
              <dd className="mt-1 break-words font-semibold text-[#173f35]">{facts.counterparty}</dd>
            </div>
            <div className="min-w-0 rounded-lg border border-[#e3ece6] bg-white p-2.5">
              <dt className="font-semibold text-[#537265]">Quantità complessiva</dt>
              <dd className="mt-1 break-words font-semibold text-[#173f35]">{facts.quantity ?? "Vedi articoli"}</dd>
            </div>
          </dl>
          <div data-testid="commercial-deal-materials">
            <p className="mb-1.5 text-xs font-semibold text-[#173f35]">Materiali e quantità registrate</p>
            {facts.materials.length ? (
              <div className="space-y-1.5">
                {facts.materials.slice(0, 3).map((line, index) => (
                  <div key={index} className="min-w-0 rounded-lg border border-[#e3ece6] bg-white px-3 py-2 text-xs">
                    <p className="break-words font-semibold text-[#173f35]">{line.description}</p>
                    <p className="mt-0.5 break-words text-[#52685b]">{join([line.specification, line.quantity])}</p>
                    {line.target ? <p className="mt-1 break-words font-medium text-[#24654b]">{line.target}</p> : null}
                  </div>
                ))}
                {facts.materials.length > 3 ? <p className="text-[11px] text-[#52685b]">Altri articoli nella fonte originale.</p> : null}
              </div>
            ) : <p className="text-xs text-[#52685b]">Articoli non disponibili in questa scheda.</p>}
          </div>
          <div className="rounded-lg border border-[#e3ece6] bg-white px-3 py-2.5 text-xs">
            <p className="font-semibold text-[#173f35]">Prezzi e condizioni</p>
            {facts.price ? <p className="mt-1 text-base font-semibold tabular-nums text-[#175640]">{facts.price}</p> : null}
            <p className="mt-1 leading-5 text-[#52685b]">{facts.priceNote}</p>
          </div>
          <div data-testid="commercial-deal-sources" className="border-t border-[#dce9df] pt-2.5">
            <p className="mb-1 text-xs font-semibold text-[#173f35]">Fonti e documenti collegati</p>
            <p className="mb-2 text-[11px] leading-4 text-[#52685b]">Gli allegati si verificano nei record originali: questa scheda non presume che esistano.</p>
            <div className="flex flex-wrap gap-x-3 gap-y-2">
              {facts.sources.map(source => <Link key={source.href} href={source.href}
                className="text-xs font-semibold text-[#175640] underline underline-offset-2">{source.label} →</Link>)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
