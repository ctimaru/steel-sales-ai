/** SCHOOL-UNIFY4B — evidence disclosure, glossary and editorial audit semantics.
 * Source record date comes from governed K2 (not a date when localized copy was reviewed).
 * Neither draft copy nor third-party publisher scope pages establish product conformity.
 */
import type {KnowledgeMarketLocale} from "@/lib/localized-steel-knowledge";

type Scope="standards"|"grades";
export const TECHNICAL_EDITORIAL_COPY={
 de:{
  trustTitle:"Quellen und redaktionelle Einordnung",publisher:"Normenherausgeber / öffentliches Normenprofil",
  catalog:"Öffentlich freigegebener K2-Katalogeintrag",
  sourceReviewed:"Quelldatensatz zuletzt geprüft",prepared:"Redaktionelle Fassung erstellt",
  independence:"Diese Kurzfassung wurde von Smart Steel Sales verfasst. Die öffentliche Herausgeberbeschreibung erklärt den Normumfang, ist kein Ersatz für den geltenden Normtext, kein Materialprüfzeugnis und keine Produktfreigabe.",
  editions:"Ausgabe, nationale Übernahme, Werkstoff, Lieferzustand und aktuelle Anforderungen beim Herausgeber bzw. Lieferanten prüfen.",
  glossaryTitle:"Wichtige Fachbegriffe",glossaryHint:"Kurze Orientierung für die Anfrage; keine technischen Grenzwerte.",
  evidenceNote:"Katalogfreigabe bedeutet Verfügbarkeit einer geprüften Referenz, nicht die Zertifizierung des Materials.",
 },
 fr:{
  trustTitle:"Sources et contexte éditorial",publisher:"Éditeur de la norme / fiche publique de portée",
  catalog:"Référence publique approuvée dans K2",
  sourceReviewed:"Dernière révision de la fiche source",prepared:"Rédaction de cette synthèse",
  independence:"Cette synthèse originale est rédigée par Smart Steel Sales. La fiche de l'éditeur décrit le champ de la norme, sans remplacer son texte officiel, un certificat matière ou une homologation.",
  editions:"Vérifiez l'édition, l'adoption nationale, la nuance, l'état de livraison et les prescriptions actuelles auprès de l'éditeur ou du fournisseur.",
  glossaryTitle:"Petit glossaire technique",glossaryHint:"Repères pour votre demande, sans valeurs de dimensionnement.",
  evidenceNote:"La publication de la référence K2 ne constitue pas une certification du produit.",
 },
 es:{
  trustTitle:"Fuentes y contexto editorial",publisher:"Editor de la norma / ficha pública de alcance",
  catalog:"Referencia pública publicada en K2",
  sourceReviewed:"Última revisión de la ficha fuente",prepared:"Síntesis editorial elaborada",
  independence:"Este resumen original ha sido redactado por Smart Steel Sales. La ficha del editor describe el alcance, pero no sustituye al texto normativo vigente, a un certificado de material ni a una aprobación de producto.",
  editions:"Confirma la edición, adopción nacional, calidad, estado de suministro y requisitos vigentes con el editor o proveedor.",
  glossaryTitle:"Glosario técnico",glossaryHint:"Orientación para consultas, no valores de cálculo de diseño.",
  evidenceNote:"Que una referencia esté publicada en K2 no certifica un producto.",
 },
} as const;
export const TECHNICAL_GLOSSARY={
 de:[
  {term:"CHS / SHS / RHS",meaning:"Rund-, quadratische und rechteckige Hohlprofile: dieselbe Formangabe ersetzt weder Norm noch Stahlgüte."},
  {term:"Nahtlos / geschweißt",meaning:"Herstellverfahren mit unterschiedlichen Produktnormen und Prüfanforderungen; nicht ohne Freigabe austauschen."},
  {term:"TR1 / TR2",meaning:"Unterschiedliche Qualitätsstufen innerhalb einschlägiger Druckrohrnormen; den Suffix vollständig angeben."},
  {term:"N / L / H",meaning:"Bestandteile einer vollständigen Baustahlbezeichnung; die gültige Norm legt Liefer- und Zähigkeitsanforderungen fest."},
  {term:"Prüfbescheinigung",meaning:"Dokumenttyp und erforderliche Prüfung vor Auftrag klären, zum Beispiel die passende Bescheinigung nach EN 10204."},
 ],
 fr:[
  {term:"CHS / SHS / RHS",meaning:"Sections creuses circulaires, carrées et rectangulaires. La géométrie ne précise pas la norme ni la nuance."},
  {term:"Sans soudure / soudé",meaning:"Deux procédés couverts par des normes produits distinctes; la substitution requiert une validation."},
  {term:"TR1 / TR2",meaning:"Variantes de qualité distinctes des normes pertinentes pour tubes de pression; conservez le suffixe complet."},
  {term:"N / L / H",meaning:"Suffixes participant à la désignation de nuance structurale; la norme fixe les exigences applicables."},
  {term:"Document de contrôle",meaning:"Définissez les essais et attestations nécessaires avant commande, avec référence EN 10204 si applicable."},
 ],
 es:[
  {term:"CHS / SHS / RHS",meaning:"Secciones huecas circulares, cuadradas y rectangulares. La geometría no define la norma ni la calidad."},
  {term:"Sin soldadura / soldado",meaning:"Procesos con normas de producto y requisitos de ensayo distintos; evita sustituciones sin aprobación."},
  {term:"TR1 / TR2",meaning:"Variantes de calidad diferentes para tubos de presión; conserva el sufijo completo en la solicitud."},
  {term:"N / L / H",meaning:"Sufijos que forman parte de la designación estructural; consulta la norma para sus exigencias."},
  {term:"Documento de inspección",meaning:"Indica pruebas y certificados requeridos antes del pedido, cuando corresponda según EN 10204."},
 ],
} as const;

/** Editorial discovery links, not statements of material equivalence. */
export const TECHNICAL_RELATED_SLUGS:Readonly<Record<Scope,Readonly<Record<string,readonly string[]>>>>={
 standards:{
  "en-10210":["s355j2h","s355nh","s355nlh"],
  "en-10219":["s355j2h"],
  "en-10216-2":["p235gh","p265gh","16mo3"],
  "en-10217-1":["p235tr1","p235tr2","p265tr1","p265tr2"],
  "en-10217-2":["p235gh","p265gh"],
  "en-10224":[],
 },
 grades:{
  "s355j2h":["en-10210","en-10219"],
  "s355nh":["en-10210"],
  "s355nlh":["en-10210"],
  "p235gh":["en-10216-2","en-10217-2"],
  "p265gh":["en-10216-2","en-10217-2"],
  "16mo3":["en-10216-2"],
  "p235tr1":["en-10217-1"],
  "p235tr2":["en-10217-1"],
  "p265tr1":["en-10217-1"],
  "p265tr2":["en-10217-1"],
 }
};
export const SCHOOL_EDITORIAL_DRAFT_DATE="2026-10-19";
export function technicalEditorialCopy(locale:KnowledgeMarketLocale){return TECHNICAL_EDITORIAL_COPY[locale];}
