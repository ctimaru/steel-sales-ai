"use client";

import {useEffect,useRef,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {EU_MEMBER_COUNTRIES,OTHER_NETWORK_COUNTRIES,EUROPE_NETWORK_COUNTRIES,networkCountryName} from "@/lib/network-eu-countries";
import {NetworkCountryFlag} from "@/components/network-country-flag";
import type {CompactNetworkFilters} from "@/lib/network-compact-directory";
import {europeRegionsForCountry} from "@/lib/network-eu-regions";
import {ITALY_REGIONS} from "@/lib/network-italy-regions";
import type {EuropeRegionCoverage} from "@/lib/network-europe-regional";
import {EUROPE_EXTENDED_COUNTRY_SHAPES,EUROPE_EXTENDED_MAP_VIEWBOX} from "@/lib/network-europe-extended-geometry";

const selectableCountryCodes=new Set(EUROPE_NETWORK_COUNTRIES.map(country=>country.code));
const mappedCountries=EUROPE_EXTENDED_COUNTRY_SHAPES.filter(shape=>selectableCountryCodes.has(shape.code));
const contextualCountries=EUROPE_EXTENDED_COUNTRY_SHAPES.filter(shape=>!selectableCountryCodes.has(shape.code));
const europeCountryCount=EUROPE_NETWORK_COUNTRIES.length;

/** Same URL facets as the Network filters; never preserve Italian region or page
 * across a country change. Access controls stay in the server-side query path.
 */
export function europeMapCountryHref(
  filters:CompactNetworkFilters,country:string,
):string{
  const params=new URLSearchParams();
  for(const key of ["q","role","persona","product","capability","market"] as const){
    const value=filters[key];
    if(value)params.set(key,value);
  }
  params.set("country",country);
  return "/network?"+params.toString()+"#network-results";
}

/** Zoom changes visualization only, NOT a search filter; never infer business
 * counts or facilities from map geometry.
 */
export function europeMapRegionHref(filters:CompactNetworkFilters,country:string,region:string):string{
  const params=new URLSearchParams(europeMapCountryHref(filters,country).split("?")[1].split("#")[0]);
  params.set("region",region);
  return "/network?"+params.toString()+"#network-results";
}
export function europeMapViewBox(code:string|null):string{
  const region=mappedCountries.find(x=>x.code===code);
  if(!region)return EUROPE_EXTENDED_MAP_VIEWBOX;
  const [left,top,right,bottom]=region.bounds;
  const cx=(left+right)/2,cy=(top+bottom)/2;
  const width=Math.max(205,(right-left)*1.5,(bottom-top)*1.6*1330/710);
  const height=width*710/1330;
  return [cx-width/2,cy-height/2,width,height].map(x=>Math.round(x*10)/10).join(" ");
}

type MapProps={
  filters:CompactNetworkFilters;
  fullMapHref?:string;
  coverage?:EuropeRegionCoverage|null;
  /** Existing authorized country statistics, already loaded for the ticker. */
  countryCounts?:Record<string,number>;
};
type RegionOutline={code:string;name:string;path:string;bounds:number[]|null};

/** Italy's NUTS file has 21 polygons (Bolzano and Trento are distinct NUTS).
 * Merge those two into the 20 official administrative regions for the
 * Network country->region filters. All other country files keep their codes.
 */
const italyNutsLabels:Record<string,string>={
  ITC2:"Valle d'Aosta",ITH1:"Trentino-Alto Adige",ITH2:"Trentino-Alto Adige",
};
export function networkMapDisplayRegions(country:string,regions:RegionOutline[]):RegionOutline[]{
  if(country!=="IT")return regions;
  const combined=new Map<string,RegionOutline>();
  for(const region of regions){
    const name=italyNutsLabels[region.code]||region.name;
    if(!ITALY_REGIONS.includes(name))continue;
    const prior=combined.get(name);
    const bounds=region.bounds||[];
    combined.set(name,{code:name,name,path:(prior?.path||"")+region.path,
      bounds:prior?.bounds&&prior.bounds.length===4&&bounds.length===4
        ?[Math.min(prior.bounds[0],bounds[0]),Math.min(prior.bounds[1],bounds[1]),
          Math.max(prior.bounds[2],bounds[2]),Math.max(prior.bounds[3],bounds[3])]
        :bounds.length===4?bounds:prior?.bounds||null});
  }
  return [...combined.values()].sort((a,b)=>a.name.localeCompare(b.name,"it"));
}

type CanvasProps={
  filters:CompactNetworkFilters;
  selectedCountry:string;
  zoomCountry:string|null;
  compact:boolean;
  regionShapes:RegionOutline[];
  onNavigate:(href:string,kind:"country"|"region")=>void;
  selectedRegion:string;
  counts:Record<string,number>|null;
  countryCounts:Record<string,number>;
  countsAvailable:boolean;
};
function EuropeCanvas({filters,selectedCountry,zoomCountry,compact,regionShapes,onNavigate,selectedRegion,counts,countryCounts,countsAvailable}:CanvasProps){
  return <svg viewBox={europeMapViewBox(zoomCountry)}
    preserveAspectRatio="xMidYMid meet"
    role="group" aria-label="Mappa dell'Europa estesa: Paesi UE e non UE, inclusi Ucraina e Turchia"
    data-testid={compact?"network-eu-map-mini-svg":"network-eu-map-expanded-svg"}
    className={compact?"block h-[205px] w-full":"block h-auto max-h-[500px] w-full"}>
    <rect x="-400" y="-220" width="1800" height="1250" fill="#f3f8f5"/>
    {/* Geographic backdrop, not linked to a Network filter: never invent counts. */}
    {contextualCountries.map(shape=><path key={shape.code} d={shape.path} fillRule="evenodd"
      fill="#e0eae4" stroke="#ffffff" strokeWidth={compact?2:1.5}
      vectorEffect="non-scaling-stroke" aria-hidden="true" pointerEvents="none"/>)}
    {mappedCountries.map(shape=>{
      const isCurrent=selectedCountry===shape.code;
      const name=networkCountryName(shape.code)||shape.code;
      const href=europeMapCountryHref(filters,shape.code);
      const tiny=shape.code==="MT"||shape.code==="LU";
      const publishedCount=countryCounts[shape.code];
      const countryCountLabel=countsAvailable?(publishedCount??0).toLocaleString("it-IT")+" aziende pubblicate":"Conteggio non disponibile";
      const [left,top,right,bottom]=shape.bounds;
      return <a key={shape.code} href={href}
        aria-label={"Cerca aziende in "+name}
        title={name+" · "+countryCountLabel+" · seleziona come filtro Paese"}
        aria-current={isCurrent?"location":undefined}
        data-country={shape.code}
        className="group cursor-pointer outline-none"
        onClick={event=>{
          if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
          event.preventDefault();
          onNavigate(href,"country");
        }}>
        <path d={shape.path} fillRule="evenodd"
          fill={isCurrent?"#165b43":publishedCount>0?"#92bea7":countsAvailable?"#d5e5dc":"#bfddcd"} stroke="#ffffff"
          strokeWidth={compact?2.2:1.8} vectorEffect="non-scaling-stroke"
          className="transition-colors group-hover:fill-[#2e886a] group-focus-visible:fill-[#1b7352] group-focus-visible:stroke-[#a46620]"/>
        {tiny?<circle cx={(left+right)/2} cy={(top+bottom)/2} r={compact?8:5}
          fill={isCurrent?"#165b43":"#77ad91"} stroke="white"
          strokeWidth={2} vectorEffect="non-scaling-stroke"/>:null}
      </a>;
    })}
    {zoomCountry?regionShapes.map(region=>{
      const count=counts?.[region.code];
      return <a key={region.code} href={europeMapRegionHref(filters,zoomCountry,region.code)}
        data-nuts-region={region.code}
        aria-current={selectedRegion===region.code?"location":undefined}
        aria-label={"Filtra "+region.name+" · "+(count===undefined?"copertura geografica non disponibile":count+" aziende con sede pubblicata mappata")}
        title={region.name+" · "+(count===undefined?"Copertura non disponibile":count+" sedi aziendali mappate")}
        className="group cursor-pointer outline-none"
        onClick={event=>{
          if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
          event.preventDefault();
          onNavigate(europeMapRegionHref(filters,zoomCountry,region.code),"region");
        }}>
        <path d={region.path} fillRule="evenodd"
          fill={selectedRegion===region.code?"#155c43":count?"#87bda4":"#d4e7da"}
          stroke="#ffffff" strokeWidth={2} vectorEffect="non-scaling-stroke"
          className="transition-colors group-hover:fill-[#398766] group-focus-visible:fill-[#398766] group-focus-visible:stroke-[#9b621e]"/>
      </a>;
    }):null}
  </svg>;
}

/** The map and country selectors share one URL. The expanded native dialog
 * supports Escape, close and an accessible list of European countries.
 * Italy's verified-region map remains reachable without rewriting its data.
 */
export function NetworkEuropeanMap({filters,fullMapHref,coverage,countryCounts={}}:MapProps){
  const router=useRouter();
  const [isPending,startTransition]=useTransition();
  const selectedFromUrl=filters.country||"IT";
  const [zoomCountry,setZoomCountry]=useState<string|null>(
    filters.country && mappedCountries.some(x=>x.code===filters.country)?filters.country:null,
  );
  const [expanded,setExpanded]=useState(false);
  const [regionShapes,setRegionShapes]=useState<RegionOutline[]>([]);
  const [loadedRegionCountry,setLoadedRegionCountry]=useState<string|null>(null);
  const availableRegions=zoomCountry?europeRegionsForCountry(zoomCountry):[];
  const selectedRegion=filters.region||"";
  const reliableCoverage=coverage?.country===selectedFromUrl?coverage:null;
  const regionCounts=reliableCoverage?Object.fromEntries(reliableCoverage.regions.map(r=>[r.code,r.count])):null;
  const dialogRef=useRef<HTMLDialogElement>(null);
  const country=selectedFromUrl;
  const mappedSelected=mappedCountries.some(x=>x.code===country);
  const countsAvailable=Object.keys(countryCounts).length>0;
  const displayedCount=countryCounts[country]??0;
  const countryLabel=networkCountryName(country)||country;
  useEffect(()=>{
    setZoomCountry(filters.country && mappedCountries.some(x=>x.code===filters.country)?filters.country:null);
  },[filters.country]);
  useEffect(()=>{
    const modal=dialogRef.current;
    if(!modal)return;
    if(expanded&&!modal.open)modal.showModal();
    if(!expanded&&modal.open)modal.close();
  },[expanded]);
  useEffect(()=>{
    // Load subnational polygons for the compact first view too; the dialog is
    // optional, never a prerequisite for drilling into regions.
    if(!zoomCountry||!europeRegionsForCountry(zoomCountry).length){
      setRegionShapes([]);setLoadedRegionCountry(null);return;
    }
    const code=zoomCountry;
    const controller=new AbortController();
    setRegionShapes([]);setLoadedRegionCountry(null);
    fetch("/network-eu-regions/"+code+".json",{signal:controller.signal})
      .then(response=>{if(!response.ok)throw new Error("Geometry unavailable");return response.json();})
      .then((payload:{country?:string;regions?:RegionOutline[]})=>{
        if(payload.country===code&&Array.isArray(payload.regions)){
          const valid=payload.regions.filter(r=>typeof r.code==="string"&&typeof r.path==="string");
          setRegionShapes(networkMapDisplayRegions(code,valid));
          setLoadedRegionCountry(code);
        }
      }).catch(()=>{if(!controller.signal.aborted){setRegionShapes([]);setLoadedRegionCountry(null);}});
    return ()=>controller.abort();
  },[zoomCountry]);
  // Next App Router patches the affected Network components without a
  // document reload, while preserving URL, back/forward and server authorization.
  const navigate=(href:string,kind:"country"|"region"="country")=>{
    const countryInHref=new URLSearchParams(href.split("?")[1]?.split("#")[0]||"").get("country");
    if(countryInHref && mappedCountries.some(shape=>shape.code===countryInHref))
      setZoomCountry(countryInHref);
    // Keep the large map visible when selecting a country, so its regions
    // become the next immediate view. Only a region click returns to results.
    if(kind==="region")setExpanded(false);
    startTransition(()=>router.replace(href,{scroll:false}));
  };
  const canvas=(compact:boolean)=><EuropeCanvas filters={filters} selectedCountry={country}
    zoomCountry={zoomCountry} compact={compact} onNavigate={navigate}
    selectedRegion={selectedRegion} counts={regionCounts}
    countryCounts={countryCounts} countsAvailable={countsAvailable}
    regionShapes={loadedRegionCountry===zoomCountry?regionShapes:[]}/>;
  const renderCountry=(item:{code:string;name:string})=><a key={item.code}
    href={europeMapCountryHref(filters,item.code)}
    aria-current={country===item.code?"page":undefined}
    onClick={event=>{
      if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      navigate(europeMapCountryHref(filters,item.code));
    }}
    style={{color:country===item.code?"#ffffff":"#24543f",WebkitTextFillColor:country===item.code?"#ffffff":"#24543f"}}
    className={"flex min-h-10 items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] "+
      (country===item.code?"border-[#165b43] bg-[#165b43] text-white":"border-[#dae7de] bg-[#f6f9f6] text-[#24543f] hover:border-[#83b49e] hover:bg-[#e8f3eb]")}>
    <NetworkCountryFlag code={item.code}/>
    <span className="min-w-0 flex-1 truncate">{item.name}</span>
    <span className={"shrink-0 tabular-nums text-[11px] "+(country===item.code?"text-white":"text-[#416a57]")}>
      {countsAvailable?(countryCounts[item.code]??0).toLocaleString("it-IT"):"—"}
    </span>
  </a>;
  const italyDetailHref=europeMapCountryHref(filters,"IT").replace("#network-results","")
    +(fullMapHref?.includes("advanced=1")?"&advanced=1":"&map=1")+"#network-regional-map";
  return <>
    <section className="h-full rounded-2xl border border-[#d6e5dc] bg-white p-3"
      aria-label="Esplorazione geografica europea" data-testid="network-europe-mini-map">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#32745a]">Mappa Europa</p>
          <p className="text-xs font-semibold text-[#173f35]">{zoomCountry?(networkCountryName(zoomCountry)||zoomCountry)+" · scegli una regione":<>Europa estesa · {europeCountryCount} Paesi selezionabili</>}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
        {zoomCountry?<button type="button" onClick={()=>setZoomCountry(null)}
          data-testid="network-map-back-europe"
          aria-label="Torna alla vista Europa"
          className="ui-action ui-action-secondary inline-flex min-h-8 items-center rounded-md px-2 text-[11px] font-semibold">← Europa</button>:null}
        <button type="button" onClick={()=>setExpanded(true)}
          aria-label="Espandi mappa europea"
          className="ui-action ui-action-secondary inline-flex min-h-8 shrink-0 items-center rounded-md px-2 text-[11px] font-semibold">
          Espandi ↗
        </button>
        </div>
      </div>
      <div className="mt-1 overflow-hidden rounded-md bg-[#f3f8f5]" data-testid="network-europe1d-overview">{canvas(true)}</div>
      {zoomCountry?<nav aria-label={"Regioni di "+(networkCountryName(zoomCountry)||zoomCountry)}
          data-testid="network-map-compact-regions"
          className="mt-2 grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-[#dce9e2] p-1">
          {zoomCountry==="IT"
            ? ITALY_REGIONS.map(name=><a key={name}
                href={europeMapRegionHref(filters,"IT",name)}
                aria-current={selectedRegion===name?"page":undefined}
                onClick={event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
                  event.preventDefault();navigate(europeMapRegionHref(filters,"IT",name),"region");}}
                style={{color:selectedRegion===name?"#ffffff":"#315c49",WebkitTextFillColor:selectedRegion===name?"#ffffff":"#315c49"}}
                className={"truncate rounded-md px-2 py-1.5 text-[11px] font-semibold "+
                  (selectedRegion===name?"bg-[#165b43] text-white":"bg-[#eef5f0] text-[#315c49] hover:bg-[#dcece2]")}>{name}</a>)
            :europeRegionsForCountry(zoomCountry).map(region=><a key={region.code}
                href={europeMapRegionHref(filters,zoomCountry,region.code)}
                aria-current={selectedRegion===region.code?"page":undefined}
                onClick={event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
                  event.preventDefault();navigate(europeMapRegionHref(filters,zoomCountry,region.code),"region");}}
                style={{color:selectedRegion===region.code?"#ffffff":"#315c49",WebkitTextFillColor:selectedRegion===region.code?"#ffffff":"#315c49"}}
                className={"truncate rounded-md px-2 py-1.5 text-[11px] font-semibold "+
                  (selectedRegion===region.code?"bg-[#165b43] text-white":"bg-[#eef5f0] text-[#315c49] hover:bg-[#dcece2]")}>{region.name}</a>)}
        </nav>:null}
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-medium text-[#365a48]" title={countryLabel}>
          {mappedSelected?"Filtro: "+countryLabel+(countsAvailable?" · "+displayedCount.toLocaleString("it-IT")+" aziende":""):"Filtro fuori mappa: "+countryLabel}
        </p>
        <span className="shrink-0 text-[10px] text-[#52615b]" role="status" aria-live="polite">{isPending?"Aggiorno risultati…":zoomCountry?"Seleziona una regione":"Tocca un Paese"}</span>
      </div>
    </section>
    <dialog ref={dialogRef} onClose={()=>setExpanded(false)}
      onClick={event=>{if(event.target===event.currentTarget)setExpanded(false);}}
      aria-label="Mappa interattiva dell'Europa estesa"
      className="m-auto max-h-[92dvh] w-[min(1050px,95vw)] max-w-none overflow-y-auto rounded-2xl border border-[#b7cfc2] bg-white p-0 text-[#173f35] shadow-2xl backdrop:bg-[#092a21]/60">
      <div className="border-b border-[#dce9e2] px-4 py-3 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#32745a]">Smart Steel Sales · Network Europa</p>
            <h2 className="mt-1 text-xl font-semibold">{zoomCountry?(networkCountryName(zoomCountry)||zoomCountry)+" · Regioni":"Esplora l’Europa, oltre l’UE"}</h2>
            <p className="mt-1 text-xs text-[#52615b]">{zoomCountry?"Seleziona una regione sulla mappa o nella lista. Con ← Europa torni alla vista generale senza perdere il filtro Paese.":"Dal Regno Unito all’Ucraina e alla Turchia. Seleziona un Paese: aziende e contatori si aggiornano senza ricaricare la pagina."}</p>
          </div>
          <button type="button" onClick={()=>setExpanded(false)} aria-label="Chiudi mappa europea"
            className="ui-action ui-action-secondary inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-xs font-semibold">
            Chiudi ×
          </button>
        </div>
      </div>
      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_250px] sm:px-6">
        <div className="min-w-0 rounded-xl border border-[#d9e7dd] bg-[#f3f8f5] p-2">
          {canvas(false)}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-2">
            <p className="text-xs font-semibold text-[#173f35]" aria-live="polite">
              {mappedSelected?"Paese selezionato: "+countryLabel:"Paese fuori mappa: "+countryLabel}
            </p>
            <button type="button" onClick={()=>setZoomCountry(null)}
              className="ui-action ui-action-secondary inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold">← Europa</button>
          </div>
        </div>
        <div className="min-w-0">
          {zoomCountry&&zoomCountry!=="IT"&&availableRegions.length?<section aria-label="Regioni del Paese selezionato" className="mb-3">
            <p className="mb-1.5 text-xs font-semibold text-[#173f35]">{zoomCountry==="UA"?"Oblast · Ucraina":zoomCountry==="GB"?"Regioni NUTS 2021 · Regno Unito":"Regioni NUTS 2024 · "+(networkCountryName(zoomCountry||country)||country)}</p>
            <p className="mb-2 text-[11px] text-[#52615b]">Conteggi solo delle sedi pubblicate collegate, copertura parziale.</p>
            <nav aria-label="Scegli area regionale" className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto">
              {availableRegions.map(region=><a key={region.code}
                href={europeMapRegionHref(filters,country,region.code)}
                aria-current={selectedRegion===region.code?"page":undefined}
                onClick={event=>{
                  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
                  event.preventDefault();
                  navigate(europeMapRegionHref(filters,country,region.code),"region");
                }}
                style={{color:selectedRegion===region.code?"#ffffff":"#24543f",WebkitTextFillColor:selectedRegion===region.code?"#ffffff":"#24543f"}}
                className={"flex min-h-9 items-center justify-between gap-2 rounded-lg px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] "+
                  (selectedRegion===region.code?"bg-[#165b43] text-white":"bg-[#f0f5f1] text-[#24543f] hover:bg-[#dcece2]")}>
                <span className="truncate">{region.name}</span>
                <span className="shrink-0 tabular-nums">{regionCounts?.[region.code]??"—"}</span>
              </a>)}
            </nav>
          </section>:null}
          {zoomCountry==="IT"?<section aria-label="Seleziona una regione italiana" className="mb-3">
            <p className="mb-1.5 text-xs font-semibold text-[#173f35]">Italia · 20 regioni selezionabili</p>
            <nav className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto">
              {ITALY_REGIONS.map(name=><a key={name} href={europeMapRegionHref(filters,"IT",name)}
                aria-current={selectedRegion===name?"page":undefined}
                onClick={event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
                  event.preventDefault();navigate(europeMapRegionHref(filters,"IT",name),"region");}}
                style={{color:selectedRegion===name?"#ffffff":"#315c49",WebkitTextFillColor:selectedRegion===name?"#ffffff":"#315c49"}}
                className={"rounded-md px-2 py-2 text-xs font-medium "+
                  (selectedRegion===name?"bg-[#165b43] text-white":"bg-[#eef5f0] text-[#315c49] hover:bg-[#dcece2]")}>{name}</a>)}
            </nav>
          </section>:null}
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-[#527064]">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#92bea7]"/> Aziende nel Network
            <span className="ml-2 inline-block h-2.5 w-2.5 rounded-sm bg-[#d5e5dc]"/> Nessuna censita
            <span className="ml-2 inline-block h-2.5 w-2.5 rounded-sm bg-[#e0eae4]"/> Contesto geografico
          </div>
          <p className="mb-1.5 text-xs font-bold text-[#173f35]">Oltre l'Unione europea</p>
          <nav aria-label="Paesi europei extra UE" className="mb-3 grid grid-cols-1 gap-1.5">
            {OTHER_NETWORK_COUNTRIES.filter(item=>item.code!=="US").map(renderCountry)}
          </nav>
          <p className="mb-1.5 text-xs font-bold text-[#173f35]">Paesi dell'Unione europea</p>
          <nav aria-label="Elenco dei Paesi europei" className="grid max-h-[300px] grid-cols-1 gap-1.5 overflow-y-auto">
            {EU_MEMBER_COUNTRIES.map(renderCountry)}
          </nav>
          <a href={italyDetailHref} className="ui-action ui-action-secondary mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg px-3 text-xs font-semibold">
            Esplora le 20 regioni italiane →
          </a>
        </div>
      </div>
      <p className="px-5 pb-4 text-[11px] leading-5 text-[#52615b]">
        Mappa di esplorazione, non una misura della densità industriale: i Paesi in grigio sono contesto geografico, non filtri. Le statistiche sono relative ai profili effettivamente consultabili; le suddivisioni regionali sono disponibili soltanto dove esistono dati NUTS e sedi collegate.
        Confini © Eurostat/GISCO, NUTS 2024 e 2021 per il Regno Unito, rielaborati
        (<a className="ml-1 underline" href="https://github.com/eurostat/Nuts2json" target="_blank" rel="noopener noreferrer">EUPL 1.2</a>);
        contesto cartografico Natural Earth, pubblico dominio.
        Suddivisioni dell'Ucraina: <a className="underline" href="https://github.com/slawomirmatuszak/ukrainian_geodata" target="_blank" rel="noopener noreferrer">dati amministrativi 2020 · CC BY 4.0</a>.
        Le rappresentazioni dei confini hanno finalità illustrative e non esprimono posizioni su controversie territoriali. I territori d'oltremare non sono inclusi nell'inquadratura.
      </p>
    </dialog>
  </>;
}
