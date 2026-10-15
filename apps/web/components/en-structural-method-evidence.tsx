import { STRUCTURAL_EVIDENCE, massEvidenceLabel } from "@/lib/en-structural-technical-evidence";

/**
 * CALC-INT3B: editorial evidence, not an engineering tolerance validator.
 * Kept outside the interactive calculator so existing input state and RFQ
 * conversion behaviour stay byte-for-byte unchanged.
 */
export function EnStructuralMethodEvidence({locale}:{locale:"it"|"en"}) {
  const english=locale==="en";
  return (
    <section aria-label={english?"Structural tube method sources":"Fonti tecniche tubi strutturali"}
      className="rounded-2xl border border-[#dce5e0] bg-white p-4 sm:p-5">
      <h2 className="text-lg font-bold text-[#123b34]">
        {english?"EN 10219 vs EN 10210: source and calculation limits":"EN 10219 e EN 10210: fonte e limiti del calcolo"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#52615b]">
        {english
          ?"The calculator outputs nominal theoretical mass, not measured weight or a delivered-product tolerance assessment. Annex A of each Part 2 addresses structural design section-property formulae; Annex B provides a limited range of common dimensions. Consult the original document and the supplier for applicability."
          :"Il calcolatore restituisce masse teoriche nominali, non pesi misurati o verifiche delle tolleranze di fornitura. L'Allegato A delle rispettive parti 2 tratta formule per le proprietà di sezione e l'Allegato B riporta un numero limitato di dimensioni comuni. Verifica la norma originale e i documenti del fornitore."}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {Object.values(STRUCTURAL_EVIDENCE).map(item=>(
          <article key={item.method} className="rounded-xl border border-[#dce5e0] p-4">
            <h3 className="text-sm font-bold text-[#123b34]">{item.title} · {item.partTwo}</h3>
            <p className="mt-2 text-xs leading-6 text-[#52615b]">{english?item.noteEn:item.noteIt}</p>
            <a href={item.publisherReferenceUrl} rel="noopener noreferrer" target="_blank"
              className="mt-2 inline-block text-xs font-bold text-[#156449] underline underline-offset-2">
              {english?"Standards publisher summary →":"Scheda dell'ente normativo →"}
            </a>
          </article>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-[#52615b]">
        {english?"Mass provenance: ":"Provenienza delle masse: "}
        {massEvidenceLabel("theoretical-nominal",locale)} ≠ {massEvidenceLabel("manufacturer-published",locale)}
        {" ≠ "}{massEvidenceLabel("source-verified",locale)}.
        {english?" None automatically constitutes mill certification.":" Nessuna equivale automaticamente a una certificazione del produttore."}
      </p>
    </section>
  );
}
