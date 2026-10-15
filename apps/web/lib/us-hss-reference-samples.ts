/**
 * CALC-INT3D.2 — a SMALL, manually checked set of manufacturer-published
 * A500 HSS dimensions and *nominal* reference weights.
 *
 * These are individual manufacturing facts, not a licensed AISC shape
 * database, an ASTM dimensional table, a supplier stock statement, nor a
 * certificate. The independent AISC calculation uses t_design=0.93*t_nom;
 * it MUST NEVER be replaced by a nominal reference weight.
 *
 * Atlas Tube ASTM A500 HSS Section Properties PDF tables; PDF page is
 * 1-based and each item also has an exact row designation.
 */
export type HssReferenceShape = "round" | "square" | "rectangular";
export type HssReference = {
  id: string;
  shape: HssReferenceShape;
  designation: string;
  diameterIn?: number;
  widthIn?: number;
  heightIn?: number;
  nominalWallIn: number;
  manufacturerNominalLbFt: number;
  sourcePage: number;
  sourceRow: string;
};
export const HSS_ATLAS_SOURCE = {
  publisher: "Atlas Tube",
  kind: "manufacturer-nominal-reference-not-certified",
  round: "https://www.atlastube.com/wp-content/uploads/2018/04/A500-Round-Current.pdf",
  square: "https://www.atlastube.com/wp-content/uploads/2018/04/Atlas-HSS-Section-Properties-A500-Squares.pdf",
  rectangular: "https://www.atlastube.com/wp-content/uploads/2018/04/A500-Rectangle-Current.pdf",
} as const;

const entries: readonly HssReference[] = [
  // Round: Atlas A500 Round (Current), selected rows on PDF pages 3–5.
  {id:"r-6-250",shape:"round",designation:"HSS 6.000 × 0.250",diameterIn:6,
    nominalWallIn:0.25,manufacturerNominalLbFt:15.37,sourcePage:5,sourceRow:"HSS 6.000 x 0.250"},
  {id:"r-6625-250",shape:"round",designation:"HSS 6.625 × 0.250",diameterIn:6.625,
    nominalWallIn:0.25,manufacturerNominalLbFt:17.04,sourcePage:5,sourceRow:"HSS 6.625 x 0.250"},
  {id:"r-6625-375",shape:"round",designation:"HSS 6.625 × 0.375",diameterIn:6.625,
    nominalWallIn:0.375,manufacturerNominalLbFt:25.06,sourcePage:5,sourceRow:"HSS 6.625 x 0.375"},
  {id:"r-8625-375",shape:"round",designation:"HSS 8.625 × 0.375",diameterIn:8.625,
    nominalWallIn:0.375,manufacturerNominalLbFt:33.07,sourcePage:4,sourceRow:"HSS 8.625 x 0.375"},
  {id:"r-10-250",shape:"round",designation:"HSS 10.000 × 0.250",diameterIn:10,
    nominalWallIn:0.25,manufacturerNominalLbFt:26.06,sourcePage:3,sourceRow:"HSS 10.000 x 0.250"},

  // CALC-INT3D.3: additional round rows, Atlas Current, PDF page 3.
  {id:"r-12-625",shape:"round",designation:"HSS 12.000 × 0.625",diameterIn:12,
    nominalWallIn:0.625,manufacturerNominalLbFt:76.00,sourcePage:3,sourceRow:"HSS 12.000 x 0.625"},
  {id:"r-12-500",shape:"round",designation:"HSS 12.000 × 0.500",diameterIn:12,
    nominalWallIn:0.5,manufacturerNominalLbFt:61.47,sourcePage:3,sourceRow:"HSS 12.000 x 0.500"},
  {id:"r-1175-250",shape:"round",designation:"HSS 11.750 × 0.250",diameterIn:11.75,
    nominalWallIn:0.25,manufacturerNominalLbFt:30.73,sourcePage:3,sourceRow:"HSS 11.750 x 0.250"},
  {id:"r-1075-375",shape:"round",designation:"HSS 10.750 × 0.375",diameterIn:10.75,
    nominalWallIn:0.375,manufacturerNominalLbFt:41.59,sourcePage:3,sourceRow:"HSS 10.750 x 0.375"},
  {id:"r-9625-250",shape:"round",designation:"HSS 9.625 × 0.250",diameterIn:9.625,
    nominalWallIn:0.25,manufacturerNominalLbFt:25.06,sourcePage:3,sourceRow:"HSS 9.625 x 0.250"},

  // Square: Atlas A500 Squares, selected rows on PDF pages 2–3.
  {id:"s-4-250",shape:"square",designation:"HSS 4 × 4 × 1/4",widthIn:4,
    nominalWallIn:0.25,manufacturerNominalLbFt:12.21,sourcePage:3,sourceRow:"HSS 4 x 4 x 1/4"},
  {id:"s-4-375",shape:"square",designation:"HSS 4 × 4 × 3/8",widthIn:4,
    nominalWallIn:0.375,manufacturerNominalLbFt:17.27,sourcePage:3,sourceRow:"HSS 4 x 4 x 3/8"},
  {id:"s-6-250",shape:"square",designation:"HSS 6 × 6 × 1/4",widthIn:6,
    nominalWallIn:0.25,manufacturerNominalLbFt:19.02,sourcePage:2,sourceRow:"HSS 6 x 6 x 1/4"},
  {id:"s-6-375",shape:"square",designation:"HSS 6 × 6 × 3/8",widthIn:6,
    nominalWallIn:0.375,manufacturerNominalLbFt:27.48,sourcePage:2,sourceRow:"HSS 6 x 6 x 3/8"},
  {id:"s-8-250",shape:"square",designation:"HSS 8 × 8 × 1/4",widthIn:8,
    nominalWallIn:0.25,manufacturerNominalLbFt:25.82,sourcePage:2,sourceRow:"HSS 8 x 8 x 1/4"},

  // CALC-INT3D.3: additional square rows, Atlas Squares, PDF page 2.
  {id:"s-8-375",shape:"square",designation:"HSS 8 × 8 × 3/8",widthIn:8,
    nominalWallIn:0.375,manufacturerNominalLbFt:37.69,sourcePage:2,sourceRow:"HSS 8 x 8 x 3/8"},
  {id:"s-7-250",shape:"square",designation:"HSS 7 × 7 × 1/4",widthIn:7,
    nominalWallIn:0.25,manufacturerNominalLbFt:22.42,sourcePage:2,sourceRow:"HSS 7 x 7 x 1/4"},
  {id:"s-6-313",shape:"square",designation:"HSS 6 × 6 × 5/16",widthIn:6,
    nominalWallIn:0.313,manufacturerNominalLbFt:23.34,sourcePage:2,sourceRow:"HSS 6 x 6 x 5/16"},
  {id:"s-5-250",shape:"square",designation:"HSS 5 × 5 × 1/4",widthIn:5,
    nominalWallIn:0.25,manufacturerNominalLbFt:15.62,sourcePage:2,sourceRow:"HSS 5 x 5 x 1/4"},
  {id:"s-45-375",shape:"square",designation:"HSS 4.5 × 4.5 × 3/8",widthIn:4.5,
    nominalWallIn:0.375,manufacturerNominalLbFt:19.82,sourcePage:2,sourceRow:"HSS 4.5 x 4.5 x 3/8"},

  // Rectangles: Atlas A500 Rectangle (Current), selected PDF pages 3, 5–6.
  {id:"x-6-4-250",shape:"rectangular",designation:"HSS 6 × 4 × 1/4",
    widthIn:6,heightIn:4,nominalWallIn:0.25,manufacturerNominalLbFt:15.62,
    sourcePage:6,sourceRow:"HSS 6 x 4 x 1/4"},
  {id:"x-6-4-375",shape:"rectangular",designation:"HSS 6 × 4 × 3/8",
    widthIn:6,heightIn:4,nominalWallIn:0.375,manufacturerNominalLbFt:22.37,
    sourcePage:6,sourceRow:"HSS 6 x 4 x 3/8"},
  {id:"x-8-4-250",shape:"rectangular",designation:"HSS 8 × 4 × 1/4",
    widthIn:8,heightIn:4,nominalWallIn:0.25,manufacturerNominalLbFt:19.02,
    sourcePage:5,sourceRow:"HSS 8 x 4 x 1/4"},
  {id:"x-10-6-250",shape:"rectangular",designation:"HSS 10 × 6 × 1/4",
    widthIn:10,heightIn:6,nominalWallIn:0.25,manufacturerNominalLbFt:25.82,
    sourcePage:3,sourceRow:"HSS 10 x 6 x 1/4"},
  {id:"x-12-8-375",shape:"rectangular",designation:"HSS 12 × 8 × 3/8",
    widthIn:12,heightIn:8,nominalWallIn:0.375,manufacturerNominalLbFt:47.90,
    sourcePage:3,sourceRow:"HSS 12 x 8 x 3/8"},
  // CALC-INT3D.3: additional rectangles, Atlas Current, PDF page 3.
  {id:"x-12-10-375",shape:"rectangular",designation:"HSS 12 × 10 × 3/8",
    widthIn:12,heightIn:10,nominalWallIn:0.375,manufacturerNominalLbFt:53.00,
    sourcePage:3,sourceRow:"HSS 12 x 10 x 3/8"},
  {id:"x-12-8-250",shape:"rectangular",designation:"HSS 12 × 8 × 1/4",
    widthIn:12,heightIn:8,nominalWallIn:0.25,manufacturerNominalLbFt:32.63,
    sourcePage:3,sourceRow:"HSS 12 x 8 x 1/4"},
  {id:"x-12-6-375",shape:"rectangular",designation:"HSS 12 × 6 × 3/8",
    widthIn:12,heightIn:6,nominalWallIn:0.375,manufacturerNominalLbFt:42.79,
    sourcePage:3,sourceRow:"HSS 12 x 6 x 3/8"},
  {id:"x-12-4-250",shape:"rectangular",designation:"HSS 12 × 4 × 1/4",
    widthIn:12,heightIn:4,nominalWallIn:0.25,manufacturerNominalLbFt:25.82,
    sourcePage:3,sourceRow:"HSS 12 x 4 x 1/4"},
  {id:"x-10-8-375",shape:"rectangular",designation:"HSS 10 × 8 × 3/8",
    widthIn:10,heightIn:8,nominalWallIn:0.375,manufacturerNominalLbFt:42.79,
    sourcePage:3,sourceRow:"HSS 10 x 8 x 3/8"},
];
export const HSS_REFERENCE_SAMPLES = entries;
export const HSS_NOMINAL_LBFT_TO_KGM = 1.48816394357;
export const hssReferenceRowsForShape = (shape:HssReferenceShape) =>
  HSS_REFERENCE_SAMPLES.filter(row => row.shape === shape);
export const findHssReference = (id:string) =>
  HSS_REFERENCE_SAMPLES.find(row => row.id === id) ?? null;
export const hssReferenceDimensionsMm = (row:HssReference) => ({
  shape:row.shape,
  outerDiameterMm:row.diameterIn===undefined ? null : Number((row.diameterIn*25.4).toFixed(4)),
  widthMm:row.widthIn===undefined ? null : Number((row.widthIn*25.4).toFixed(4)),
  heightMm:row.heightIn===undefined ? null : Number((row.heightIn*25.4).toFixed(4)),
  thicknessMm:Number((row.nominalWallIn*25.4).toFixed(4)),
});
export const hssNominalPublishedKgM = (row:HssReference) =>
  row.manufacturerNominalLbFt * HSS_NOMINAL_LBFT_TO_KGM;
export const hssAtlasSourceUrl = (shape:HssReferenceShape) => HSS_ATLAS_SOURCE[shape];


/**
 * Search only our curated Atlas facts, never generate missing HSS combinations.
 * Dimensions use inch designations; both 6x4 and "6 × 4" work. Decimal wall
 * fractions are searched via their nominal inch values without inference.
 */
export function searchHssReferences(input:{
  shape:HssReferenceShape;
  query?:string;
  nominalWallIn?:number|null;
}):HssReference[] {
  const raw=(input.query??"").trim().toLowerCase()
    .replace(/,/g,".").replace(/[×✕*]/g,"x")
    .replace(/\s*x\s*/g,"x").replace(/\s+/g," ");
  const tokens=raw.split(/\s+/).filter(Boolean);
  const candidates=HSS_REFERENCE_SAMPLES.filter(row=>
    row.shape===input.shape &&
    (input.nominalWallIn==null || Math.abs(row.nominalWallIn-input.nominalWallIn)<0.00001)
  );
  if(!tokens.length)return candidates;
  return candidates.filter(row=>{
    const dimensions=row.shape==="round"
      ? String(row.diameterIn)
      : row.shape==="square"
        ? `${row.widthIn}x${row.widthIn}`
        : `${row.widthIn}x${row.heightIn}`;
    const fractionLabels:Record<string,string>={
      "0.125":"1/8","0.188":"3/16","0.25":"1/4",
      "0.313":"5/16","0.375":"3/8","0.5":"1/2",
      "0.625":"5/8","0.75":"3/4","0.875":"7/8",
    };
    const wall=fractionLabels[String(row.nominalWallIn)]??String(row.nominalWallIn);
    const searchable=[row.designation,row.sourceRow,dimensions,
      String(row.nominalWallIn),wall,
      `${dimensions}x${wall}`,row.id]
      .join(" ").toLowerCase().replace(/[×✕*]/g,"x")
      .replace(/\s*x\s*/g,"x").replace(/\s+/g," ");
    return tokens.every(token=>searchable.includes(token));
  });
}
export function hssAvailableWalls(shape:HssReferenceShape):number[]{
  return [...new Set(hssReferenceRowsForShape(shape).map(row=>row.nominalWallIn))].sort((a,b)=>a-b);
}
