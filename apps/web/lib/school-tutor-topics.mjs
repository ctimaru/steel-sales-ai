/**
 * SCHOOL-AI1 public editorial routing: a small, curated map to published articles.
 * It never generates answers or infers technical/commercial applicability.
 */
const topics = [
  {
    id: "production",
    pattern: /(?:saldat|saldatur|welded|seamless|senza saldatura|produc|fabbric|hfi|erw|saw|trafilat)/i,
    title: "Come si producono i tubi d’acciaio",
    description: "Processi saldati, senza saldatura e le differenze di lavorazione: consulta la guida con fonti.",
    href: "/knowledge/articoli/come-si-producono-tubi-acciaio",
  },
  {
    id: "history",
    pattern: /(?:stori|nascit|nati|origine|mannesmann|antic[hoie]|inventat)/i,
    title: "La storia dei tubi d’acciaio",
    description: "Dalle prime condotte allo sviluppo industriale: una lettura documentata della School.",
    href: "/knowledge/articoli/storia-tubi-acciaio",
  },
  {
    id: "producers",
    pattern: /(?:produttor|producono in europa|acciaierie europee|fabricant|manufacturer)/i,
    title: "Chi produce tubi in Europa",
    description: "Panoramica editoriale non esaustiva, con fonti pubbliche e data di revisione.",
    href: "/knowledge/articoli/produttori-tubi-europa",
  },
];

/** Recognize topics only, never transform a question into fabricated facts. */
export function matchSchoolTutorTopic(question) {
  if (typeof question !== "string") return null;
  const text = question.trim().slice(0, 500);
  if (text.length < 4) return null;
  const match = topics.find(topic => topic.pattern.test(text));
  return match ? { id: match.id, title: match.title, description: match.description, href: match.href } : null;
}
