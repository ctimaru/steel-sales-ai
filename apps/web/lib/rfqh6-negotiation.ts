import { absoluteUrl } from "@/lib/site";

export type Rfqh6NegotiationKind =
  | "message"
  | "clarification"
  | "revision_request"
  | "counter_target"
  | "bafo_request"
  | "reminder";

export type Rfqh6SharedTarget = {
  position: number;
  description: string;
  eurT: number;
  eurM: number;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function dueLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function number(value: number, digits: number) {
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function kindLabel(kind: Rfqh6NegotiationKind) {
  if (kind === "clarification") return "Richiesta di chiarimento";
  if (kind === "revision_request") return "Revisione offerta richiesta";
  if (kind === "counter_target") return "Counter target";
  if (kind === "bafo_request") return "Best & Final Offer";
  if (kind === "reminder") return "Promemoria negoziazione";
  return "Messaggio RFQ";
}

export function buildRfqh6NegotiationEmail(input: {
  buyerOrganizationName: string;
  supplierName: string | null;
  rfqTitle: string;
  kind: Rfqh6NegotiationKind;
  body: string;
  dueAt: string | null;
  inviteToken: string;
  targets?: Rfqh6SharedTarget[];
}) {
  const title = kindLabel(input.kind);
  const deadline = dueLabel(input.dueAt);
  const inviteUrl = absoluteUrl(
    "/rfq/respond/" + encodeURIComponent(input.inviteToken),
  );
  const greeting = input.supplierName
    ? "Buongiorno " + input.supplierName + ","
    : "Buongiorno,";
  const subject =
    title + " · " + input.buyerOrganizationName + " · " + input.rfqTitle;

  const targets = input.targets ?? [];
  const targetRowsHtml = targets
    .map(
      (target) => `
        <tr>
          <td style="padding:9px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;">
            <strong>Riga ${target.position}</strong> · ${escapeHtml(target.description)}
          </td>
          <td style="padding:9px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;color:#173f35;font-weight:700;">
            € ${number(target.eurT, 2)}/t
          </td>
          <td style="padding:9px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;color:#173f35;font-weight:700;">
            € ${number(target.eurM, 4)}/m
          </td>
        </tr>`,
    )
    .join("");

  const targetBlockHtml = targets.length
    ? `
      <div style="margin:20px 0 0;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#527268;margin-bottom:8px;">
          Counter target condiviso
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
          <tbody>${targetRowsHtml}</tbody>
        </table>
      </div>`
    : "";

  const targetRowsText = targets
    .map(
      (target) =>
        "Riga " +
        String(target.position) +
        " · " +
        target.description +
        " · € " +
        number(target.eurT, 2) +
        "/t · € " +
        number(target.eurM, 4) +
        "/m",
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="it">
  <head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
  <body style="margin:0;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
      <div style="background:#123d34;border-radius:16px 16px 0 0;padding:24px;color:#ffffff;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a8cfc1;">
          Smart Steel Sales · RFQ Negotiation
        </div>
        <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;">${escapeHtml(title)}</h1>
      </div>
      <div style="background:#ffffff;border:1px solid #dce2df;border-top:0;border-radius:0 0 16px 16px;padding:24px;">
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
          <strong>${escapeHtml(input.buyerOrganizationName)}</strong> ha aggiornato la trattativa relativa a
          <strong>${escapeHtml(input.rfqTitle)}</strong>.
        </p>
        <div style="margin:16px 0;padding:14px 16px;border-radius:10px;background:#f7f9f8;font-size:14px;line-height:1.6;color:#374151;">
          ${escapeHtml(input.body).replaceAll("\n", "<br/>")}
        </div>
        ${deadline ? `<p style="margin:0 0 18px;font-size:14px;color:#4b5563;"><strong>Risposta richiesta entro:</strong> ${escapeHtml(deadline)}</p>` : ""}
        ${targetBlockHtml}
        <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;margin-top:22px;background:#173f35;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 19px;border-radius:10px;">
          Apri trattativa RFQ
        </a>
        <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#6b7280;">
          Eventuali counter target mostrati qui sono stati condivisi esplicitamente dal buyer per questa trattativa.
          Il target interno originario della RFQ resta privato.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    greeting,
    "",
    title + " · " + input.rfqTitle,
    input.body,
    deadline ? "Risposta richiesta entro: " + deadline : "",
    targets.length ? "Counter target condiviso:" : "",
    targetRowsText,
    "",
    "Apri trattativa RFQ: " + inviteUrl,
    "",
    "Il target interno originario della RFQ resta privato.",
  ]
    .filter((line, index, values) => line !== "" || values[index - 1] !== "")
    .join("\n");

  return { subject, html, text, inviteUrl };
}
