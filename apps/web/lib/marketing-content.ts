import type { BusinessPlanLocale } from "@/lib/business-plan-locale";

export const MARKETING_SYSTEM_VERSION = "MKT1 · UXC1";

export const marketingPalette = [
  {
    token: "Brand Deep",
    variable: "--brand-deep",
    hex: "#123B34",
    roleIt: "Logo, hero scure, firma istituzionale",
    roleEn: "Logo, dark hero surfaces, institutional signature",
    contrast: "12.35:1",
  },
  {
    token: "Primary",
    variable: "--brand-primary",
    hex: "#1F6B5A",
    roleIt: "CTA principali, selezione, azioni di brand",
    roleEn: "Primary CTAs, selection, branded actions",
    contrast: "6.35:1",
  },
  {
    token: "Primary Hover",
    variable: "--brand-primary-hover",
    hex: "#185247",
    roleIt: "Hover e pressed state",
    roleEn: "Hover and pressed states",
    contrast: "8.99:1",
  },
  {
    token: "Primary Soft",
    variable: "--brand-primary-soft",
    hex: "#DDF5EC",
    roleIt: "Badge, selezioni leggere, evidenze",
    roleEn: "Badges, soft selection, lightweight emphasis",
    contrast: "—",
  },
  {
    token: "Graphite",
    variable: "--text-primary",
    hex: "#0F1720",
    roleIt: "Titoli, navigazione, testo principale",
    roleEn: "Headings, navigation, primary text",
    contrast: "17.91:1",
  },
  {
    token: "Secondary Text",
    variable: "--text-secondary",
    hex: "#475569",
    roleIt: "Testo secondario e metadati",
    roleEn: "Secondary copy and metadata",
    contrast: "7.58:1",
  },
  {
    token: "Canvas",
    variable: "--surface-canvas",
    hex: "#F6F8F7",
    roleIt: "Sfondo generale dell'applicazione",
    roleEn: "Application canvas",
    contrast: "—",
  },
  {
    token: "Surface",
    variable: "--surface-base",
    hex: "#FFFFFF",
    roleIt: "Card, modali, tabelle",
    roleEn: "Cards, modals and tables",
    contrast: "—",
  },
  {
    token: "Steel Blue",
    variable: "--steel-blue",
    hex: "#315C74",
    roleIt: "Dati, intelligence, informazione",
    roleEn: "Data, intelligence and information",
    contrast: "7.21:1",
  },
  {
    token: "Warning",
    variable: "--semantic-warning",
    hex: "#A15C00",
    roleIt: "Warning e scadenze",
    roleEn: "Warnings and deadlines",
    contrast: "5.19:1",
  },
  {
    token: "Error",
    variable: "--semantic-error",
    hex: "#B42318",
    roleIt: "Errori e azioni distruttive",
    roleEn: "Errors and destructive actions",
    contrast: "7.44:1",
  },
] as const;

const copy = {
  it: {
    eyebrow: "Marketing & Brand System",
    title: "Il verde è la firma. L’acciaio è il carattere.",
    subtitle:
      "Smart Steel Sales deve apparire come una piattaforma tecnologica B2B europea, seria e moderna, costruita specificamente per chi compra e vende acciaio.",
    thesis:
      "Non un sito verde: un prodotto graphite/steel in cui il verde compare nei punti che contano e diventa immediatamente riconoscibile.",
    architectureTitle: "Architettura cromatica",
    architectureIntro:
      "Ogni famiglia cromatica ha un lavoro preciso. Il colore non viene usato per riempire spazio, ma per creare gerarchia e significato.",
    roles: [
      ["Verde", "Brand e azione", "Identità, CTA primarie e selezione. Profondo e freddo: tecnologia industriale, non eco-branding."],
      ["Graphite", "Industria e affidabilità", "È la matrice visiva di titoli, navigazione e contenuti ad alta priorità."],
      ["Steel Blue", "Dati e intelligence", "Distingue insight, analytics e informazione senza competere con il brand primary."],
      ["Neutri freddi", "Struttura e respiro", "Canvas, superfici e bordi costruiscono la maggior parte dell’interfaccia."],
    ],
    densityTitle: "Il colore deve guadagnarsi l’attenzione",
    density: [
      ["70–80%", "Neutri / bianco / graphite", "Base dell’interfaccia"],
      ["15–20%", "Brand green", "Firma, CTA e selezione"],
      ["5–10%", "Semantica + data", "Stati, warning, errori e intelligence"],
    ],
    accessibilityTitle: "Accessibilità come requisito di prodotto",
    accessibility: [
      "Testo normale: contrasto minimo 4.5:1.",
      "Controlli, focus e componenti UI significativi: almeno 3:1 dove previsto da WCAG 2.2.",
      "Mai comunicare uno stato soltanto attraverso il colore.",
      "Status critici sempre con label + icona + colore.",
      "Focus da tastiera visibile e distinto dal brand primary.",
      "Hover, pressed, disabled e selected sono definiti a livello di token, non pagina per pagina.",
    ],
    messagingTitle: "Posizionamento e linguaggio",
    messaging:
      "La comunicazione parte dal lavoro commerciale reale: controllo, velocità, memoria, procurement, network e intelligence. L’AI è un abilitatore del valore, non il messaggio principale.",
    doTitle: "Da enfatizzare",
    doItems: [
      "Tecnologia commerciale verticale per steel e tube.",
      "Competenza industriale, controllo e affidabilità.",
      "Continuità tra memoria privata, network e workflow RFQ.",
      "Evidenze, metriche e claim verificabili.",
      "Design sobrio, denso di informazione e orientato all’azione.",
    ],
    dontTitle: "Da evitare",
    dontItems: [
      "Greenwashing o associazione automatica a “green steel”.",
      "Gradienti fluorescenti e linguaggio da startup AI generica.",
      "Blu SaaS come identità primaria.",
      "Card colorate senza significato operativo.",
      "Claim non dimostrabili o roadmap interna esposta come marketing.",
    ],
    investorTitle: "Perché conta anche per gli investor",
    investorBody:
      "Il sistema di brand deve rendere immediatamente leggibile la stessa tesi del prodotto: verticalità, rigore, controllo dei dati e capacità di diventare infrastruttura commerciale per una filiera industriale.",
  },
  en: {
    eyebrow: "Marketing & Brand System",
    title: "Green is the signature. Steel is the character.",
    subtitle:
      "Smart Steel Sales should feel like a serious, modern European B2B technology platform built specifically for companies buying and selling steel.",
    thesis:
      "Not a green website: a graphite-and-steel product where green appears at high-value moments and becomes immediately recognizable.",
    architectureTitle: "Color architecture",
    architectureIntro:
      "Every color family has one job. Color does not fill space; it creates hierarchy and meaning.",
    roles: [
      ["Green", "Brand and action", "Identity, primary CTAs and selection. Deep and cool: industrial technology, not eco-branding."],
      ["Graphite", "Industry and trust", "The visual matrix for headings, navigation and high-priority content."],
      ["Steel Blue", "Data and intelligence", "Separates insights, analytics and information without competing with the primary brand."],
      ["Cool neutrals", "Structure and space", "Canvas, surfaces and borders build most of the interface."],
    ],
    densityTitle: "Color must earn attention",
    density: [
      ["70–80%", "Neutrals / white / graphite", "Interface foundation"],
      ["15–20%", "Brand green", "Signature, CTAs and selection"],
      ["5–10%", "Semantic + data", "States, warnings, errors and intelligence"],
    ],
    accessibilityTitle: "Accessibility is a product requirement",
    accessibility: [
      "Normal text: minimum 4.5:1 contrast.",
      "Controls, focus and meaningful UI components: at least 3:1 where required by WCAG 2.2.",
      "Never communicate state through color alone.",
      "Critical statuses always combine label + icon + color.",
      "Keyboard focus remains visible and distinct from the primary brand color.",
      "Hover, pressed, disabled and selected states are defined by tokens, not page by page.",
    ],
    messagingTitle: "Positioning and language",
    messaging:
      "Communication starts from real commercial work: control, speed, memory, procurement, network and intelligence. AI enables the value; it is not the primary message.",
    doTitle: "Emphasize",
    doItems: [
      "Vertical commercial technology for steel and tube.",
      "Industrial expertise, control and reliability.",
      "Continuity across private memory, network and RFQ workflows.",
      "Evidence, metrics and verifiable claims.",
      "Calm, information-dense, action-oriented design.",
    ],
    dontTitle: "Avoid",
    dontItems: [
      "Greenwashing or automatic “green steel” positioning.",
      "Fluorescent gradients and generic AI-startup language.",
      "Generic SaaS blue as the primary identity.",
      "Colored cards without operational meaning.",
      "Unverifiable claims or internal roadmap language used as marketing.",
    ],
    investorTitle: "Why this matters to investors",
    investorBody:
      "The brand system should make the product thesis instantly legible: vertical expertise, rigor, data control and the ambition to become commercial infrastructure for an industrial value chain.",
  },
} as const;

export function getMarketingCopy(locale: BusinessPlanLocale) {
  return copy[locale];
}
