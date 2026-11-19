// COMM-CYCLE2.C — pure, customer-only offer email content. Never expose
// supplier prices, internal buying targets or private commercial memory.
import { quoteEstimatedTotal, type QuoteUnit } from "./comm-cycle2b-pricing.ts";

export type CustomerOfferEmailLine = {
  description: string;
  quantity: number | null;
  quantityUnit: string;
  rate: string;
  unit: QuoteUnit;
  weight: string;
};
export type CustomerOfferEmailSnapshot = {
  seller: string;
  client: string | null;
  revision: number;
  validUntil: string;
  delivery: string;
  payment: string;
  lines: CustomerOfferEmailLine[];
};
export type CustomerOfferEmailPayload = { subject: string; html: string; text: string };

const escapeHtml = (value: string): string => value.replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const euro = (value: number) => new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);
function dateLabel(value: string) {
  const bits = value.split("-");
  return bits.length === 3 ? bits.reverse().join("/") : value;
}
export function defaultCustomerOfferSubject(snapshot: CustomerOfferEmailSnapshot): string {
  return "Offerta commerciale v" + snapshot.revision + " · " + snapshot.seller;
}
export function customerOfferEmailReady(snapshot: CustomerOfferEmailSnapshot): boolean {
  return snapshot.revision >= 1 && Boolean(snapshot.validUntil && snapshot.delivery.trim() && snapshot.payment.trim())
    && snapshot.lines.length > 0 && snapshot.lines.length <= 100
    && snapshot.lines.every(l => l.rate.trim() && Number(l.rate) > 0
      && (l.unit === "EUR/t" || l.unit === "EUR/m"));
}
export function buildCustomerOfferEmail(
  snapshot: CustomerOfferEmailSnapshot, subject: string, message: string,
): CustomerOfferEmailPayload {
  const safeSubject = subject.trim();
  const safeMessage = message.trim();
  const lines = snapshot.lines.map((line,i) => {
    const value = Number(line.rate);
    const price = euro(value) + " " + (line.unit === "EUR/m" ? "€/m" : "€/t");
    const quantity = line.quantity !== null && Number.isFinite(line.quantity)
      ? String(line.quantity).replace(".", ",") + " " + line.quantityUnit
      : "Da confermare";
    const total = quoteEstimatedTotal(line.rate,line.unit,line.quantity,line.quantityUnit,line.weight);
    return {
      index: i+1, description: line.description || "Materiale da precisare",
      price, quantity, total: total === null ? null : "€ " + euro(total),
    };
  });
  const allTotals = lines.every(l => l.total !== null);
  const sum = allTotals ? snapshot.lines.reduce((total,l) =>
    total + (quoteEstimatedTotal(l.rate,l.unit,l.quantity,l.quantityUnit,l.weight) ?? 0),0) : null;
  const intro = safeMessage || "In riferimento alla vostra richiesta, vi sottoponiamo la nostra offerta commerciale.";
  const terms = [
    ["Validità","fino al " + dateLabel(snapshot.validUntil)],
    ["Resa e consegna",snapshot.delivery],
    ["Pagamento",snapshot.payment],
  ];
  const lineHtml = lines.map(l => '<tr><td style="padding:10px 8px;border-bottom:1px solid #e1e7e4;">'
    + escapeHtml(String(l.index) + ". " + l.description)
    + '</td><td style="padding:10px 8px;border-bottom:1px solid #e1e7e4;">' + escapeHtml(l.quantity)
    + '</td><td style="padding:10px 8px;border-bottom:1px solid #e1e7e4;white-space:nowrap;">'
    + escapeHtml(l.price) + '</td><td style="padding:10px 8px;border-bottom:1px solid #e1e7e4;">'
    + escapeHtml(l.total ?? "Da verificare") + '</td></tr>').join("");
  const termHtml = terms.map(([label,value]) =>
    '<p style="margin:8px 0"><strong>' + escapeHtml(label) + ':</strong> ' + escapeHtml(value) + "</p>").join("");
  const html = '<!doctype html><html lang="it"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
    + '<body style="margin:0;background:#f3f5f4;font-family:Arial,sans-serif;color:#20342b;">'
    + '<div style="max-width:720px;margin:auto;padding:20px 12px;">'
    + '<div style="padding:20px;background:#173f35;color:white;border-radius:14px 14px 0 0;">'
    + '<div style="font-size:12px;letter-spacing:.1em;">SMART STEEL SALES · OFFERTA</div>'
    + '<h1 style="font-size:23px;margin:8px 0 0">Offerta commerciale · Revisione '
    + escapeHtml(String(snapshot.revision)) + '</h1></div>'
    + '<div style="background:white;padding:20px;border:1px solid #d9e8dd;border-radius:0 0 14px 14px;">'
    + '<p><strong>' + escapeHtml(snapshot.seller) + '</strong>'
    + (snapshot.client ? ' → ' + escapeHtml(snapshot.client) : '') + '</p>'
    + '<p style="white-space:pre-line;line-height:1.6;">' + escapeHtml(intro) + '</p>'
    + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px;">'
    + '<thead><tr style="background:#edf5ef"><th align="left">Articolo</th><th align="left">Quantità</th>'
    + '<th align="left">Prezzo</th><th align="left">Totale riga</th></tr></thead>'
    + '<tbody>' + lineHtml + '</tbody></table></div>'
    + (sum === null ? '<p style="font-size:12px;color:#56695e;">Totale complessivo non disponibile: alcune quantità richiedono verifica.</p>'
      : '<p style="text-align:right;font-weight:700">Totale indicativo: € ' + euro(sum) + '</p>')
    + '<div style="border-top:1px solid #dce9df;margin-top:18px;padding-top:12px;">'
    + termHtml + '</div><p style="font-size:12px;color:#5e7464;margin-top:24px;">'
    + 'Prezzi espressi in EUR, salvo diversa indicazione. Offerta revisione '
    + escapeHtml(String(snapshot.revision)) + '.</p></div></div></body></html>';
  const text = [
    "OFFERTA COMMERCIALE · Revisione " + snapshot.revision,
    snapshot.seller + (snapshot.client ? " → " + snapshot.client : ""),
    "",intro,"",
    ...lines.map(l => l.index + ". " + l.description + " | " + l.quantity
      + " | " + l.price + " | Totale: " + (l.total ?? "da verificare")),
    "",sum === null ? "Totale complessivo da verificare" : "Totale indicativo: € " + euro(sum),
    "",...terms.map(([k,v]) => k + ": " + v),
  ].join("\n");
  return { subject: safeSubject, html, text };
}

export function validCustomerEmailRecipient(value: string): boolean {
  return value.length >= 6 && value.length <= 254
    && /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(value);
}
