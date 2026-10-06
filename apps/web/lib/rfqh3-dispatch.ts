import { createHash, createHmac } from "node:crypto";

import { absoluteUrl } from "@/lib/site";

export type Rfqh3EmailLine = {
  position: number;
  description: string;
  standardCode: string | null;
  gradeCode: string | null;
  finishCode: string | null;
  quantityMode: string;
  quantity: number;
  barLengthM: number | null;
  weightKgM: number;
  lineMeters: number;
  lineTonnes: number;
  note: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function number(value: number, digits = 2) {
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function quantityLabel(line: Rfqh3EmailLine) {
  if (line.quantityMode === "tonnes") return number(line.quantity, 3) + " t";
  if (line.quantityMode === "bars") {
    const length = line.barLengthM ? " × " + number(line.barLengthM, 2) + " m" : "";
    return number(line.quantity, 0) + " barre" + length;
  }
  return number(line.quantity, 2) + " m";
}

function dueLabel(dueAt: string | null) {
  if (!dueAt) return null;
  const date = new Date(dueAt);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function createRfqh3DispatchSecurity(input: {
  dispatchId: string;
  rfqId: string;
  supplierId: string;
  attemptVersion: number;
}) {
  const secret = process.env.RFQ_INVITE_SECRET;
  if (!secret) throw new Error("RFQ_INVITE_SECRET is not configured");

  const material = [
    input.dispatchId,
    input.rfqId,
    input.supplierId,
    String(input.attemptVersion),
  ].join(":");

  const token = createHmac("sha256", secret)
    .update(material)
    .digest("base64url");

  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    idempotencyKey:
      "rfqh3-" +
      input.dispatchId +
      "-invite-v" +
      String(input.attemptVersion),
  };
}

export function buildRfqh3InviteUrl(token: string) {
  return absoluteUrl("/rfq/respond/" + encodeURIComponent(token));
}

export function createRfqh3ReminderIdempotencyKey(
  dispatchId: string,
  reminderSequence: number,
) {
  return (
    "rfqh3-" +
    dispatchId +
    "-reminder-v" +
    String(reminderSequence)
  );
}

export function buildRfqh3Email(input: {
  buyerOrganizationName: string;
  supplierName: string | null;
  title: string;
  buyerMessage: string | null;
  dueAt: string | null;
  inviteUrl: string;
  lines: Rfqh3EmailLine[];
}) {
  const deadline = dueLabel(input.dueAt);
  const greeting = input.supplierName
    ? "Buongiorno " + input.supplierName + ","
    : "Buongiorno,";

  const subject =
    "Richiesta di offerta · " +
    input.buyerOrganizationName +
    " · " +
    input.title;

  const rowsHtml = input.lines
    .map(
      (line) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;">
            <strong>${escapeHtml(line.description)}</strong>
            ${line.note ? `<br/><span style="color:#6b7280;">${escapeHtml(line.note)}</span>` : ""}
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#4b5563;">${escapeHtml(line.standardCode || "—")}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#4b5563;">${escapeHtml(line.gradeCode || "—")}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#4b5563;">${escapeHtml(line.finishCode || "—")}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#4b5563;text-align:right;">${escapeHtml(quantityLabel(line))}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#4b5563;text-align:right;">${number(line.weightKgM, 3)}</td>
        </tr>`,
    )
    .join("");

  const rowsText = input.lines
    .map(
      (line) =>
        String(line.position) +
        ". " +
        line.description +
        " | " +
        (line.standardCode || "—") +
        " | " +
        (line.gradeCode || "—") +
        " | " +
        quantityLabel(line) +
        " | " +
        number(line.weightKgM, 3) +
        " kg/m",
    )
    .join("\n");

  const messageHtml = input.buyerMessage
    ? `<p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">${escapeHtml(input.buyerMessage).replaceAll("\n", "<br/>")}</p>`
    : "";

  const html = `<!doctype html>
<html lang="it">
  <head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
  <body style="margin:0;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="display:none;max-height:0;overflow:hidden;">Nuova richiesta di offerta da ${escapeHtml(input.buyerOrganizationName)}.</div>
    <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
      <div style="background:#123d34;border-radius:16px 16px 0 0;padding:24px;color:#ffffff;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a8cfc1;">Smart Steel Sales · RFQ</div>
        <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">${escapeHtml(input.title)}</h1>
      </div>
      <div style="background:#ffffff;border:1px solid #dce2df;border-top:0;border-radius:0 0 16px 16px;padding:24px;">
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
          <strong>${escapeHtml(input.buyerOrganizationName)}</strong> ti invita a formulare un'offerta per la richiesta sotto riportata.
        </p>
        ${messageHtml}
        ${deadline ? `<p style="margin:0 0 20px;font-size:14px;color:#4b5563;"><strong>Scadenza richiesta:</strong> ${escapeHtml(deadline)}</p>` : ""}
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 22px;">
          <thead>
            <tr>
              <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;border-bottom:1px solid #cfd8d4;">Articolo</th>
              <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;border-bottom:1px solid #cfd8d4;">Norma</th>
              <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;border-bottom:1px solid #cfd8d4;">Grado</th>
              <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;border-bottom:1px solid #cfd8d4;">Finitura</th>
              <th style="padding:8px;text-align:right;font-size:11px;color:#6b7280;border-bottom:1px solid #cfd8d4;">Quantità</th>
              <th style="padding:8px;text-align:right;font-size:11px;color:#6b7280;border-bottom:1px solid #cfd8d4;">kg/m</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <p style="margin:0 0 18px;font-size:13px;line-height:1.6;color:#6b7280;">
          Il target economico del buyer è interno e non viene condiviso nella richiesta.
        </p>
        <a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;box-sizing:border-box;background:#173f35;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 20px;border-radius:10px;">
          Apri richiesta RFQ
        </a>
        <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#6b7280;">
          Il link è personale per questo destinatario. Non inoltrarlo a terzi.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    greeting,
    "",
    input.buyerOrganizationName + " ti invita a formulare un'offerta.",
    input.buyerMessage || "",
    deadline ? "Scadenza richiesta: " + deadline : "",
    "",
    rowsText,
    "",
    "Il target economico del buyer è interno e non viene condiviso nella richiesta.",
    "",
    "Apri richiesta RFQ: " + input.inviteUrl,
    "",
    "Il link è personale per questo destinatario. Non inoltrarlo a terzi.",
  ]
    .filter((line, index, values) => line !== "" || values[index - 1] !== "")
    .join("\n");

  return { subject, html, text };
}


export function buildRfqh3ReminderEmail(input: {
  buyerOrganizationName: string;
  supplierName: string | null;
  title: string;
  dueAt: string | null;
  inviteUrl: string;
  reminderSequence: number;
}) {
  const deadline = dueLabel(input.dueAt);
  const greeting = input.supplierName
    ? "Buongiorno " + input.supplierName + ","
    : "Buongiorno,";
  const subject =
    "Promemoria RFQ · " +
    input.buyerOrganizationName +
    " · " +
    input.title;

  const html = `<!doctype html>
<html lang="it">
  <head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
  <body style="margin:0;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="display:none;max-height:0;overflow:hidden;">Promemoria richiesta di offerta da ${escapeHtml(input.buyerOrganizationName)}.</div>
    <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
      <div style="background:#123d34;border-radius:16px 16px 0 0;padding:24px;color:#ffffff;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a8cfc1;">Smart Steel Sales · RFQ</div>
        <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;">Promemoria richiesta di offerta</h1>
      </div>
      <div style="background:#ffffff;border:1px solid #dce2df;border-top:0;border-radius:0 0 16px 16px;padding:24px;">
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
          <strong>${escapeHtml(input.buyerOrganizationName)}</strong> ti ricorda la richiesta
          <strong>${escapeHtml(input.title)}</strong>.
        </p>
        ${deadline ? `<p style="margin:0 0 20px;font-size:14px;color:#4b5563;"><strong>Scadenza richiesta:</strong> ${escapeHtml(deadline)}</p>` : ""}
        <a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;box-sizing:border-box;background:#173f35;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 20px;border-radius:10px;">
          Apri richiesta RFQ
        </a>
        <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#6b7280;">
          Promemoria ${input.reminderSequence} di 2. Il link è personale e non deve essere inoltrato.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    greeting,
    "",
    input.buyerOrganizationName + " ti ricorda la richiesta: " + input.title + ".",
    deadline ? "Scadenza richiesta: " + deadline : "",
    "",
    "Apri richiesta RFQ: " + input.inviteUrl,
    "",
    "Promemoria " + String(input.reminderSequence) + " di 2.",
  ]
    .filter((line, index, values) => line !== "" || values[index - 1] !== "")
    .join("\n");

  return { subject, html, text };
}
