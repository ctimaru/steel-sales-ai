import type { PublicTubeDimensionSummary } from "@/lib/public-knowledge";
import type { BuyerDistintaCatalogOption } from "@/lib/buyer-distinta-catalog";

export type CalculatorDimension = {
  id: string;
  family: "round_tube" | "square_tube" | "rectangular_tube";
  primaryMm: number;
  secondaryMm: number;
  thicknessMm: number;
  source: string;
};

export type DimensionFamilyFilter = CalculatorDimension["family"] | "all";

export function validCalculatorDimension(item: CalculatorDimension): boolean {
  return ["round_tube","square_tube","rectangular_tube"].includes(item.family)
    && [item.primaryMm,item.secondaryMm,item.thicknessMm].every(v=>Number.isFinite(v) && v>0)
    && item.thicknessMm*2 < Math.min(item.primaryMm,item.secondaryMm);
}

/** Only actual published Public Knowledge records become public suggestions. */
export function dimensionsFromPublicReferences(references: PublicTubeDimensionSummary[]): CalculatorDimension[] {
  return references.flatMap(ref=>{
    const family=ref.product_family;
    const a=family==="round_tube" ? ref.outer_diameter_mm : ref.width_mm;
    const b=family==="rectangular_tube" ? ref.height_mm : a;
    if(a==null||b==null)return[];
    const candidate:CalculatorDimension={
      id:ref.dimension_slug, family, primaryMm:a, secondaryMm:b,
      thicknessMm:ref.thickness_mm, source:ref.source_name?.trim()||ref.source_provider?.trim()||"Public Knowledge",
    };
    return candidate.id && validCalculatorDimension(candidate) ? [candidate] : [];
  });
}

/** Private catalog candidates are already a projection of published Knowledge dimensions. */
export function dimensionsFromBuyerCatalog(options: BuyerDistintaCatalogOption[]):CalculatorDimension[] {
  return options.flatMap(option=>{
    const parts=option.sizeKey.split(":");
    const a=Number(parts[1]), b=Number(parts[2]);
    const candidate:CalculatorDimension={
      id:option.id, family:option.family, primaryMm:a, secondaryMm:b,
      thicknessMm:option.thicknessMm, source:option.sourceName?.trim()||"Public Knowledge",
    };
    return candidate.id && validCalculatorDimension(candidate) ? [candidate] : [];
  });
}

export function dimensionNumber(value:number):string {
  return String(value).replace(".",",");
}

export function dimensionLabel(item:CalculatorDimension):string {
  const a=dimensionNumber(item.primaryMm), b=dimensionNumber(item.secondaryMm);
  return item.family==="round_tube"
    ? `Ø ${a} × ${dimensionNumber(item.thicknessMm)} mm`
    : `${a} × ${b} × ${dimensionNumber(item.thicknessMm)} mm`;
}

/** Decimal comma/dot and ×/x, accent and word-order tolerant. No inferred catalogue entries. */
export function normalizeDimensionSearch(value:string):string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/(\d),(\d)/g,"$1.$2")
    .replace(/[×*]/g,"x").replace(/\s*x\s*/g,"x")
    .replace(/[øØ⌀]/g,"").replace(/[^a-z0-9.x]+/g," ").trim();
}

export function searchCalculatorDimensions(
  items:CalculatorDimension[], query:string,
  family:DimensionFamilyFilter="all", thickness:"all"|number="all", limit=8,
):{results:CalculatorDimension[];matchCount:number;thicknesses:number[]} {
  const unique=new Map<string,CalculatorDimension>();
  for(const item of items) {
    if(!validCalculatorDimension(item))continue;
    const key=[item.family,item.primaryMm,item.secondaryMm,item.thicknessMm].join(":");
    if(!unique.has(key))unique.set(key,item);
  }
  const all=[...unique.values()];
  const thicknesses=[...new Set(all.filter(x=>family==="all"||x.family===family)
    .map(x=>x.thicknessMm))].sort((a,b)=>a-b);
  const words=normalizeDimensionSearch(query).split(/\s+/).filter(Boolean);
  const filtered=all.filter(item=>{
    if(family!=="all" && family!==item.family)return false;
    if(thickness!=="all" && thickness!==item.thicknessMm)return false;
    const dims=item.family==="round_tube"
      ? [item.primaryMm,item.thicknessMm]
      : [item.primaryMm,item.secondaryMm,item.thicknessMm];
    const token=dims.map(n=>String(n)).join("x");
    const aliases=item.family==="round_tube" ? "round tube tubo tondo chs"
      : item.family==="square_tube" ? "square tube quadro shs"
      : "rectangular tube rettangolare rhs";
    const haystack=normalizeDimensionSearch(
      [aliases,dimensionLabel(item),token, ...dims.map(String),item.source].join(" "));
    return words.every(word=>haystack.includes(word));
  }).sort((a,b)=>a.family.localeCompare(b.family)||
    a.primaryMm-b.primaryMm||a.secondaryMm-b.secondaryMm||a.thicknessMm-b.thicknessMm);
  const max=Math.max(1,Math.min(24,Number.isFinite(limit)?Math.floor(limit):8));
  return {results:filtered.slice(0,max),matchCount:filtered.length,thicknesses};
}
