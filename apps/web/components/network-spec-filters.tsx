import Link from "next/link";
import type {CompactNetworkFilters} from "@/lib/network-compact-directory";
import type {SpecMatch} from "@/lib/network-spec-search";
import {
  NETWORK_SPEC_PARAMS,NETWORK_SPEC_SHAPES,NETWORK_SPEC_STANDARD_SUGGESTIONS,specProvenanceLabel,
} from "@/lib/network-spec-filters";

// NET-UX-TECH1: visual alignment with the 44px controls of the Network sidebar.
const inputStyle="h-11 w-full min-w-0 rounded-xl border border-[#b7cfc2] bg-white px-2.5 text-[13px] font-medium text-[#173f35] outline-none transition-colors placeholder:font-normal placeholder:text-[#647269] focus-visible:border-[#175640] focus-visible:ring-2 focus-visible:ring-[#d6e9dc] disabled:cursor-not-allowed disabled:border-[#d7e3dc] disabled:bg-[#eef2ef] disabled:text-[#53635b]";
const labelStyle="text-[11px] font-semibold leading-4 text-[#315d4a]";
const PRESERVED=["q","role","region","country","persona","steel","product","capability","market"] as const;

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
  const field=(name:"od"|"wt"|"side"|"side2",label:string,hint:string)=>
    <label data-testid={"network-spec-field-"+name} className="flex min-w-0 flex-col gap-1.5">
      <span className={labelStyle}>{label}</span>
      <input name={name} inputMode="decimal" defaultValue={filters[name]||""} placeholder={hint}
        disabled={locked} aria-label={label} className={inputStyle}/>
    </label>;
  return <details open={active} className="group min-w-0 overflow-hidden rounded-2xl border border-[#cbded2] bg-[#f8fbf9]" data-testid="network-spec-panel">
    <summary data-testid="network-spec-summary" className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] [&::-webkit-details-marker]:hidden">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-bold leading-4 text-[#173f35]">Specifica tecnica</span>
        <span className="text-[11px] leading-4 text-[#587163]">Norma · grado · misure</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {locked?<span className="rounded-md border border-[#c8dccd] bg-white px-1.5 py-1 text-[10px] font-bold leading-3 text-[#205941]">PRO</span>:
          active?<span className="rounded-md bg-[#e3f0e8] px-1.5 py-1 text-[10px] font-bold leading-3 text-[#175640]">Attiva</span>:null}
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-[#175640] transition-transform group-open:rotate-180">
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    </summary>
    <form method="get" action="/network" aria-label="Ricerca per specifica tecnica" className="min-w-0 space-y-3 border-t border-[#d9e8e2] bg-white px-3 py-3">
      {PRESERVED.map(key=>filters[key]?<input key={key} type="hidden" name={key} value={filters[key]}/>:null)}
      <fieldset className="min-w-0" data-testid="network-spec-material">
        <legend className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#47705a]">Norma e materiale</legend>
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={labelStyle}>Norma</span>
            <input name="std" list="network-spec-standards" defaultValue={filters.std||""} placeholder="EN 10219"
              disabled={locked} aria-label="Norma" maxLength={40} className={inputStyle}/>
            <datalist id="network-spec-standards">
              {NETWORK_SPEC_STANDARD_SUGGESTIONS.map(code=><option key={code} value={code}/>)}
            </datalist>
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={labelStyle}>Grado</span>
            <input name="grade" defaultValue={filters.grade||""} placeholder="S355J2H"
              disabled={locked} aria-label="Grado o materiale" maxLength={40} className={inputStyle}/>
          </label>
        </div>
      </fieldset>
      <fieldset className="min-w-0 border-t border-[#e8efea] pt-3" data-testid="network-spec-geometry">
        <legend className="px-0 text-[10px] font-bold uppercase tracking-[0.1em] text-[#47705a]">Geometria e misure</legend>
        <label className="mt-2 flex min-w-0 flex-col gap-1.5">
          <span className={labelStyle}>Forma del profilo</span>
          <select name="shape" defaultValue={filters.shape||""} disabled={locked} aria-label="Forma" className={inputStyle}>
            <option value="">Qualsiasi forma</option>
            {NETWORK_SPEC_SHAPES.map(shape=><option key={shape.key} value={shape.key}>{shape.label}</option>)}
          </select>
        </label>
        <div className="mt-2 grid min-w-0 grid-cols-2 gap-2" data-testid="network-spec-diameter-row">
          {field("od","Ø esterno (mm)","60,3")}
          {field("wt","Spessore (mm)","3")}
        </div>
        <div className="mt-2 grid min-w-0 grid-cols-2 gap-2" data-testid="network-spec-sides-row">
          {field("side","Lato 1 (mm)","100")}
          {field("side2","Lato 2 (mm)","50")}
        </div>
      </fieldset>
      <label className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-xl border border-[#e0eae3] bg-[#f6faf7] px-2.5 py-2 text-[11px] font-semibold leading-4 text-[#315d4a]">
        <input type="checkbox" name="stock" value="1" defaultChecked={filters.stock==="1"} disabled={locked}
          aria-label="Solo aziende con stock dichiarato" className="h-4 w-4 shrink-0 accent-[#175640]"/>
        <span>Solo aziende con stock dichiarato</span>
      </label>
      <div className="flex min-w-0 flex-col gap-2">
        <button type="submit" disabled={locked} className="ui-action ui-action-primary inline-flex min-h-11 w-full items-center justify-center rounded-xl px-2.5 py-2 text-center text-xs font-semibold leading-4 disabled:cursor-not-allowed disabled:opacity-60">Cerca fornitori compatibili</button>
        {active?<Link href={withoutSpec(filters)} className="ui-action ui-action-secondary inline-flex min-h-11 w-full items-center justify-center rounded-xl px-2.5 text-center text-xs font-semibold">Rimuovi specifica</Link>:null}
      </div>
      <p role="note" className="text-[11px] leading-[1.5] text-[#526b5e]">
        {locked?"Ricerca per norma, grado e misure disponibile nel Network Pro.":
          "Confronta lo scope tecnico dei profili. Quantità e lunghezze di taglio vanno nella richiesta d’offerta."}
      </p>
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
    ...(match.stock?["a stock"]:[]),
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
