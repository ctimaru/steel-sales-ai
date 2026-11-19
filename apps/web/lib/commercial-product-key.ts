// COMM-RDO2 — readable product names for the Richieste d'offerta list.
//
// Lines of requests, offers and orders carry a structured canonical key, e.g.
//   tube:v1|family=square_tube|grade=s355j2h|standard=en10219|material=_|geom=80x80|t=10|process=_
// This module turns it into «Tubo quadro 80×80×10» and «EN 10219 S355J2H».
// Pure and structured-only: no free text from emails, no prices.

const families: Record<string, string> = {
  round_tube: "Tubo tondo",
  square_tube: "Tubo quadro",
  rectangular_tube: "Tubo rettangolare",
  oval_tube: "Tubo ovale",
  flat_oval_tube: "Tubo ovale piatto",
};

const decimal = (raw: string) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(n) : "";
};
const present = (value: string | undefined) => value && value !== "_" ? value : "";

export type ProductFromKey = { name: string; spec: string };

/** null for anything that is not a known v1 tube key: the caller falls back to other data. */
export function productFromKey(key: unknown): ProductFromKey | null {
  if (typeof key !== "string" || !key.startsWith("tube:v1|") || key.length > 300) return null;
  const parts = new Map<string, string>();
  for (const part of key.split("|").slice(1)) {
    const at = part.indexOf("=");
    if (at > 0) parts.set(part.slice(0, at), part.slice(at + 1));
  }
  const family = families[present(parts.get("family"))] ?? "Tubo";
  const geom = present(parts.get("geom"));
  const thickness = decimal(present(parts.get("t")));
  let size = "";
  if (geom.startsWith("od:")) {
    const od = decimal(geom.slice(3));
    size = od ? "Ø" + od + (thickness ? "×" + thickness : "") : "";
  } else if (/^\d+(\.\d+)?x\d+(\.\d+)?$/.test(geom)) {
    size = geom.split("x").map(decimal).join("×") + (thickness ? "×" + thickness : "");
  }
  const standard = present(parts.get("standard")).toUpperCase().replace(/^([A-Z]+)(\d)/, "$1 $2");
  const grade = present(parts.get("grade")).toUpperCase();
  return { name: size ? family + " " + size : family, spec: [standard, grade].filter(Boolean).join(" ") };
}

/** «Tubo quadro 80×80×10», «… e altri 2» when the lines name more products. */
export function productSummary(lines: ReadonlyArray<Record<string, unknown>>): ProductFromKey | null {
  const products = lines.map((line) => productFromKey(line.canonical_product_key)).filter((p): p is ProductFromKey => Boolean(p));
  if (!products.length) return null;
  const names = [...new Set(products.map((p) => p.name))];
  const specs = [...new Set(products.map((p) => p.spec).filter(Boolean))];
  const others = names.length - 1;
  return {
    name: names[0] + (others > 0 ? (others === 1 ? " e un altro" : " e altri " + others) : ""),
    spec: specs.length ? specs[0] + (specs.length > 1 ? " +" + (specs.length - 1) : "") : "",
  };
}
