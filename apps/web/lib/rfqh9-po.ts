import { createHash, createHmac } from "node:crypto";

import { absoluteUrl } from "@/lib/site";

export type Rfqh9PoLine = {
  line_position: number;
  description: string;
  standard_code: string | null;
  grade_code: string | null;
  finish_code: string | null;
  awarded_tonnes: number | string;
  awarded_meters: number | string;
  unit_eur_t: number | string;
  unit_eur_m: number | string;
  line_total_eur: number | string;
  lead_time_days: number | null;
  delivery_date: string | null;
};

export type Rfqh9SupplierPortal = {
  valid: boolean;
  po_version_id?: string;
  po_draft_id?: string;
  rfq_id?: string;
  version_no?: number;
  status?: string;
  po_number?: string;
  buyer_organization_name?: string;
  supplier_name?: string | null;
  currency_code?: string;
  incoterm?: string | null;
  payment_terms?: string | null;
  delivery_date?: string | null;
  lead_time_days?: number | null;
  total_tonnes?: number | string;
  total_eur?: number | string;
  buyer_message?: string | null;
  notes?: string | null;
  confirmation_due_at?: string | null;
  issued_at?: string;
  snapshot_sha256?: string;
  can_respond?: boolean;
  response?: {
    decision: "confirmed" | "rejected" | "change_requested";
    message: string | null;
    confirmed_delivery_date: string | null;
    supplier_reference: string | null;
    responded_at: string;
  } | null;
  lines?: Rfqh9PoLine[];
};

function secret() {
  const value =
    process.env.PO_CONFIRMATION_SECRET?.trim() ||
    process.env.RFQ_INVITE_SECRET?.trim();
  if (!value) throw new Error("PO_CONFIRMATION_SECRET or RFQ_INVITE_SECRET is not configured");
  return value;
}

export function createRfqh9PoSecurity(input: {
  poDraftId: string;
  versionNo: number;
}) {
  const material = [
    "rfqh9-po",
    input.poDraftId,
    String(input.versionNo),
  ].join(":");

  const token = createHmac("sha256", secret())
    .update(material)
    .digest("base64url");

  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    idempotencyKey:
      "rfqh9-" + input.poDraftId + "-issue-v" + String(input.versionNo),
  };
}

export function buildRfqh9SupplierUrl(token: string) {
  return absoluteUrl("/po/respond/" + encodeURIComponent(token));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function number(value: number | string | null | undefined, digits = 2) {
  return numeric(value).toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    dateStyle: "long",
  }).format(date);
}

function dateTimeLabel(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function buildRfqh9PoEmail(input: {
  portal: Rfqh9SupplierPortal;
  supplierUrl: string;
}) {
  const po = input.portal;
  const buyer = po.buyer_organization_name || "Buyer Smart Steel Sales";
  const supplier = po.supplier_name || "Fornitore";
  const subject = "Ordine di acquisto " + (po.po_number || "") + " · " + buyer;
  const deadline = dateTimeLabel(po.confirmation_due_at);

  const rowsHtml = (po.lines ?? [])
    .map(
      (line) => `
      <tr>
        <td style="padding:9px 7px;border-bottom:1px solid #e5e7eb;font-size:12px;">
          <strong>${line.line_position}. ${escapeHtml(line.description)}</strong>
          <br/><span style="color:#6b7280;">${escapeHtml(line.standard_code || "—")} · ${escapeHtml(line.grade_code || "—")} · ${escapeHtml(line.finish_code || "—")}</span>
        </td>
        <td style="padding:9px 7px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:right;">${number(line.awarded_tonnes, 3)} t</td>
        <td style="padding:9px 7px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:right;">€ ${number(line.unit_eur_t, 2)}/t</td>
        <td style="padding:9px 7px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:right;font-weight:700;">€ ${number(line.line_total_eur, 2)}</td>
      </tr>`,
    )
    .join("");

  const rowsText = (po.lines ?? [])
    .map(
      (line) =>
        String(line.line_position) +
        ". " +
        line.description +
        " | " +
        number(line.awarded_tonnes, 3) +
        " t | € " +
        number(line.unit_eur_t, 2) +
        "/t | € " +
        number(line.line_total_eur, 2),
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="it">
  <head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
  <body style="margin:0;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
      <div style="background:#123d34;border-radius:16px 16px 0 0;padding:24px;color:#fff;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a8cfc1;">Smart Steel Sales · Purchase Order</div>
        <h1 style="margin:10px 0 0;font-size:23px;">${escapeHtml(po.po_number || "Purchase Order")}</h1>
      </div>
      <div style="background:#fff;border:1px solid #dce2df;border-top:0;border-radius:0 0 16px 16px;padding:24px;">
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Buongiorno ${escapeHtml(supplier)},</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
          <strong>${escapeHtml(buyer)}</strong> ha emesso l'ordine di acquisto indicato sotto.
          Verifica il documento e conferma, rifiuta oppure richiedi una modifica dal link personale.
        </p>
        ${po.buyer_message ? `<div style="margin:16px 0;padding:14px 16px;border-radius:10px;background:#f7f9f8;font-size:14px;line-height:1.6;">${escapeHtml(po.buyer_message).replaceAll("\n","<br/>")}</div>` : ""}
        ${deadline ? `<p style="font-size:13px;"><strong>Conferma richiesta entro:</strong> ${escapeHtml(deadline)}</p>` : ""}
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:18px 0;">
          <tbody>${rowsHtml}</tbody>
        </table>
        <div style="margin:16px 0;padding:14px;border-radius:10px;background:#f7f9f8;font-size:13px;line-height:1.7;">
          <strong>Totale:</strong> € ${number(po.total_eur, 2)}<br/>
          <strong>Quantità:</strong> ${number(po.total_tonnes, 3)} t<br/>
          <strong>Incoterm:</strong> ${escapeHtml(po.incoterm || "—")}<br/>
          <strong>Pagamento:</strong> ${escapeHtml(po.payment_terms || "—")}<br/>
          <strong>Consegna:</strong> ${escapeHtml(dateLabel(po.delivery_date))}
        </div>
        <a href="${escapeHtml(input.supplierUrl)}" style="display:inline-block;background:#173f35;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 20px;border-radius:10px;">
          Apri e conferma ordine
        </a>
        <p style="margin:20px 0 0;font-size:11px;line-height:1.6;color:#6b7280;">
          Il link è personale. Il documento è versionato e verificabile tramite snapshot hash.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    "Purchase Order " + (po.po_number || ""),
    "",
    buyer + " ha emesso un ordine di acquisto.",
    po.buyer_message || "",
    deadline ? "Conferma richiesta entro: " + deadline : "",
    "",
    rowsText,
    "",
    "Totale: € " + number(po.total_eur, 2),
    "Quantità: " + number(po.total_tonnes, 3) + " t",
    "Incoterm: " + (po.incoterm || "—"),
    "Pagamento: " + (po.payment_terms || "—"),
    "Consegna: " + dateLabel(po.delivery_date),
    "",
    "Apri e conferma ordine: " + input.supplierUrl,
  ]
    .filter((line, index, values) => line !== "" || values[index - 1] !== "")
    .join("\n");

  return { subject, html, text };
}
