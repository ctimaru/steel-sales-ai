import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { loadCompany360 } from "../actions";

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

export default async function Company360Page({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const result = await loadCompany360(companyId);

  if (result.error) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          {result.error}
        </div>
      </div>
    );
  }

  if (!result.found || !result.data) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <p className="text-sm text-slate-600">Azienda non trovata nel workspace.</p>
        <Link href="/customers" className="text-sm font-semibold text-indigo-600">← Torna a Clienti / aziende</Link>
      </div>
    );
  }

  const payload = result.data;
  const company = payload.company;
  const summary = payload.summary;

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div>
        <Link href="/customers" className="text-xs font-semibold text-indigo-600">← Clienti / aziende</Link>
        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap gap-2">
              {company.verified ? <Badge tone="green">Identità verificata</Badge> : <Badge tone="amber">Identità da verificare</Badge>}
              {company.company_type ? <Badge tone="neutral">{company.company_type}</Badge> : null}
              {company.country ? <Badge tone="neutral">{company.country}</Badge> : null}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{company.name}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {company.vat_number ? `P.IVA ${company.vat_number}` : "P.IVA non disponibile"}
              {company.website ? <> · <span>{company.website}</span></> : null}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Read model</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">Company 360 normalizzato</p>
            <p className="mt-1 text-xs text-slate-500">Solo relazioni deterministiche e verificate</p>
          </div>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Contatti", summary.contacts],
          ["Conversazioni", summary.conversations],
          ["Messaggi", summary.messages],
          ["RFQ", summary.rfqs],
          ["Offerte", summary.offers],
          ["Ordini", summary.orders],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-semibold text-slate-950">{String(value)}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          </div>
        ))}
      </section>

      {summary.contacts === 0 && company.verified ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-amber-950">Company verificata, ma nessun Contact ancora confermato</p>
              <p className="mt-1 text-sm text-amber-800">
                Le attività non vengono attribuite a questa Company finché il rapporto Contact→Company non viene confermato.
              </p>
            </div>
            <Link
              href="/review/identities"
              className="shrink-0 rounded-lg bg-amber-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800"
            >
              Apri identità aziendali
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">Identità e contatti</h2>
          <div className="mt-4 space-y-3">
            {payload.verifications.map((verification) => (
              <div key={verification.verification_id} className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Identità verificata</p>
                <p className="mt-1 text-sm font-semibold text-emerald-950">{verification.identity_value}</p>
                <p className="mt-1 text-xs text-emerald-700">
                  {verification.identity_type} · {verification.verification_basis} · {dateLabel(verification.verified_at)}
                </p>
              </div>
            ))}
            {payload.verifications.length === 0 ? (
              <p className="text-sm text-slate-500">Nessuna identità business verificata.</p>
            ) : null}
          </div>

          <div className="my-5 border-t border-slate-100" />

          <div className="space-y-3">
            {payload.contacts.map((contact) => (
              <div key={contact.contact_id} className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-950">{contact.full_name}</p>
                <p className="mt-1 text-xs text-slate-500">{contact.email ?? "Email non disponibile"}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {contact.role ?? "Ruolo non specificato"} · {contact.message_count} messaggi · {contact.rfq_count} RFQ
                </p>
              </div>
            ))}
            {payload.contacts.length === 0 ? (
              <p className="text-sm text-slate-500">Nessun contatto verificato collegato.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Timeline commerciale</h2>
              <p className="mt-1 text-xs text-slate-500">
                Messaggi, RFQ, offerte e ordini attribuiti a questa Company tramite link normalizzati.
              </p>
            </div>
            <Badge tone="neutral">{payload.timeline.length} eventi</Badge>
          </div>

          <div className="mt-5 space-y-3">
            {payload.timeline.map((event) => (
              <div
                key={`${event.event_type}-${event.event_id}`}
                className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[110px_1fr_auto] md:items-start"
              >
                <div>
                  <Badge tone={event.event_type === "order" ? "green" : event.event_type === "offer" ? "neutral" : "amber"}>
                    {eventLabel(event.event_type)}
                  </Badge>
                  <p className="mt-2 text-xs text-slate-400">{dateLabel(event.event_at)}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Stato: {event.status ?? "—"}
                    {event.source_message_id ? " · fonte messaggio collegata" : ""}
                  </p>
                </div>
                <div className="text-xs text-slate-400">Provenienza normalizzata</div>
              </div>
            ))}
            {payload.timeline.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Nessuna attività normalizzata collegata a questa Company.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Prodotti collegati</h2>
              <p className="mt-1 text-xs text-slate-500">Aggregati da RFQ, offerte e ordini normalizzati.</p>
            </div>
            <Badge tone="neutral">{summary.products} prodotti</Badge>
          </div>

          <div className="mt-4 space-y-3">
            {payload.product_activity.map((product) => (
              <div key={product.canonical_product_key ?? product.canonical_product_id ?? product.last_raw_spec_text ?? "product"} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {[product.last_grade, product.last_standard].filter(Boolean).join(" · ") || "Prodotto steel"}
                    </p>
                    <p className="mt-1 max-w-xl text-xs text-slate-500">
                      {product.last_raw_spec_text ?? product.canonical_product_key ?? "Specifiche non disponibili"}
                    </p>
                  </div>
                  {product.canonical_product_id ? (
                    <Link href={`/products/${product.canonical_product_id}`} className="text-xs font-semibold text-indigo-600">
                      Product 360 →
                    </Link>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{product.rfq_count} RFQ</span>
                  <span>{product.offer_count} offerte</span>
                  <span>{product.order_count} ordini</span>
                  <span>Ultima attività {dateLabel(product.last_activity_at)}</span>
                </div>
              </div>
            ))}
            {payload.product_activity.length === 0 ? (
              <p className="text-sm text-slate-500">Nessuna attività prodotto collegata.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Prezzi osservati</h2>
              <p className="mt-1 text-xs text-slate-500">Solo righe normalizzate con prezzo esplicito.</p>
            </div>
            <Badge tone="neutral">{summary.priced_lines} righe</Badge>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2">Data</th>
                  <th>Tipo</th>
                  <th>Prezzo</th>
                  <th>Quantità</th>
                  <th>Fonte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payload.price_activity.map((price) => (
                  <tr key={`${price.activity_type}-${price.business_id}-${price.source_observation_id ?? "line"}`}>
                    <td className="py-3 text-slate-600">{dateLabel(price.event_at)}</td>
                    <td className="text-slate-600">{eventLabel(price.activity_type)}</td>
                    <td className="font-semibold text-slate-950">{priceLabel(price.price_value, price.currency, price.price_unit)}</td>
                    <td className="text-slate-600">
                      {price.quantity !== null ? `${numberLabel(price.quantity)} ${price.quantity_unit ?? ""}` : "—"}
                    </td>
                    <td>
                      {price.source_observation_id ? (
                        <Link href={`/evidence/${price.source_observation_id}`} target="_blank" className="text-xs font-semibold text-indigo-600">
                          Evidenza ↗
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">Normalizzato</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payload.price_activity.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Nessun prezzo normalizzato collegato.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">RFQ</h2>
          <p className="mt-1 text-xs text-slate-500">{payload.rfqs.length} richieste collegate</p>
          <div className="mt-4 space-y-2">
            {payload.rfqs.slice(0, 5).map((rfq) => (
              <div key={rfq.rfq_id} className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{dateLabel(rfq.requested_at)} · {rfq.status}</p>
                <p className="mt-1 text-xs text-slate-500">{rfq.lines.length} righe · priorità {rfq.priority}</p>
              </div>
            ))}
            {payload.rfqs.length === 0 ? <p className="text-sm text-slate-500">Nessuna RFQ.</p> : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Offerte</h2>
          <p className="mt-1 text-xs text-slate-500">{payload.offers.length} offerte collegate</p>
          <div className="mt-4 space-y-2">
            {payload.offers.slice(0, 5).map((offer, index) => (
              <div key={String(offer.offer_id ?? index)} className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">
                  {dateLabel(typeof offer.offered_at === "string" ? offer.offered_at : null)} · {String(offer.status ?? "—")}
                </p>
              </div>
            ))}
            {payload.offers.length === 0 ? <p className="text-sm text-slate-500">Nessuna offerta normalizzata.</p> : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Ordini</h2>
          <p className="mt-1 text-xs text-slate-500">{payload.orders.length} ordini collegati</p>
          <div className="mt-4 space-y-2">
            {payload.orders.slice(0, 5).map((order, index) => (
              <div key={String(order.order_id ?? index)} className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">
                  {dateLabel(typeof order.ordered_at === "string" ? order.ordered_at : null)} · {String(order.status ?? "—")}
                </p>
              </div>
            ))}
            {payload.orders.length === 0 ? <p className="text-sm text-slate-500">Nessun ordine normalizzato.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
