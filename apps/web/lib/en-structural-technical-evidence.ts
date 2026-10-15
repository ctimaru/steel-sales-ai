/**
 * CALC-INT3B: public, non-normative technical evidence for EN hollow sections.
 * This registry is a reference to an external standards publisher, not a
 * reproduction of protected tables or a product conformity assessment.
 */
export type StructuralTubeMethod = "en10219" | "en10210";
export type StructuralGeometry = "round" | "square" | "rectangular";

export type StructuralTechnicalEvidence = {
  method: StructuralTubeMethod;
  title: string;
  partTwo: string;
  publisherReferenceUrl: string;
  manufacturing: "cold-formed welded" | "hot-finished";
  geometries: readonly StructuralGeometry[];
  sourceClaims: {
    coversTolerances: true;
    coversDimensions: true;
    coversSectionProperties: true;
    annexAFormula: true;
    annexBLimitedCommonSizes: true;
  };
  noteEn: string;
  noteIt: string;
};

export const STRUCTURAL_EVIDENCE: Record<StructuralTubeMethod,StructuralTechnicalEvidence> = {
  en10219: {
    method:"en10219",title:"EN 10219",partTwo:"EN 10219-2:2019",
    publisherReferenceUrl:"https://conto.uni.com/en-10219-2-2019",
    manufacturing:"cold-formed welded",
    geometries:["round","square","rectangular"],
    sourceClaims:{coversTolerances:true,coversDimensions:true,coversSectionProperties:true,annexAFormula:true,annexBLimitedCommonSizes:true},
    noteEn:"Nominal-corner theoretical mass only. EN 10219-2:2019 covers tolerances, dimensions and sectional properties; a calculated mass is not a tolerance check or certified product weight.",
    noteIt:"Solo massa teorica con raccordi nominali. EN 10219-2:2019 tratta tolleranze, dimensioni e proprietà di sezione; il peso calcolato non verifica tolleranze né certifica il prodotto.",
  },
  en10210: {
    method:"en10210",title:"EN 10210",partTwo:"EN 10210-2:2019",
    publisherReferenceUrl:"https://store.uni.com/en/uni-en-10210-2-2019",
    manufacturing:"hot-finished",
    geometries:["round","square","rectangular"],
    sourceClaims:{coversTolerances:true,coversDimensions:true,coversSectionProperties:true,annexAFormula:true,annexBLimitedCommonSizes:true},
    noteEn:"Nominal-corner theoretical mass only. EN 10210-2:2019 covers tolerances, dimensions and sectional properties; product conformity and delivered mass require supplier documentation.",
    noteIt:"Solo massa teorica con raccordi nominali. EN 10210-2:2019 tratta tolleranze, dimensioni e proprietà di sezione; conformità e massa fornita richiedono documentazione del produttore.",
  },
};

/** Always separate a computed model from a sourced weight reference. */
export type TubeMassEvidenceKind = "theoretical-nominal" | "manufacturer-published" | "source-verified";
export function safeStructuralEvidence(method:string):StructuralTechnicalEvidence|null {
  return method==="en10210" || method==="en10219" ? STRUCTURAL_EVIDENCE[method] : null;
}
export function massEvidenceLabel(kind:TubeMassEvidenceKind,locale:"it"|"en") {
  return ({
    "theoretical-nominal": locale==="it"?"Stima teorica nominale":"Nominal theoretical estimate",
    "manufacturer-published":locale==="it"?"Peso pubblicato dal produttore":"Manufacturer-published weight",
    "source-verified":locale==="it"?"Fonte verificata (non certificazione)":"Verified source (not certification)",
  } as const)[kind];
}
