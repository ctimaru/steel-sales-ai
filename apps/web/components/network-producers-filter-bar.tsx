"use client";

import {useRouter} from "next/navigation";
import {useTransition,type ReactNode} from "react";

import {
  activeProducerFilterCount,
  hasActiveProducerFilters,
  producerFilterParams,
  toggleFilterValue,
  type ProducerFilters,
} from "@/lib/network-producer-filters";

/*
 * NET-PRODUCERS-FILTERS1 (founder decisions, 23 Nov 2026):
 * filters on ALL Italian producers, from documented first-party values only;
 * «menzioni da qualificare» join only through their own switch; «Prodotto»
 * shows the values as written in the sources. Every change is a navigation
 * (filters live in the address) and goes back to page 1.
 */

export type FacetValue={value:string;label:string;companies:number};
export type FilterFacets={
  products:FacetValue[];
  standards:FacetValue[];
  grades:FacetValue[];
  regions:FacetValue[];
  documentedCompanies:number;
};

const sentence=(text:string)=>text?text[0].toUpperCase()+text.slice(1):text;

function Popover({label,count,children,testId}:{label:string;count:number;children:ReactNode;testId:string}){
  return <details className="group relative" data-testid={testId}>
    <summary className={"inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] [&::-webkit-details-marker]:hidden "+
      (count>0?"border-[#175640] bg-[#eef6f0] text-[#14543c]":"border-[#c9d9ce] bg-white text-[#355c47] hover:bg-[#f3f8f4]")}>
      {label}{count>0?<span className="rounded-full bg-[#175640] px-1.5 text-[10px] font-bold text-white">{count}</span>:null}
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
    </summary>
    <div className="absolute left-0 z-40 mt-1 w-[min(88vw,300px)] rounded-xl border border-[#d4e3d9] bg-white p-2 shadow-[0_14px_34px_rgba(10,32,25,0.14)]">
      {children}
    </div>
  </details>;
}

function ValueList({values,selected,onToggle,multi,empty,format=sentence}:{
  values:FacetValue[];
  selected:readonly string[];
  onToggle:(value:string)=>void;
  multi:boolean;
  empty:string;
  format?:(label:string)=>string;
}){
  // Values already chosen but no longer offered (old link, changed data) stay visible so they can be removed.
  const extra=selected.filter(value=>!values.some(v=>v.value.toLowerCase()===value.toLowerCase()))
    .map(value=>({value,label:value,companies:0}));
  const all=[...extra,...values];
  if(all.length===0)return <p className="px-2 py-3 text-xs text-[#61786a]">{empty}</p>;
  return <ul className="max-h-72 overflow-y-auto">
    {all.map(item=>{
      const checked=selected.some(value=>value.toLowerCase()===item.value.toLowerCase());
      return <li key={item.value}>
        <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs text-[#223f31] hover:bg-[#f3f8f4]">
          <input type={multi?"checkbox":"radio"} checked={checked} onChange={()=>onToggle(item.value)}
            className="h-4 w-4 accent-[#175640]"/>
          <span className="min-w-0 flex-1 truncate">{format(item.label)}</span>
          {item.companies>0?<span className="tabular-nums text-[11px] text-[#61786a]">{item.companies}</span>:null}
        </label>
      </li>;
    })}
  </ul>;
}

export function NetworkProducersFilterBar({filters,facets,query,country}:{
  filters:ProducerFilters;
  facets:FilterFacets|null;
  query:string;
  country:string;
}){
  const router=useRouter();
  const [pending,startTransition]=useTransition();
  function apply(next:ProducerFilters){
    const params=producerFilterParams({q:query,country},next);
    startTransition(()=>router.push("/network/pro/producers?"+params.toString(),{scroll:false}));
  }
  const active=hasActiveProducerFilters(filters);
  const chips:{key:string;label:string;remove:ProducerFilters}[]=[
    ...filters.products.map(v=>({key:"p:"+v,label:sentence(v),remove:{...filters,products:toggleFilterValue(filters.products,v)}})),
    ...filters.standards.map(v=>({key:"s:"+v,label:v,remove:{...filters,standards:toggleFilterValue(filters.standards,v)}})),
    ...filters.grades.map(v=>({key:"g:"+v,label:v,remove:{...filters,grades:toggleFilterValue(filters.grades,v)}})),
    ...(filters.region?[{key:"r",label:filters.region,remove:{...filters,region:null}}]:[]),
    ...(filters.documentedOnly?[{key:"d",label:"Solo con dati tecnici",remove:{...filters,documentedOnly:false}}]:[]),
  ];
  return <section aria-label="Filtri produttori" className="space-y-2" data-testid="network-producers-filters" aria-busy={pending}>
    <div className="flex flex-wrap items-center gap-1.5">
      <Popover label="Prodotto" count={filters.products.length} testId="producer-filter-products">
        <ValueList values={facets?.products??[]} selected={filters.products} multi
          empty="Nessun valore documentato."
          onToggle={value=>apply({...filters,products:toggleFilterValue(filters.products,value)})}/>
      </Popover>
      <Popover label="Norma" count={filters.standards.length} testId="producer-filter-standards">
        <ValueList values={facets?.standards??[]} selected={filters.standards} multi format={label=>label}
          empty="Nessuna norma documentata."
          onToggle={value=>apply({...filters,standards:toggleFilterValue(filters.standards,value)})}/>
      </Popover>
      <Popover label="Grado" count={filters.grades.length} testId="producer-filter-grades">
        <ValueList values={facets?.grades??[]} selected={filters.grades} multi format={label=>label}
          empty="Nessun grado documentato."
          onToggle={value=>apply({...filters,grades:toggleFilterValue(filters.grades,value)})}/>
      </Popover>
      <Popover label="Regione" count={filters.region?1:0} testId="producer-filter-region">
        <ValueList values={facets?.regions??[]} selected={filters.region?[filters.region]:[]} multi={false} format={label=>label}
          empty="Nessuna sede registrata."
          onToggle={value=>apply({...filters,region:filters.region?.toLowerCase()===value.toLowerCase()?null:value})}/>
      </Popover>
      <label className={"inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold "+
        (filters.documentedOnly?"border-[#175640] bg-[#eef6f0] text-[#14543c]":"border-[#c9d9ce] bg-white text-[#355c47] hover:bg-[#f3f8f4]")}>
        <input type="checkbox" checked={filters.documentedOnly} onChange={()=>apply({...filters,documentedOnly:!filters.documentedOnly})}
          className="h-4 w-4 accent-[#175640]" data-testid="producer-filter-documented"/>
        Solo con dati tecnici{facets?<span className="tabular-nums text-[#61786a]"> · {facets.documentedCompanies}</span>:null}
      </label>
      <label className={"inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold "+
        (filters.includeMentions?"border-[#b38a1f] bg-[#faf6ea] text-[#6b5313]":"border-[#e3dcc5] bg-white text-[#6b5313] hover:bg-[#fdfaf1]")}
        title="Aggiunge alle ricerche anche le parole tecniche trovate sui siti, non ancora qualificate">
        <input type="checkbox" checked={filters.includeMentions} onChange={()=>apply({...filters,includeMentions:!filters.includeMentions})}
          className="h-4 w-4 accent-[#8a6a14]" data-testid="producer-filter-mentions"/>
        Includi menzioni da qualificare
      </label>
      <span className="flex-1"/>
      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4d6355]">
        Ordina
        <select value={filters.sort} onChange={event=>apply({...filters,sort:event.target.value==="documented"?"documented":"name"})}
          data-testid="producer-sort"
          className="min-h-9 rounded-lg border border-[#c9d9ce] bg-white px-2 text-xs font-semibold text-[#183d2d] focus-visible:outline-2 focus-visible:outline-[#175640]">
          <option value="name">Nome</option>
          <option value="documented">Più documentati prima</option>
        </select>
      </label>
    </div>
    {active?<div className="flex flex-wrap items-center gap-1.5" aria-label="Filtri attivi">
      {chips.map(chip=><button key={chip.key} type="button" onClick={()=>apply(chip.remove)}
        aria-label={"Togli il filtro "+chip.label}
        className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[#175640] px-3 text-[11px] font-semibold text-white hover:bg-[#10452f]">
        {chip.label}<span aria-hidden="true">×</span>
      </button>)}
      <button type="button" onClick={()=>apply({...filters,products:[],standards:[],grades:[],region:null,documentedOnly:false})}
        data-testid="producer-filters-clear"
        className="min-h-8 px-2 text-[11px] font-bold text-[#1d6948] underline underline-offset-2">
        Azzera filtri ({activeProducerFilterCount(filters)})
      </button>
    </div>:null}
  </section>;
}
