"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  dimensionLabel, dimensionNumber, searchCalculatorDimensions,
  type CalculatorDimension, type DimensionFamilyFilter,
} from "@/lib/calculator-dimension-discovery";
import type { TubeCalculatorLocale } from "@/lib/tube-calculator-locale";

const copy: Record<TubeCalculatorLocale,{
  title:string;subtitle:string;search:string;placeholder:string;all:string;round:string;square:string;rect:string;
  wall:string;filters:string;enterHint:string;results:string;apply:string;empty:string;noData:string;onlySource:string;more:string;applied:string;
}> = {
  it:{title:"Trova la tua misura",subtitle:"Misure pubblicate · selezione rapida",
    search:"Cerca dimensione",placeholder:"Es. 168,3x6,3 · 100x100x4",
    all:"Tutte",round:"Tondi",square:"Quadri",rect:"Rettangolari",wall:"Spessore",
     filters:"Filtri misura",enterHint:"Invio per applicare",
    results:"misure trovate",apply:"Usa misura",empty:"Nessun risultato: modifica i filtri o inserisci le misure manualmente.",
    noData:"Nessuna misura pubblicata disponibile. La compilazione manuale resta attiva.",
    onlySource:"Misura tratta da fonte pubblicata; la norma e il peso teorico vengono calcolati separatamente.",
    more:"Affina la ricerca per altri risultati.",applied:"Selezione applicata"},
  en:{title:"Find your size",subtitle:"Published dimensions · quick selection",
    search:"Search dimensions",placeholder:"e.g. 168.3x6.3 · 100x100x4",
    all:"All",round:"Round",square:"Square",rect:"Rectangular",wall:"Wall",
     filters:"Size filters",enterHint:"Enter to apply",
    results:"matching sizes",apply:"Use size",empty:"No matches. Adjust filters or enter dimensions manually.",
    noData:"No published dimensions available. Manual entry remains enabled.",
    onlySource:"Published-source geometry only; standard and theoretical mass are calculated separately.",
    more:"Narrow your search for more results.",applied:"Size applied"},
  de:{title:"Abmessung finden",subtitle:"Veröffentlichte Maße · Schnellauswahl",
    search:"Abmessungen suchen",placeholder:"z. B. 168,3x6,3 · 100x100x4",
    all:"Alle",round:"Rund",square:"Quadrat",rect:"Rechteck",wall:"Wanddicke",
     filters:"Maßfilter",enterHint:"Enter zum Übernehmen",
    results:"passende Maße",apply:"Übernehmen",empty:"Keine Treffer. Filter anpassen oder Maße manuell eingeben.",
    noData:"Keine veröffentlichten Maße verfügbar. Manuelle Eingabe bleibt möglich.",
    onlySource:"Geometrie aus veröffentlichter Quelle; Norm und theoretische Masse werden separat berechnet.",
    more:"Suche verfeinern für weitere Treffer.",applied:"Maß übernommen"},
  fr:{title:"Trouver une dimension",subtitle:"Dimensions publiées · sélection rapide",
    search:"Rechercher une dimension",placeholder:"ex. 168,3x6,3 · 100x100x4",
    all:"Toutes",round:"Ronds",square:"Carrés",rect:"Rectangulaires",wall:"Épaisseur",
     filters:"Filtres de dimensions",enterHint:"Entrée pour utiliser",
    results:"dimensions trouvées",apply:"Utiliser",empty:"Aucun résultat. Modifiez les filtres ou saisissez les dimensions.",
    noData:"Aucune dimension publiée disponible. La saisie manuelle reste possible.",
    onlySource:"Géométrie issue d'une source publiée ; norme et masse théorique calculées séparément.",
    more:"Affinez la recherche pour afficher d'autres résultats.",applied:"Dimension appliquée"},
  es:{title:"Buscar una medida",subtitle:"Medidas publicadas · selección rápida",
    search:"Buscar dimensiones",placeholder:"p. ej. 168,3x6,3 · 100x100x4",
    all:"Todas",round:"Redondos",square:"Cuadrados",rect:"Rectangulares",wall:"Espesor",
     filters:"Filtros de medidas",enterHint:"Intro para aplicar",
    results:"medidas encontradas",apply:"Usar medida",empty:"Sin resultados. Ajusta los filtros o introduce las medidas.",
    noData:"No hay medidas publicadas. La introducción manual sigue disponible.",
    onlySource:"Geometría de una fuente publicada; la norma y el peso teórico se calculan por separado.",
    more:"Afina la búsqueda para ver más resultados.",applied:"Medida aplicada"},
};

function ShapePreview({item,compact=false}:{item:CalculatorDimension;compact?:boolean}) {
  const a=item.primaryMm,b=item.secondaryMm,t=item.thicknessMm;
  const width=66, height=item.family==="rectangular_tube" ? Math.max(20,Math.min(66,66*b/a)) : 60;
  const wall=Math.min(14,Math.max(2,Math.min(width/2,height/2)*t/Math.min(a,b)));
  return <svg viewBox="0 0 92 72" aria-hidden="true" className={compact ? "h-6 w-7 shrink-0" : "h-[3.25rem] w-[4.5rem] shrink-0"}>
    {item.family==="round_tube" ? <>
      <circle cx="46" cy="36" r="28" fill="#dbeee4" stroke="#1c5746" strokeWidth="2"/>
      <circle cx="46" cy="36" r={Math.max(2,28-wall)} fill="#fff" stroke="#93bca8" strokeWidth="1"/>
    </> : <>
      <rect x={(92-width)/2} y={(72-height)/2} width={width} height={height} rx="6" fill="#dbeee4" stroke="#1c5746" strokeWidth="2"/>
      <rect x={(92-width)/2+wall} y={(72-height)/2+wall}
        width={Math.max(1,width-2*wall)} height={Math.max(1,height-2*wall)} rx="3" fill="white" stroke="#93bca8" strokeWidth="1"/>
    </>}
  </svg>;
}

/** A client-only deterministic selector. It never saves/sends a line or changes a standard. */
export function CalculatorDimensionDiscovery({
  items, locale, onChoose, compact = false,
}: {
  items:CalculatorDimension[];
  locale:TubeCalculatorLocale;
  onChoose:(item:CalculatorDimension)=>void;
  compact?:boolean;
}) {
  const c=copy[locale];
  const familyGroupName=useId();
  const rootRef=useRef<HTMLElement>(null);
  const [query,setQuery]=useState("");
  const [family,setFamily]=useState<DimensionFamilyFilter>("all");
  const [wall,setWall]=useState<"all"|number>("all");
  const [selected,setSelected]=useState<string|null>(null);
  const [expandedResults,setExpandedResults]=useState(false);
  const [activeIndex,setActiveIndex]=useState(0);
  const resultsId=useId();
  // Floating results dismiss on outside input; no dimensions or standards are saved.
  useEffect(()=>{
    const dismiss=(event:PointerEvent)=>{
      if(event.target instanceof Node && !rootRef.current?.contains(event.target)) setExpandedResults(false);
    };
    document.addEventListener("pointerdown",dismiss);
    return ()=>document.removeEventListener("pointerdown",dismiss);
  },[]);
  const found=useMemo(
    ()=>searchCalculatorDimensions(items,query,family,wall,8),
    [items,query,family,wall]
  );
  const families:[DimensionFamilyFilter,string][]=[
    ["all",c.all],["round_tube",c.round],["square_tube",c.square],["rectangular_tube",c.rect],
  ];
  const activeFilters = family !== "all" || wall !== "all";
  const showResults = expandedResults && (query.trim().length > 0 || activeFilters);
  const chooseDimension = (item: CalculatorDimension) => {
    onChoose(item);
    setSelected(item.id);
    setQuery(dimensionLabel(item));
    setExpandedResults(false);
    setActiveIndex(0);
  };
  return <section ref={rootRef} data-testid="calculator-dimension-discovery" aria-label={c.title}
    className={compact ? "relative min-w-0" : "border-b border-[#d8e8df] bg-[#f6faf8] px-3 py-2 sm:px-4"}>
    <div className={compact ? "sr-only" : "flex flex-wrap items-center justify-between gap-x-3 gap-y-1"}>
      <h2 className="text-xs font-bold text-[#123d34]">{c.title}</h2>
      <span className="text-[11px] text-[#446454]">{c.subtitle}</span>
    </div>
    <div className={compact ? "flex min-w-0 items-start gap-2" : "mt-1.5 flex min-w-0 flex-wrap items-start gap-2 sm:flex-nowrap"}>
      <label className="min-w-0 flex-1 text-[11px] font-semibold text-[#375c4b]">
        <span className="sr-only">{c.search}</span>
        <input type="search" autoComplete="off" value={query}
          onChange={event=>{setQuery(event.target.value);setActiveIndex(0);setExpandedResults(true);}}
          onFocus={()=>{if(query.trim())setExpandedResults(true);}}
          onKeyDown={event=>{
            if(event.key==="ArrowDown" && found.results.length && showResults){
              event.preventDefault();
              setActiveIndex(index=>Math.min(found.results.length-1,index+1));
            } else if(event.key==="ArrowUp" && found.results.length && showResults){
              event.preventDefault();
              setActiveIndex(index=>Math.max(0,index-1));
            } else if(event.key==="Enter" && query.trim() && found.results.length){
              event.preventDefault();
              chooseDimension(found.results[Math.min(activeIndex,found.results.length-1)]);
            } else if(event.key==="Escape") {
              setExpandedResults(false);
            }
          }}
          placeholder={c.placeholder}
          role="searchbox" aria-autocomplete="list"
          aria-controls={showResults && found.matchCount>0 ? resultsId : undefined}
          aria-activedescendant={compact && showResults && found.matchCount>0 ? resultsId+"-item-"+Math.min(activeIndex,found.results.length-1) : undefined}
          aria-describedby={resultsId+"-hint"}
          className="min-h-11 w-full min-w-0 rounded-lg border border-[#b8d6c8] bg-white px-3 text-sm text-[#173e30] outline-none focus-visible:ring-2 focus-visible:ring-[#1f6b5a] sm:min-h-10"/>
      </label>
      <details className={compact ? "group/filter relative min-w-0 shrink-0" : "group/filter w-full shrink-0 sm:w-auto"}>
        <summary className={compact ? "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-[#b8d6c8] bg-white px-2 text-[11px] font-semibold text-[#23513e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16714c]" : "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-[#b8d6c8] bg-white px-3 text-xs font-semibold text-[#23513e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16714c] sm:min-h-10"}>
          {c.filters}{activeFilters ? " · 1+" : ""}<span aria-hidden="true" className="transition-transform group-open/filter:rotate-180">⌄</span>
        </summary>
        <div className={compact ? "absolute right-0 top-[calc(100%+5px)] z-[80] w-[min(330px,calc(100vw-24px))] space-y-2 rounded-lg border border-[#c5dacd] bg-white p-2 shadow-[0_12px_28px_rgba(12,42,29,.18)]" : "mt-1.5 space-y-2 rounded-lg border border-[#d0e2d7] bg-white p-2"}>
          <div role="group" aria-label={c.title} className="flex max-w-full gap-1 overflow-x-auto">
            {families.map(([value,label])=><label key={value}
              className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-lg border px-2.5 text-[11px] font-semibold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#16714c] ${family===value
                ?"border-[#123d34] bg-[#123d34] text-white"
                :"border-[#bfd9cc] bg-white text-[#20513e] hover:bg-[#e2f2e8]"}`}>
              <input type="radio" name={familyGroupName} value={value} checked={family===value}
                onChange={()=>{setFamily(value);setWall("all");setExpandedResults(true);}} className="sr-only"/>
              {label}
            </label>)}
          </div>
          <label className="flex items-center gap-2 text-[11px] font-semibold text-[#375c4b]">
            {c.wall}
            <select value={wall} onChange={event=>{setWall(event.target.value==="all"?"all":Number(event.target.value));setExpandedResults(true);}}
              className="min-h-10 flex-1 rounded-lg border border-[#b8d6c8] bg-white px-2 text-xs text-[#173e30] focus-visible:ring-2 focus-visible:ring-[#1f6b5a]">
              <option value="all">{c.all}</option>
              {found.thicknesses.map(x=><option key={x} value={x}>{dimensionNumber(x)} mm</option>)}
            </select>
          </label>
        </div>
      </details>
    </div>
    <span id={resultsId+"-hint"} className="sr-only">{c.enterHint}</span>
    {showResults ? <div data-dense-discovery-popover className={compact ? "absolute left-0 top-[calc(100%+6px)] z-[70] w-[min(410px,calc(100vw-24px))] max-w-[calc(100vw-24px)] rounded-xl border border-[#bad6c5] bg-white p-1.5 shadow-[0_16px_36px_rgba(12,42,29,.2)]" : "mt-1.5 rounded-lg border border-[#d0e2d7] bg-white p-2"}>
      <p role="status" aria-live="polite" className={compact ? "flex min-h-6 items-center px-2 text-[10px] font-semibold text-[#476854]" : "mt-1.5 text-[11px] text-[#446454]"}>
        {found.matchCount} {c.results} · {c.enterHint}
      </p>
      {items.length===0 ? <p className="mt-1 text-xs text-[#52695d]">{c.noData}</p> :
        found.matchCount===0 ? <p className="mt-1 text-xs text-[#52695d]">{c.empty}</p> :
        <div id={resultsId} role="listbox" aria-label={c.title} className={compact ? "mt-0.5 grid max-h-[184px] grid-cols-1 gap-0.5 overflow-y-auto overscroll-contain" : "mt-1 grid max-h-[176px] grid-cols-1 gap-1 overflow-y-auto overscroll-contain"}>
          {found.results.map((item,index)=><button key={[item.family,item.primaryMm,item.secondaryMm,item.thicknessMm].join(":")}
            id={resultsId+"-item-"+index} role="option" aria-selected={index===activeIndex}
            type="button" onMouseEnter={()=>setActiveIndex(index)} onClick={()=>chooseDimension(item)}
            aria-label={`${c.apply}: ${dimensionLabel(item)}`}
            className={compact ? `flex min-h-11 items-center gap-2 rounded-md border px-2 py-1 text-left text-[#173e30] outline-none transition-colors sm:min-h-[38px] ${index===activeIndex ? "border-[#9cc5ae] bg-[#edf7f1]" : "border-transparent bg-white hover:border-[#d0e2d7] hover:bg-[#f1f8f4]"} focus-visible:ring-2 focus-visible:ring-[#16714c]` : "flex min-h-11 items-center gap-2 rounded-lg border border-[#d0e2d7] bg-white px-2 py-1 text-left text-[#173e30] hover:border-[#237455] hover:bg-[#eef7f2] focus-visible:outline-2 focus-visible:outline-[#16714c]"}>
            <span className={compact ? "flex size-7 shrink-0 items-center justify-center rounded-md bg-[#f2f8f4]" : "flex h-9 w-11 shrink-0 items-center justify-center overflow-hidden"}><ShapePreview item={item} compact={compact}/></span>
            <span className="min-w-0 flex-1">
              <strong className={compact ? "block truncate text-[12px] font-bold leading-4" : "block text-xs font-bold"}>{dimensionLabel(item)}</strong>
              <span className={compact ? "block truncate text-[10px] leading-3 text-[#60786b]" : "block truncate text-[11px] text-[#597263]"} title={item.source}>{item.source}</span>
            </span>
            <span aria-hidden="true" className="shrink-0 text-[11px] text-[#21674c]">↵</span>
          </button>)}
        </div>}
      {found.matchCount>found.results.length ? <p className="mt-1 text-[11px] text-[#5c7367]">{c.more}</p>:null}
      <p className={compact ? "mt-1 border-t border-[#e7eee9] px-1.5 pt-1.5 text-[10px] leading-4 text-[#536b5d]" : "mt-1 text-[11px] leading-4 text-[#536b5d]"}>{c.onlySource}</p>
    </div> : null}
    <p className="sr-only" aria-live="polite">{selected ? c.applied : ""}</p>
  </section>;
}
