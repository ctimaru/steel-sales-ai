export type ItemRole = "requested" | "offered" | "ordered" | "delivered";

export type CommercialRow = {
  id: string;
  conversationId: string;
  date: string;
  company: string;
  product: string;
  grade: string;
  standard: string;
  role: ItemRole;
  price?: string;
  availability?: "stock" | "production" | "unavailable" | "unknown";
  confidence: number;
};

export const commercialRows: CommercialRow[] = [
  {
    id: "obs-406-offer",
    conversationId: "406x63",
    date: "2026-05-19",
    company: "Bronifer",
    product: "Tondo 406 x 6,3 mm",
    grade: "S235JR",
    standard: "—",
    role: "offered",
    price: "€ 61,50 / m",
    availability: "stock",
    confidence: 0.99,
  },
  {
    id: "obs-406-request",
    conversationId: "406x63",
    date: "2026-05-19",
    company: "Bronifer",
    product: "Tondo 406 x 6,3 x 12000 mm",
    grade: "S235 o superiore",
    standard: "—",
    role: "requested",
    availability: "unknown",
    confidence: 0.99,
  },
  {
    id: "obs-603-request",
    conversationId: "603x3",
    date: "2026-07-08",
    company: "Cliente archivio",
    product: "Tondo 60,3 x 3 mm",
    grade: "S235JR",
    standard: "EN 10219",
    role: "requested",
    availability: "unknown",
    confidence: 0.98,
  },
  {
    id: "obs-603-offer",
    conversationId: "603x3",
    date: "2026-07-08",
    company: "Cliente archivio",
    product: "Tondo 60,3 x 3,6 x 6000 mm",
    grade: "S235JR",
    standard: "EN 10219",
    role: "offered",
    price: "€ 820 / t",
    availability: "stock",
    confidence: 0.99,
  },
  {
    id: "obs-180-order",
    conversationId: "180-square",
    date: "2026-06-08",
    company: "Cliente archivio",
    product: "Quadro 180 x 180 x 6 x 12000 mm",
    grade: "S355J2H",
    standard: "EN 10219",
    role: "ordered",
    availability: "production",
    confidence: 0.97,
  },
  {
    id: "obs-200-delivery",
    conversationId: "200-rect",
    date: "2025-03-10",
    company: "Cliente archivio",
    product: "Rettangolare 200 x 100 x 6,3 x 12000 mm",
    grade: "S355J2H",
    standard: "EN 10210",
    role: "delivered",
    availability: "stock",
    confidence: 0.96,
  },
];

export const archiveMetrics = {
  emails: 504,
  threads: 289,
  messages: 550,
  observations: 1349,
  requested: 642,
  offered: 62,
  ordered: 287,
  delivered: 358,
  reviewFlags: 3,
  avgConfidence: 97.7,
};

export const conversations = {
  "406x63": {
    subject: "TUBO 406X6,3",
    company: "Bronifer",
    status: "Offer",
    events: [
      {
        role: "requested" as const,
        at: "19 mag 2026 · inbound",
        title: "Richiesta cliente",
        product: "Tondo 406 x 6,3 x 12000 mm",
        detail: "S235 o superiore · 2–3 pacchi",
        source: "TUBO 406X6,3 A 12000 S235 O SUPERIORE",
        confidence: 0.99,
      },
      {
        role: "offered" as const,
        at: "19 mag 2026 · outbound",
        title: "Offerta",
        product: "Tondo 406 x 6,3 mm",
        detail: "S235JR · € 61,50 / m · disponibile",
        source: "Ce l'ho disponibile, quanto te ne serve? s235jr €mt 61,50",
        confidence: 0.99,
      },
      {
        role: "requested" as const,
        at: "19 mag 2026 · inbound",
        title: "Follow-up quantità",
        product: "Tondo 406 x 6,3 mm",
        detail: "Richiesto numero verghe per pacco",
        source: "2–3 PACCHI DAMMI IL N. VERGHE PACCO",
        confidence: 0.98,
      },
    ],
  },
  "603x3": {
    subject: "Tubo 60,3",
    company: "Cliente archivio",
    status: "Offer",
    events: [
      {
        role: "requested" as const,
        at: "8 lug 2026 · inbound",
        title: "Richiesta",
        product: "Tondo 60,3 x 3 mm",
        detail: "Lunghezza 6000 o 12000",
        source: "Tubo 60,3x3 a 6000 o 12000",
        confidence: 0.98,
      },
      {
        role: "offered" as const,
        at: "8 lug 2026 · outbound",
        title: "Alternativa disponibile",
        product: "Tondo 60,3 x 3,6 x 6000 mm",
        detail: "S235JR · € 820 / t · stock",
        source: "dispo s235jr 60,3x3,6x6000 ... €ton 820",
        confidence: 0.99,
      },
    ],
  },
} as const;

export const reviewFlags = [
  {
    id: "review-1",
    subject: "RIENTRO 150X150X8 A CALDO",
    product: "Quadro 150 x 150 x 8 mm",
    inferred: "product_inherited_from_subject",
    status: "production",
    source: "Confermo che dovrebbe rientrare verso 8/10 aprile...",
    confidence: 0.88,
  },
  {
    id: "review-2",
    subject: "TUB 220X220X8 A 12 MT. S355J2H",
    product: "Quadro 220 x 220 x 8 mm",
    inferred: "product_inherited_from_subject",
    status: "stock",
    source: "Ho 55 ton a terra di 220x8...",
    confidence: 0.88,
  },
  {
    id: "review-3",
    subject: "TUBO 406X6,3",
    product: "Tondo 406 x 6,3 mm",
    inferred: "product_inherited_from_subject",
    status: "production",
    source: "Per i 406 x 6,3 ... consegna ottobre novembre",
    confidence: 0.88,
  },
];
