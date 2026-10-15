/**
 * CALC-INT3 — public standards registry.
 * Standards are NOT interchangeable with calculation methods.
 * "context" means editorial/selection intent only, not a conformity claim.
 */
export type CalculatorStandardRole = "calculation-method" | "dimensional" | "product";
export type CalculatorStandardStatus = "calculator-live" | "context-only" | "planned";
export type CalculatorGeometry = "chs" | "shs" | "rhs";
export type SteelStandardsEntry = {
  id: string;
  title: string;
  organization: "EN" | "API" | "ASME" | "ASTM";
  role: CalculatorStandardRole;
  status: CalculatorStandardStatus;
  shapes: readonly CalculatorGeometry[];
  sourceUrl: string;
  noteEn: string;
  noteIt: string;
  relatedTo?: readonly string[];
};

/**
 * No reprinting of proprietary normative tables. References link to
 * issuing-body descriptions and should be edition-checked on expansion.
 * Existing EN methods represent nominal geometry assumptions only.
 */
export const CALCULATOR_STANDARDS = [
  {
    id: "en10219", title: "EN 10219", organization: "EN",
    role: "calculation-method", status: "calculator-live",
    shapes: ["chs","shs","rhs"],
    sourceUrl: "https://knowledge.bsigroup.com/",
    noteEn: "Cold-formed structural hollow sections; theoretical nominal-corner geometry, not product certification.",
    noteIt: "Profilati cavi formati a freddo; geometria teorica con raccordi nominali, non certificazione di prodotto.",
  },
  {
    id: "en10210", title: "EN 10210", organization: "EN",
    role: "calculation-method", status: "calculator-live",
    shapes: ["chs","shs","rhs"],
    sourceUrl: "https://knowledge.bsigroup.com/",
    noteEn: "Hot-finished structural hollow sections; theoretical nominal-corner geometry, not product certification.",
    noteIt: "Profilati cavi finiti a caldo; geometria teorica con raccordi nominali, non certificazione di prodotto.",
  },
  {
    id: "api5l", title: "API Spec 5L (47th edition, 2026)", organization: "API",
    role: "product", status: "context-only", shapes: ["chs"],
    sourceUrl: "https://www.api.org/products-and-services/standards/important-standards-announcements/api-announces-47th-edition-of-foundational-line-pipe-standard-5l",
    relatedTo: ["asme-b3610"],
    noteEn: "Line pipe specification: grades, manufacturing and tests. The 47th edition is not a mass formula. Existing U.S. Steel sample reflects an earlier manufacturer's catalog and is not a 47th-edition certification.",
    noteIt: "Specifica per line pipe: gradi, produzione e controlli. La 47ª edizione non è una formula di peso. Il campione U.S. Steel deriva da un catalogo storico, non certifica la 47ª edizione.",
  },
  {
    id: "asme-b3610", title: "ASME B36.10 (2022)", organization: "ASME",
    role: "dimensional", status: "context-only", shapes: ["chs"],
    sourceUrl: "https://www.asme.org/codes-standards/find-codes-standards/b36-10m-welded-seamless-wrought-steel-pipe",
    noteEn: "NPS and Schedule dimensions for wrought steel pipe. No licensed normative schedule table is reproduced here.",
    noteIt: "Dimensioni NPS e Schedule per tubi d'acciaio. Nessuna tabella normativa completa viene riprodotta.",
  },
  {
    id: "astm-a53", title: "ASTM A53/A53M-24", organization: "ASTM",
    role: "product", status: "context-only", shapes: ["chs"],
    sourceUrl: "https://store.astm.org/a0053_a0053m-24.html",
    relatedTo: ["asme-b3610"],
    noteEn: "Steel pipe product specification; selection alone does not validate type, grade or conformity.",
    noteIt: "Specifica di prodotto per tubazioni d'acciaio; la selezione non verifica tipo, grado o conformità.",
  },
  {
    id: "astm-a106", title: "ASTM A106/A106M", organization: "ASTM",
    role: "product", status: "context-only", shapes: ["chs"],
    sourceUrl: "https://store.astm.org/",
    relatedTo: ["asme-b3610"],
    noteEn: "Seamless carbon steel pipe for high-temperature service; edition and grade require confirmation.",
    noteIt: "Tubi senza saldatura per alte temperature; edizione e grado richiedono conferma.",
  },
  {
    id: "astm-a500", title: "ASTM A500/A500M-23", organization: "ASTM",
    role: "product", status: "context-only", shapes: ["chs","shs","rhs"],
    sourceUrl: "https://store.astm.org/a0500_a0500m-23.html",
    noteEn: "Cold-formed US structural HSS. Do NOT assume EN 10219 nominal-corner radii or equivalent masses.",
    noteIt: "Profilati strutturali HSS americani. NON assumere raggi nominali EN 10219 o pesi equivalenti.",
  },
  {
    id: "asme-b3619", title: "ASME B36.19M", organization: "ASME",
    role: "dimensional", status: "planned", shapes: ["chs"],
    sourceUrl: "https://www.asme.org/codes-standards/find-codes-standards/b36-19m-stainless-steel-pipe",
    noteEn: "Stainless pipe Schedule *S* dimensional system requires a separately licensed source and material density.",
    noteIt: "Sistema dimensionale Schedule *S* per tubi inox; servono fonte autorizzata e densità del materiale.",
  },
  {
    id: "api5ct", title: "API Spec 5CT", organization: "API",
    role: "product", status: "planned", shapes: ["chs"],
    sourceUrl: "https://www.api.org/products-and-services/standards/standards-plan",
    noteEn: "Oil-country tubular goods (casing and tubing); separate dimensions and product requirements.",
    noteIt: "Tubolari per pozzi (casing e tubing); dimensioni e specifiche di prodotto distinte.",
  },
] as const satisfies readonly SteelStandardsEntry[];

export type CalculatorStandardId = (typeof CALCULATOR_STANDARDS)[number]["id"];

export function standardById(id: string): SteelStandardsEntry | null {
  return CALCULATOR_STANDARDS.find((item) => item.id === id) ?? null;
}

export function standardsByPriority() {
  return CALCULATOR_STANDARDS.filter((item) => item.status !== "planned");
}
