/**
 * COMM-RFQ-UX3.A: synthetic industrial RFQ data for LOCAL CI only.
 * No customer information, company IDs or external providers.
 */
"use strict";
const marker = "COMM-RFQ-UX3A LOCAL QA — ten synthetic sections only";
const specs = [
  ["quadro", "100x100x5", 10, 6, "S355J2H", "EN 10219"],
  ["rettangolare", "120x80x4", 12, 12, "S355J2H", "EN 10219"],
  ["quadro", "80x80x4", 25, 6, "S235JRH", "EN 10219"],
  ["quadro", "70x70x3", 18, 6, "S355J2H", "EN 10219"],
  ["rettangolare", "140x60x4", 14, 12, "S355J2H", "EN 10219"],
  ["quadro", "150x150x5", 8, 6, "S355J2H", "EN 10219"],
  ["rettangolare", "100x60x3", 22, 6, "S235JRH", "EN 10219"],
  ["quadro", "60x60x3", 16, 12, "S235JRH", "EN 10219"],
  ["tondo", "60.3x3", 30, 6, "S235JRH", "EN 10210"],
  ["rettangolare", "160x80x5", 18, 6, "S355J2H", "EN 10219"],
];
const lines = specs.map(([form, dimensions, bars, length, grade, standard]) => {
  const [a,b,c] = dimensions.split("x");
  return {
    sourceText: bars + " barre da " + length + " metri di tubo " + form + " " + dimensions + " " + grade + " " + standard,
    itemRole: "requested",
    standard,grade,
    outerDiameterMm: form === "tondo" ? a : "",
    widthMm: form !== "tondo" ? a : "",
    heightMm: form !== "tondo" ? b : "",
    thicknessMm: form === "tondo" ? b : c,
    lengthMm: String(length * 1000),
    quantity: String(bars), quantityUnit:"BARRE",finish:"",note:"",
  };
});
const text = marker + "\n" + lines.map(row=>row.sourceText).join("\n");
module.exports = Object.freeze({ marker, specs, lines, text });
