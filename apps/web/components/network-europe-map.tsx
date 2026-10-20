"use client";

import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {EU_MEMBER_COUNTRIES,networkCountryName} from "@/lib/network-eu-countries";
import type {CompactNetworkFilters} from "@/lib/network-compact-directory";
import {EUROPE_COUNTRY_SHAPES,EUROPE_MAP_VIEWBOX} from "@/lib/network-europe-geometry";

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
export function europeMapViewBox(code:string|null):string{
  const region=EUROPE_COUNTRY_SHAPES.find(x=>x.code===code);
  if(!region)return EUROPE_MAP_VIEWBOX;
  const [left,top,right,bottom]=region.bounds;
  const cx=(left+right)/2,cy=(top+bottom)/2;
  const width=Math.max(190,(right-left)*1.5,(bottom-top)*1.6*960/710);
  const height=width*710/960;
  return [cx-width/2,cy-height/2,width,height].map(x=>Math.round(x*10)/10).join(" ");
}

type MapProps={
  filters:CompactNetworkFilters;
  fullMapHref?:string;
};

type CanvasProps={
  filters:CompactNetworkFilters;
  selectedCountry:string;
  zoomCountry:string|null;
  compact:boolean;
  onSelect:(code:string)=>void;
};

function EuropeCanvas({filters,selectedCountry,zoomCountry,compact,onSelect}:CanvasProps){
  return <svg viewBox={europeMapViewBox(zoomCountry)}
    preserveAspectRatio="xMidYMid meet"
    role="group" aria-label="Mappa europea: scegli uno dei 27 Stati dell'Unione europea"
    data-testid={compact?"network-eu-map-mini-svg":"network-eu-map-expanded-svg"}
    className={compact?"block h-[155px] w-full":"block h-auto max-h-[470px] w-full"}>
    <rect x="-200" y="-200" width="1600" height="1200" fill="#f3f8f5"/>
    {EUROPE_COUNTRY_SHAPES.map(shape=>{
      const isCurrent=selectedCountry===shape.code;
      const name=networkCountryName(shape.code)||shape.code;
      const href=europeMapCountryHref(filters,shape.code);
      const tiny=shape.code==="MT"||shape.code==="LU";
      const [left,top,right,bottom]=shape.bounds;
      return <a key={shape.code} href={href}
        aria-label={"Cerca aziende in "+name}
        aria-current={isCurrent?"location":undefined}
        data-country={shape.code}
        className="group cursor-pointer outline-none"
        onClick={event=>{
          if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
          event.preventDefault();
          onSelect(shape.code);
        }}>
        <path d={shape.path} fillRule="evenodd"
          fill={isCurrent?"#165b43":"#bfddcd"} stroke="#ffffff"
          strokeWidth={compact?2.2:1.8} vectorEffect="non-scaling-stroke"
          className="transition-colors group-hover:fill-[#2e886a] group-focus-visible:fill-[#1b7352] group-focus-visible:stroke-[#a46620]"/>
        {tiny?<circle cx={(left+right)/2} cy={(top+bottom)/2} r={compact?8:5}
          fill={isCurrent?"#165b43":"#77ad91"} stroke="white"
          strokeWidth={2} vectorEffect="non-scaling-stroke"/>:null}
        <title>{name} · Seleziona come filtro Paese</title>
      </a>;
    })}
  </svg>;
}

/** The map and both country selectors share one URL. The expanded native
 * dialog supports Escape, close and a keyboard-accessible 27-country list.
 * Italy's verified-region map remains reachable without rewriting its data.
 */
export function NetworkEuropeanMap({filters,fullMapHref}:MapProps){
  const router=useRouter();
  const selectedFromUrl=filters.country||"IT";
  const [requestedCountry,setRequestedCountry]=useState<string|null>(null);
  const [zoomCountry,setZoomCountry]=useState<string|null>(
    filters.country && EUROPE_COUNTRY_SHAPES.some(x=>x.code===filters.country)?filters.country:null,
  );
  const [expanded,setExpanded]=useState(false);
  const dialogRef=useRef<HTMLDialogElement>(null);
  const country=requestedCountry||selectedFromUrl;
  const euSelected=EUROPE_COUNTRY_SHAPES.some(x=>x.code===country);
  const countryLabel=networkCountryName(country)||country;
  useEffect(()=>{
    setRequestedCountry(null);
    setZoomCountry(filters.country && EUROPE_COUNTRY_SHAPES.some(x=>x.code===filters.country)?filters.country:null);
  },[filters.country]);
  useEffect(()=>{
    const modal=dialogRef.current;
    if(!modal)return;
    if(expanded&&!modal.open)modal.showModal();
    if(!expanded&&modal.open)modal.close();
  },[expanded]);
  const choose=(code:string)=>{
    setRequestedCountry(code);
    setZoomCountry(code);
    router.replace(europeMapCountryHref(filters,code),{scroll:false});
  };
  const canvas=(compact:boolean)=><EuropeCanvas filters={filters} selectedCountry={country}
    zoomCountry={zoomCountry} compact={compact} onSelect={choose}/>;
  const italyDetailHref=europeMapCountryHref(filters,"IT").replace("#network-results","")
    +(fullMapHref?.includes("advanced=1")?"&advanced=1":"&map=1")+"#network-regional-map";
  return <>
    <section className="h-full rounded-2xl border border-[#d6e5dc] bg-white p-3"
      aria-label="Esplorazione geografica europea" data-testid="network-europe-mini-map">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#32745a]">Mappa Europa</p>
          <p className="text-xs font-semibold text-[#173f35]">27 Paesi selezionabili</p>
        </div>
        <button type="button" onClick={()=>setExpanded(true)}
          aria-label="Espandi mappa europea"
          className="ui-action ui-action-secondary inline-flex min-h-8 shrink-0 items-center rounded-md px-2 text-[11px] font-semibold">
          Espandi ↗
        </button>
      </div>
      <div className="mt-1 overflow-hidden rounded-md bg-[#f3f8f5]">{canvas(true)}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-medium text-[#365a48]" title={countryLabel}>
          {euSelected?"Filtro: "+countryLabel:"Filtro esterno UE: "+countryLabel}
        </p>
        {zoomCountry?<button type="button" onClick={()=>setZoomCountry(null)}
          className="min-h-7 shrink-0 text-[11px] font-semibold text-[#175640] underline underline-offset-2">
          Vista UE
        </button>:null}
      </div>
    </section>
    <dialog ref={dialogRef} onClose={()=>setExpanded(false)}
      onClick={event=>{if(event.target===event.currentTarget)setExpanded(false);}}
      aria-label="Mappa interattiva dell'Unione europea"
      className="m-auto max-h-[92dvh] w-[min(1050px,95vw)] max-w-none overflow-y-auto rounded-2xl border border-[#b7cfc2] bg-white p-0 text-[#173f35] shadow-2xl backdrop:bg-[#092a21]/60">
      <div className="border-b border-[#dce9e2] px-4 py-3 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#32745a]">Smart Steel Sales · Network Europa</p>
            <h2 className="mt-1 text-xl font-semibold">Esplora i 27 Paesi UE</h2>
            <p className="mt-1 text-xs text-[#52615b]">Seleziona un territorio sulla mappa o dalla lista. La ricerca mostra soltanto aziende disponibili nel Network.</p>
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
              {euSelected?"Paese selezionato: "+countryLabel:"Paese non UE: "+countryLabel}
            </p>
            <button type="button" onClick={()=>setZoomCountry(null)}
              className="ui-action ui-action-secondary inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold">Vista Europa</button>
          </div>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold text-[#173f35]">Vai direttamente a un Paese</p>
          <nav aria-label="Elenco dei 27 Paesi europei" className="grid max-h-[400px] grid-cols-2 gap-1.5 overflow-y-auto lg:grid-cols-1">
            {EU_MEMBER_COUNTRIES.map(item=><a key={item.code}
              href={europeMapCountryHref(filters,item.code)}
              aria-current={country===item.code?"page":undefined}
              onClick={event=>{
                if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
                event.preventDefault();choose(item.code);
              }}
              className={"flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] "+
                (country===item.code?"bg-[#165b43] text-white":"bg-[#f0f5f1] text-[#24543f] hover:bg-[#dcece2]")}>
              {item.name}
            </a>)}
          </nav>
          <a href={italyDetailHref} className="ui-action ui-action-secondary mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg px-3 text-xs font-semibold">
            Esplora le 20 regioni italiane →
          </a>
        </div>
      </div>
      <p className="px-5 pb-4 text-[11px] leading-5 text-[#52615b]">
        Mappa di selezione, non densità di aziende. Per le regioni degli altri Paesi è in corso l'integrazione geografica EUROPE1C.
        Confini europei: © Eurostat/GISCO, NUTS 2024 (rielaborazione e ritaglio della vista europea),
        <a className="ml-1 underline" href="https://github.com/eurostat/Nuts2json" target="_blank" rel="noopener noreferrer">Nuts2json · EUPL 1.2 ↗</a>.
        La vista esclude le isole atlantiche remote e i territori d'oltremare; i filtri aziendali non ne sono modificati.
      </p>
    </dialog>
  </>;
}
