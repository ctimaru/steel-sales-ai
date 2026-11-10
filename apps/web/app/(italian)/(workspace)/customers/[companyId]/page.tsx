import Link from "next/link";
import { PilotEvent } from "@/components/pilot-event";

import styles from "@/components/commercial-cinematic.module.css";
import { appRoutes } from "@/lib/routes";

import { loadCompany360, loadCompanyActivationStatus } from "../actions";

export const dynamic = "force-dynamic";

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

function numberLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(Number(value));
}

function priceLabel(value: number, currency: string | null, unit: string | null) {
  const amount = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(Number(value));
  return `${currency === "EUR" ? "€" : currency ?? ""} ${amount}${unit ? `/${unit.toLowerCase()}` : ""}`.trim();
}

function eventLabel(type: string) {
  if (type === "message") return "Messaggio";
  if (type === "rfq") return "RFQ";
  if (type === "offer") return "Offerta";
  if (type === "order") return "Ordine";
  return type;
}

const statusLabels: Record<string, string> = {
  new: "Nuova", open: "Aperta", in_progress: "In corso", received: "Ricevuto", sent: "Inviata",
  draft: "Bozza", accepted: "Accettata", rejected: "Rifiutata", closed: "Chiusa", confirmed: "Confermato",
  cancelled: "Annullato", expired: "Scaduta", quoted: "Offerta inviata",
};
function statusLabel(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "—";
  return statusLabels[value.trim().toLowerCase()] ?? value;
}

const companyTypeLabels: Record<string, string> = {
  customer: "Cliente", client: "Cliente", buyer: "Cliente",
  supplier: "Fornitore", vendor: "Fornitore", mill: "Produttore", producer: "Produttore",
  distributor: "Distributore", trader: "Trader", service_center: "Centro servizi",
  both: "Cliente e fornitore",
};

const tabs = [
  { key: "activity", label: "Attività" },
  { key: "contacts", label: "Contatti" },
  { key: "deals", label: "Richieste e ordini" },
  { key: "products", label: "Prodotti e prezzi" },
] as const;
type CompanyTab = typeof tabs[number]["key"];

const eventDot: Record<string, string> = {
  order: "bg-[#3d8a63]", offer: "bg-[#5b8def]", rfq: "bg-[#d9a62e]", message: "bg-[#9fb3a8]",
};

export default async function Company360Page({
  params, searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { companyId } = await params;
  const requestedTab = (await searchParams)?.tab;
  const tab: CompanyTab = tabs.some((item) => item.key === requestedTab) ? requestedTab as CompanyTab : "activity";
  const [result, activation] = await Promise.all([
    loadCompany360(companyId),
    loadCompanyActivationStatus(),
  ]);

  if (result.error) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          {result.error}
        </div>
      </div>
    );
  }

  if (!result.found || !result.data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <p className="text-sm text-[#4f6b5b]">Azienda non trovata nel workspace.</p>
        <Link href={appRoutes.commercial.companies} className="text-sm font-semibold text-[#175640] underline underline-offset-2">← Torna ad Aziende</Link>
      </div>
    );
  }

  const payload = result.data;
  const company = payload.company;
  const summary = payload.summary;
  const typeLabel = company.company_type ? companyTypeLabels[company.company_type.trim().toLowerCase()] : undefined;
  const tabHref = (key: CompanyTab) => appRoutes.commercial.company(companyId) + (key === "activity" ? "" : "?tab=" + key);
  const tabCount: Record<CompanyTab, number> = {
    activity: payload.timeline.length,
    contacts: payload.contacts.length,
    deals: payload.rfqs.length + payload.offers.length + payload.orders.length,
    products: payload.product_activity.length,
  };
  const rfqLineCount = new Map(payload.rfqs.map((rfq) => [rfq.rfq_id, rfq.lines.length] as const));
  const conversationOf = (value: unknown) => typeof value === "string" && value ? value : null;
  const panel = "overflow-hidden rounded-2xl border border-[#d6e5db] bg-white";
  const empty = "px-5 py-8 text-center text-sm text-[#5c7063]";

  return (
    <>
      <PilotEvent eventName="company_viewed" entityType="company" entityId={companyId} metadata={{ surface: "company_360" }} />
      <div className="mx-auto max-w-5xl space-y-4" data-testid="company-clean-page">
        <Link href={appRoutes.commercial.companies} className="inline-flex min-h-9 items-center text-xs font-semibold text-[#175640] hover:underline">← Aziende</Link>

        <header className="rounded-[22px] bg-[#0b2f25] px-5 py-5 text-white sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#b4dec2]">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className={"h-2 w-2 rounded-full " + (company.verified ? "bg-[#7fd6a4]" : "bg-[#f0c75e]")} />
                  {company.verified ? "Identità verificata" : "Identità da verificare"}
                </span>
                {typeLabel ? <span>· {typeLabel}</span> : null}
                {company.country ? <span>· {company.country}</span> : null}
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{company.name}</h1>
              <p className="mt-1 text-sm text-[#d5eadc]">
                {company.vat_number ? `P.IVA ${company.vat_number}` : "P.IVA non disponibile"}
                {company.website ? <> · <span>{company.website}</span></> : null}
              </p>
            </div>
            <dl className="flex shrink-0 gap-5 text-right">
              {([["RFQ", summary.rfqs], ["Offerte", summary.offers], ["Ordini", summary.orders]] as const).map(([label, value]) => (
                <div key={label}>
                  <dd className="text-3xl font-bold leading-none tabular-nums">{String(value)}</dd>
                  <dt className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#b4dec2]">{label}</dt>
                </div>
              ))}
            </dl>
          </div>
          <p className="mt-4 border-t border-white/15 pt-3 text-xs text-[#d5eadc]">
            {summary.contacts === 1 ? "1 contatto" : `${summary.contacts} contatti`} · {summary.conversations} conversazioni · {summary.messages} messaggi
          </p>
        </header>

        {summary.contacts === 0 && company.verified ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[#ecd9a8] bg-[#fff8e6] px-4 py-2.5 text-sm text-[#6b4a07]">
            <span className="font-semibold">Nessun contatto collegato</span>
            <span>
              Le attività compaiono qui solo dopo aver collegato un contatto a questa azienda.
              {activation.unresolvedContacts > 0 ? ` Ci sono ${activation.unresolvedContacts} contatti in attesa.` : ""}
            </span>
            <Link href={appRoutes.operations.reviewIdentities} className="font-semibold underline underline-offset-2">Collega ora →</Link>
          </p>
        ) : null}

        <nav aria-label="Sezioni dell’azienda" className="flex gap-1 overflow-x-auto" data-testid="company-tabs">
          {tabs.map((item) => (
            <Link key={item.key} href={tabHref(item.key)} aria-current={item.key === tab ? "page" : undefined} scroll={false}
              className={"inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] " +
                (item.key === tab ? "bg-[#175640] " + styles.tabActive : "text-[#4f6b5b] hover:bg-[#e8f3ec] hover:text-[#143f30]")}>
              {item.label}
              <span className="text-xs tabular-nums opacity-70">{tabCount[item.key]}</span>
            </Link>
          ))}
        </nav>

        {tab === "activity" ? (
          <section aria-label="Attività" className={panel}>
            <div className="divide-y divide-[#edf3ef]">
              {payload.timeline.map((event) => {
                const conversation = event.provenance?.conversation_id ? String(event.provenance.conversation_id) : null;
                // SCHEDA-AZIENDA2: se il titolo ripete il tipo ("RFQ" / "RFQ"), sotto mostriamo un dato utile.
                const type = eventLabel(event.event_type);
                const generic = event.title.trim().toLowerCase() === type.toLowerCase();
                const rfqLines = event.event_type === "rfq" ? rfqLineCount.get(event.event_id) : undefined;
                const meta = [generic ? "" : type, statusLabel(event.status),
                  rfqLines === undefined ? "" : rfqLines === 1 ? "1 riga" : rfqLines + " righe"].filter(Boolean).join(" · ");
                const body = (
                  <>
                    <span aria-hidden="true" className={"h-2.5 w-2.5 shrink-0 rounded-full " + (eventDot[event.event_type] ?? "bg-[#9fb3a8]")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#143f30]">{event.title}</span>
                      <span className="block truncate text-xs text-[#5c7063]">{meta}</span>
                    </span>
                    <time className="shrink-0 text-xs tabular-nums text-[#5c7063]">{dateLabel(event.event_at)}</time>
                    <span aria-hidden="true" className={"hidden sm:inline " + (conversation ? "text-[#9ab5a5]" : "text-transparent")}>›</span>
                  </>
                );
                const row = "flex min-h-[60px] items-center gap-3 px-4 py-2.5 sm:px-5";
                return conversation ? (
                  <Link key={`${event.event_type}-${event.event_id}`} href={appRoutes.commercial.conversation(conversation)}
                    aria-label={event.title + ": apri conversazione"} className={row + " transition hover:bg-[#f5faf7]"}>{body}</Link>
                ) : (
                  <div key={`${event.event_type}-${event.event_id}`} className={row}>{body}</div>
                );
              })}
            </div>
            {payload.timeline.length === 0 ? <p className={empty}>Nessuna attività collegata a questa azienda.</p> : null}
          </section>
        ) : null}

        {tab === "contacts" ? (
          <section aria-label="Contatti" className={panel}>
            <div className="divide-y divide-[#edf3ef]">
              {payload.contacts.map((contact) => (
                <div key={contact.contact_id} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 sm:px-5">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e3f3ea] text-sm font-bold text-[#175640]">
                    {(contact.full_name ?? "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#143f30]">{contact.full_name}</span>
                    <span className="block truncate text-xs text-[#5c7063]">{[contact.role, contact.email].filter(Boolean).join(" · ") || "Email non disponibile"}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-[#5c7063]">{contact.message_count} messaggi · {contact.rfq_count} RFQ</span>
                </div>
              ))}
            </div>
            {payload.contacts.length === 0 ? <p className={empty}>Nessun contatto collegato.</p> : null}
            {payload.verifications.length > 0 ? (
              <p className="border-t border-[#edf3ef] px-5 py-3 text-xs text-[#5c7063]">
                Identità verificata il {dateLabel(payload.verifications[0].verified_at)} tramite {payload.verifications[0].identity_value}.
              </p>
            ) : null}
          </section>
        ) : null}

        {tab === "deals" ? (
          <section aria-label="Richieste e ordini" className="grid gap-3 md:grid-cols-3">
            {([
              ["RFQ", payload.rfqs.map((rfq) => ({ id: rfq.rfq_id, at: rfq.requested_at, status: rfq.status, extra: rfq.lines.length === 1 ? "1 riga" : `${rfq.lines.length} righe`, conversation: conversationOf(rfq.conversation_id) }))],
              ["Offerte", payload.offers.map((offer, index) => ({ id: String(offer.offer_id ?? index), at: typeof offer.offered_at === "string" ? offer.offered_at : null, status: offer.status, extra: "", conversation: conversationOf(offer.conversation_id) }))],
              ["Ordini", payload.orders.map((order, index) => ({ id: String(order.order_id ?? index), at: typeof order.ordered_at === "string" ? order.ordered_at : null, status: order.status, extra: "", conversation: conversationOf(order.conversation_id) }))],
            ] as const).map(([title, items]) => (
              <div key={title} className={panel}>
                <h2 className="flex items-center justify-between border-b border-[#edf3ef] px-4 py-3 text-sm font-bold text-[#143f30]">
                  {title} <span className="text-xs font-semibold tabular-nums text-[#5c7063]">{items.length}</span>
                </h2>
                <div className="divide-y divide-[#edf3ef]">
                  {items.slice(0, 10).map((item) => {
                    const body = (
                      <>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-[#143f30]">{statusLabel(item.status)}</span>
                          {item.extra ? <span className="block text-xs text-[#5c7063]">{item.extra}</span> : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <time className="text-xs tabular-nums text-[#5c7063]">{dateLabel(item.at)}</time>
                          <span aria-hidden="true" className={item.conversation ? "text-[#9ab5a5]" : "text-transparent"}>›</span>
                        </span>
                      </>
                    );
                    const row = "flex items-center justify-between gap-2 px-4 py-2.5";
                    return item.conversation ? (
                      <Link key={item.id} href={appRoutes.commercial.conversation(item.conversation)}
                        aria-label={title + " " + dateLabel(item.at) + ": apri conversazione"}
                        className={row + " transition hover:bg-[#f5faf7]"}>{body}</Link>
                    ) : <div key={item.id} className={row}>{body}</div>;
                  })}
                </div>
                {items.length === 0 ? <p className="px-4 py-6 text-center text-sm text-[#5c7063]">Nessun elemento.</p> : null}
                {items.length > 10 ? <p className="border-t border-[#edf3ef] px-4 py-2 text-xs text-[#5c7063]">Altri {items.length - 10} non mostrati.</p> : null}
              </div>
            ))}
          </section>
        ) : null}

        {tab === "products" ? (
          <div className="space-y-3">
            <section aria-label="Prodotti" className={panel}>
              <h2 className="flex items-center justify-between border-b border-[#edf3ef] px-4 py-3 text-sm font-bold text-[#143f30] sm:px-5">
                Prodotti <span className="text-xs font-semibold tabular-nums text-[#5c7063]">{summary.products}</span>
              </h2>
              <div className="divide-y divide-[#edf3ef]">
                {payload.product_activity.map((product) => {
                  const body = (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#143f30]">
                          {[product.last_grade, product.last_standard].filter(Boolean).join(" · ") || "Prodotto"}
                        </span>
                        <span className="block truncate text-xs text-[#5c7063]">
                          {product.last_raw_spec_text ?? product.canonical_product_key ?? "Specifiche non disponibili"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs text-[#5c7063]">
                        <span className="block">{product.rfq_count} RFQ · {product.offer_count} offerte · {product.order_count} ordini</span>
                        <span className="block tabular-nums">{dateLabel(product.last_activity_at)}</span>
                      </span>
                    </>
                  );
                  const key = product.canonical_product_key ?? product.canonical_product_id ?? product.last_raw_spec_text ?? "product";
                  const row = "flex min-h-[60px] items-center gap-3 px-4 py-2.5 sm:px-5";
                  return product.canonical_product_id ? (
                    <Link key={key} href={appRoutes.commercial.product(product.canonical_product_id)} className={row + " transition hover:bg-[#f5faf7]"}>{body}</Link>
                  ) : <div key={key} className={row}>{body}</div>;
                })}
              </div>
              {payload.product_activity.length === 0 ? <p className={empty}>Nessun prodotto collegato.</p> : null}
            </section>

            <section aria-label="Prezzi osservati" className={panel}>
              <h2 className="flex items-center justify-between border-b border-[#edf3ef] px-4 py-3 text-sm font-bold text-[#143f30] sm:px-5">
                Prezzi osservati <span className="text-xs font-semibold tabular-nums text-[#5c7063]">{summary.priced_lines}</span>
              </h2>
              {payload.price_activity.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="text-[11px] uppercase tracking-wide text-[#6b7d73]">
                      <tr>
                        <th className="px-4 py-2 font-semibold sm:px-5">Data</th>
                        <th className="font-semibold">Tipo</th>
                        <th className="font-semibold">Prezzo</th>
                        <th className="font-semibold">Quantità</th>
                        <th className="pr-4 font-semibold">Fonte</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf3ef]">
                      {payload.price_activity.map((price) => (
                        <tr key={`${price.activity_type}-${price.business_id}-${price.source_observation_id ?? "line"}`}>
                          <td className="px-4 py-2.5 tabular-nums text-[#5c7063] sm:px-5">{dateLabel(price.event_at)}</td>
                          <td className="text-[#5c7063]">{eventLabel(price.activity_type)}</td>
                          <td className="font-semibold tabular-nums text-[#143f30]">{priceLabel(price.price_value, price.currency, price.price_unit)}</td>
                          <td className="tabular-nums text-[#5c7063]">
                            {price.quantity !== null ? `${numberLabel(price.quantity)} ${price.quantity_unit ?? ""}` : "—"}
                          </td>
                          <td className="pr-4">
                            {price.source_observation_id ? (
                              <Link href={`/evidence/${price.source_observation_id}`} target="_blank" className="text-xs font-semibold text-[#175640] underline underline-offset-2">
                                Documento ↗
                              </Link>
                            ) : (
                              <span className="text-xs text-[#6b7d73]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className={empty}>Nessun prezzo collegato.</p>}
            </section>
          </div>
        ) : null}
      </div>
    </>
  );
}
