/**
 * COMM-RFQ-UX3.B: LOCAL CI ONLY. Ten synthetic sections, two source fields
 * deliberately missing. No production customer text, IDs or providers.
 */
"use strict";
const base = require("./comm-rfq-ux3a-local-fixture.cjs");
const marker = "COMM-RFQ-UX3B LOCAL QA — ten lines with explicit missing technical fields";
const lines = base.lines.map((row, index) => {
  if (index === 7) return {
    ...row, grade: "",
    sourceText: row.sourceText.replace(" " + row.grade + " " + row.standard, " " + row.standard),
  };
  if (index === 8) return {
    ...row, standard: "",
    sourceText: row.sourceText.replace(" " + row.standard, ""),
  };
  return { ...row };
});
const text = marker + "\n" + lines.map(row => row.sourceText).join("\n");
module.exports = Object.freeze({ marker, lines, text });
