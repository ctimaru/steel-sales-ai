import type { RfqAiRawLine } from "@/lib/rfq-ai-intake-contract";

/**
 * COMM-RFQ-UX3.A — deterministic, strictly scoped corrections of AI proposals.
 * No AI call, conversation history, tenant data, persistence or RFQ dispatch.
 * Only a numbered proposal may be changed, and its reviewer must reconfirm it.
 */
export type CommercialRfqLineCorrection = {
  serial: number;
  candidateId: string;
  patch: Partial<RfqAiRawLine>;
};

export type CommercialRfqCorrectionResult =
  | { ok: true; index: number; patch: Partial<RfqAiRawLine>; confirmation: string }
  | { ok: false; reason: string };

const HELP = "Per correggere una proposta, indica riga e dato: “riga 2: 20 barre”, “riga 1: lunghezza 6 m”, “riga 1: spessore 5 mm”, “riga 2: norma EN 10219” oppure “riga 2: qualità S355J2H”.";
const NUMBER = String.raw`(\d{1,6}(?:[.,]\d{1,3})?)`;
const numberFirst = new RegExp(String.raw`^(?:quantit[aà]\s+)?` + NUMBER + String.raw`\s*(barre?|pz|pezzi|pezzo|m|metri|metro|tonnellate|tonnellata|ton|t)$`, "i");
const thickness = new RegExp(String.raw`^spessore\s+` + NUMBER + String.raw`\s*(?:mm|millimetri|millimetro)$`, "i");
const length = new RegExp(String.raw`^lunghezza(?:\s+(?:barra|barre))?\s+` + NUMBER + String.raw`\s*(?:m|metri|metro)$`, "i");

function validNumber(raw: string, limit: number): number | null {
  // An Italian thousands separator such as 1.000 is ambiguous with 1.000 as a decimal.
  // Reject instead of silently converting 1,000 bars into 1 bar or one tonne.
  if (/^\d{1,3}\.\d{3}$/.test(raw)) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 && value <= limit ? value : null;
}

export function parseCommercialRfqLineCorrection(
  message: string,
  candidateCount: number,
): CommercialRfqCorrectionResult {
  const text = message.trim().replace(/\s+/g, " ");
  const numbered = /^riga\s+([1-9]\d?)\s*[:,-]?\s*(.*)$/i.exec(text);
  if (!numbered) return { ok: false, reason: HELP };
  const index = Number(numbered[1]) - 1;
  if (!Number.isInteger(candidateCount) || index < 0 || index >= candidateCount) {
    return { ok: false, reason: "Questa riga non è tra le proposte in attesa. Indica un numero da 1 a " + candidateCount + "." };
  }
  const command = numbered[2].replace(/^(?:(?:imposta|cambia|modifica|correggi|metti)\s+)(?:la\s+|il\s+)?/i, "").trim();
  const quantity = numberFirst.exec(command);
  if (quantity) {
    const number = validNumber(quantity[1], 1_000_000);
    const unit = quantity[2].toLowerCase();
    const bars = /^(?:barre?|pz|pezzi|pezzo)$/.test(unit);
    if (number === null || (bars && (/[.,]/.test(quantity[1]) || !Number.isInteger(number))))
      return { ok: false, reason: "La quantità deve essere positiva; il numero di barre deve essere intero." };
    const quantityUnit = bars ? "PZ" : /^(?:m|metri|metro)$/.test(unit) ? "M" : "T";
    return { ok: true, index,
      patch: { quantity: quantity[1].replace(",", "."), quantityUnit },
      confirmation: "Quantità della riga " + (index + 1) + " aggiornata a " + number + " " + (bars ? "barre" : quantityUnit === "M" ? "m" : "t") };
  }
  const wall = thickness.exec(command);
  if (wall) {
    const number = validNumber(wall[1], 100);
    if (number === null) return { ok: false, reason: "Lo spessore deve essere positivo e non superiore a 100 mm. Verifica il dato." };
    return { ok: true, index, patch: { thicknessMm: wall[1].replace(",", ".") },
      confirmation: "Spessore della riga " + (index + 1) + " aggiornato a " + number + " mm" };
  }
  const barLength = length.exec(command);
  if (barLength) {
    const number = validNumber(barLength[1], 100);
    if (number === null) return { ok: false, reason: "La lunghezza barra deve essere positiva e non superiore a 100 m. Verifica il dato." };
    return { ok: true, index, patch: { lengthMm: String(number * 1000) },
      confirmation: "Lunghezza della riga " + (index + 1) + " aggiornata a " + number + " m" };
  }
  const standard = /^norma\s+EN\s*102(19|10)$/i.exec(command);
  if (standard) {
    const label = "EN 102" + standard[1];
    return { ok: true, index, patch: { standard: label },
      confirmation: "Norma della riga " + (index + 1) + " aggiornata a " + label };
  }
  const grade = /^(?:grado|qualit[aà])\s+(S(?:235|275|355|420|460)(?:(?:JR|J0|J2|K2)H?|NH|NL|MH|ML|H)?)$/i.exec(command);
  if (grade) {
    const label = grade[1].toUpperCase();
    return { ok: true, index, patch: { grade: label },
      confirmation: "Qualità della riga " + (index + 1) + " aggiornata a " + label };
  }
  return { ok: false, reason: HELP };
}
