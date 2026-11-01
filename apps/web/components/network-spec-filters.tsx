import Link from "next/link";
import type {CompactNetworkFilters} from "@/lib/network-compact-directory";
import type {SpecMatch} from "@/lib/network-spec-search";
import {
  NETWORK_SPEC_PARAMS,NETWORK_SPEC_SHAPES,NETWORK_SPEC_STANDARD_SUGGESTIONS,specProvenanceLabel,
} from "@/lib/network-spec-filters";

/** NET-AUDIT1.1 — technical spec panel. A plain GET form: the URL stays the
 * single contract shared by Free/Pro, the chat and pagination. Free users see
 * the fields disabled with an explicit Pro notice; no scope data is fetched.
 */
const inputStyle="h-10 w-full min-w-0 rounded-lg border border-[#b7cfc2] bg-white px-2.5 text-xs font-semibold text-[#173f35] placeholder:font-normal placeholder:text-[#647269] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:cursor-not-allowed disabled:border-[#d7e3dc] disabled:bg-[#eef2ef] disabled:text-[#53635b]";
const PRESERVED=["q","role","region","country","persona"] as const;

function withoutSpec(filters:CompactNetworkFilters){
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(filters)){
    if(value&&key!=="np"&&!(NETWORK_SPEC_PARAMS as readonly string[]).includes(key))query.set(key,value);
  }
  const search=query.toString();
  return "/network"+(search?"?"+search:"")+"#network-results";
}

export function NetworkSpecPanel({filters,accessMode}:{filters:CompactNetworkFilters;accessMode:"free"|"pro"}){
  const active=NETWORK_SPEC_PARAMS.some(key=>Boolean(filters[key]));
  const locked=accessMode!=="pro";
  const field=(name:"od"|"wt"|"side",label:string,hint:string)=>
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold text-[#315d4a]">{label}</span>
      <input name={name} inputMode="decimal" defaultValue={filters[name]||""} placeholder={hint}
        disabled={locked} aria-label={label} className={inputStyle}/>
    </label>;
  return <details open={active} className="mt-2 rounded-xl border border-[#c6ded0] bg-white/70" data-testid="network-spec-panel">
    <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-[#175640] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
      Specifica tecnica <span className="font-normal text-[#52615b]">· norma, grado e misure{locked?" · Pro":""}</span>
      <span aria-hidden="true" className="ml-1">⌄</span>
    </summary>
    <form method="get" action="/network" aria-label="Ricerca per specifica tecnica" className="border-t border-[#d9e8e2] px-3 pb-3 pt-2">
      {PRESERVED.map(key=>filters[key]?<input key={key} type="hidden" name={key} value={filters[key]}/>:null)}
      <div className="grid grid-cols-2 items-end gap-2 md:grid-cols-3 xl:grid-cols-[1.2fr_1fr_1fr_.8fr_.8fr_.8fr]">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-semibold text-[#315d4a]">Norma</span>
          <input name="std" list="network-spec-standards" defaultValue={filters.std||""} placeholder="es. EN 10219"
            disabled={locked} aria-label="Norma" maxLength={40} className={inputStyle}/>
          <datalist id="network-spec-standards">
            {NETWORK_SPEC_STANDARD_SUGGESTIONS.map(code=><option key={code} value={code}/>)}
          </datalist>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-semibold text-[#315d4a]">Grado</span>
          <input name="grade" defaultValue={filters.grade||""} placeholder="es. S235, S355J2H"
            disabled={locked} aria-label="Grado o materiale" maxLength={40} className={inputStyle}/>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-semibold text-[#315d4a]">Forma</span>
          <select name="shape" defaultValue={filters.shape||""} disabled={locked} aria-label="Forma" className={inputStyle}>
            <option value="">Qualsiasi</option>
            {NETWORK_SPEC_SHAPES.map(shape=><option key={shape.key} value={shape.key}>{shape.label}</option>)}
          </select>
        </label>
        {field("od","Ø esterno (mm)","es. 60,3")}
        {field("wt","Spessore (mm)","es. 3")}
        {field("side","Lato (mm)","es. 100")}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="submit" disabled={locked}
          className="ui-action ui-action-primary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60">
          Cerca fornitori compatibili
        </button>
        {active?<Link href={withoutSpec(filters)} className="ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold">Rimuovi specifica</Link>:null}
        <p className="min-w-0 flex-1 text-[11px] leading-4 text-[#52615b]">
          {locked?"La ricerca per norma, grado e misure usa lo scope tecnico dei profili, disponibile nel Network Pro.":
            "Confronto con lo scope tecnico pubblicato nei profili. Quantità e lunghezze di taglio si indicano nella richiesta d'offerta."}
        </p>
      </div>
    </form>
  </details>;
}

const DIMENSION_LABELS:Record<string,string>={
  outer_diameter:"Ø",wall_thickness:"sp.",width:"lato",height:"lato",length:"lungh.",
};
const mm=(value:number)=>Number(value).toLocaleString("it-IT",{maximumFractionDigits:2});

/** One line under the company name: what matched, and where the claim comes from. */
export function SpecMatchLine({match,name}:{match:SpecMatch;name:string}){
  if(match.status!=="exact"){
    return <p className="mt-1 text-[11px] leading-4 text-[#52615b]" data-testid="network-spec-undeclared">
      Scope tecnico non dichiarato per questa specifica · da verificare con l&apos;azienda
    </p>;
  }
  const parts=[
    ...[...new Set(match.standards.map(item=>item.code))],
    ...[...new Set(match.grades.map(item=>item.designation))],
    ...[...new Set(match.dimensions.map(item=>(DIMENSION_LABELS[item.dimension_type]||item.dimension_type)+" "+mm(item.min_mm)+"–"+mm(item.max_mm)+" mm"))],
  ];
  const kinds=[...match.standards,...match.grades,...match.dimensions].map(item=>item.provenance_kind);
  // Show the weakest provenance: a single public-web claim must not read as verified.
  const order=["public_web","platform_curated","company_declared","platform_verified"];
  const weakest=kinds.sort((a,b)=>order.indexOf(a)-order.indexOf(b))[0];
  return <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-4 text-[#43524c]"
    data-testid="network-spec-exact" aria-label={"Specifica compatibile per "+name+": "+parts.join(", ")}>
    <span className="font-semibold text-[#175640]">✓ Compatibile</span>
    {parts.length?<span className="truncate">· {parts.join(" · ")}</span>:null}
    <span className="rounded-full bg-[#f1f5f2] px-1.5 text-[10px] text-[#43524c]">{specProvenanceLabel(weakest)}</span>
  </p>;
}
