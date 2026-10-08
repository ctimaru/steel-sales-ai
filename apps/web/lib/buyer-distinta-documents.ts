export type BuyerDistintaDocumentRequirements = {
  inspectionDocument: "" | "2.1" | "2.2" | "3.1" | "3.2";
  ceDop: boolean;
  iso9001: boolean;
};

export const emptyBuyerDocumentRequirements = (): BuyerDistintaDocumentRequirements => ({
  inspectionDocument: "",
  ceDop: false,
  iso9001: false,
});

const allowedDocuments = new Set(["", "2.1", "2.2", "3.1", "3.2"]);

export function normalizeBuyerDocumentRequirements(
  candidate: unknown,
): BuyerDistintaDocumentRequirements {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    return emptyBuyerDocumentRequirements();
  }
  const record = candidate as Record<string, unknown>;
  return {
    inspectionDocument: typeof record.inspectionDocument === "string" &&
      allowedDocuments.has(record.inspectionDocument)
      ? record.inspectionDocument as BuyerDistintaDocumentRequirements["inspectionDocument"]
      : "",
    ceDop: record.ceDop === true,
    iso9001: record.iso9001 === true,
  };
}

/** A condition of the whole request, not a requirement repeated on each tube. */
export function formatBuyerDocumentRequirements(input: BuyerDistintaDocumentRequirements): string {
  const parts = [
    input.inspectionDocument ? "Certificato di controllo EN 10204 tipo " + input.inspectionDocument : "",
    input.ceDop ? "Marcatura CE e dichiarazione di prestazione DoP, ove applicabili" : "",
    input.iso9001 ? "Certificazione UNI EN ISO 9001 del produttore" : "",
  ].filter(Boolean);
  return parts.length ? "Documentazione richiesta per l'intera distinta: " + parts.join("; ") : "";
}
