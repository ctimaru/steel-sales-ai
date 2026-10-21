"use client";

import { useMemo, useState } from "react";
import {
  dimensionLabel, dimensionNumber, searchCalculatorDimensions,
  type CalculatorDimension, type DimensionFamilyFilter,
} from "@/lib/calculator-dimension-discovery";
import type { TubeCalculatorLocale } from "@/lib/tube-calculator-locale";

const copy: Record<TubeCalculatorLocale,{
  title:string;subtitle:string;search:string;placeholder:string;all:string;round:string;square:string;rect:string;
  wall:string;results:string;apply:string;empty:string;noData:string;onlySource:string;more:string;applied:string;
}> = {
  it:{title:"Trova la tua misura",subtitle:"Misure pubblicate · selezione rapida",
    search:"Cerca dimensione",placeholder:"Es. 168,3x6,3 · 100x100x4",
    all:"Tutte",round:"Tondi",square:"Quadri",rect:"Rettangolari",wall:"Spessore",
    results:"misure trovate",apply:"Usa misura",empty:"Nessun risultato: modifica i filtri o inserisci le misure manualmente.",
    noData:"Nessuna misura pubblicata disponibile. La compilazione manuale resta attiva.",
    onlySource:"Misura tratta da fonte pubblicata; la norma e il peso teorico vengono calcolati separatamente.",
    more:"Affina la ricerca per altri risultati.",applied:"Selezione applicata"},
  en:{title:"Find your size",subtitle:"Published dimensions · quick selection",
    search:"Search dimensions",placeholder:"e.g. 168.3x6.3 · 100x100x4",
    all:"All",round:"Round",square:"Square",rect:"Rectangular",wall:"Wall",
    results:"matching sizes",apply:"Use size",empty:"No matches. Adjust filters or enter dimensions manually.",
    noData:"No published dimensions available. Manual entry remains enabled.",
    onlySource:"Published-source geometry only; standard and theoretical mass are calculated separately.",
    more:"Narrow your search for more results.",applied:"Size applied"},
  de:{title:"Abmessung finden",subtitle:"Veröffentlichte Maße · Schnellauswahl",
    search:"Abmessungen suchen",placeholder:"z. B. 168,3x6,3 · 100x100x4",
    all:"Alle",round:"Rund",square:"Quadrat",rect:"Rechteck",wall:"Wanddicke",
    results:"passende Maße",apply:"Übernehmen",empty:"Keine Treffer. Filter anpassen oder Maße manuell eingeben.",
    noData:"Keine veröffentlichten Maße verfügbar. Manuelle Eingabe bleibt möglich.",
    onlySource:"Geometrie aus veröffentlichter Quelle; Norm und theoretische Masse werden separat berechnet.",
    more:"Suche verfeinern für weitere Treffer.",applied:"Maß übernommen"},
  fr:{title:"Trouver une dimension",subtitle:"Dimensions publiées · sélection rapide",
    search:"Rechercher une dimension",placeholder:"ex. 168,3x6,3 · 100x100x4",
    all:"Toutes",round:"Ronds",square:"Carrés",rect:"Rectangulaires",wall:"Épaisseur",
    results:"dimensions trouvées",apply:"Utiliser",empty:"Aucun résultat. Modifiez les filtres ou saisissez les dimensions.",
    noData:"Aucune dimension publiée disponible. La saisie manuelle reste possible.",
    onlySource:"Géométrie issue d'une source publiée ; norme et masse théorique calculées séparément.",
    more:"Affinez la recherche pour afficher d'autres résultats.",applied:"Dimension appliquée"},
  es:{title:"Buscar una medida",subtitle:"Medidas publicadas · selección rápida",
    search:"Buscar dimensiones",placeholder:"p. ej. 168,3x6,3 · 100x100x4",
    all:"Todas",round:"Redondos",square:"Cuadrados",rect:"Rectangulares",wall:"Espesor",
    results:"medidas encontradas",apply:"Usar medida",empty:"Sin resultados. Ajusta los filtros o introduce las medidas.",
    noData:"No hay medidas publicadas. La introducción manual sigue disponible.",
    onlySource:"Geometría de una fuente publicada; la norma y el peso teórico se calculan por separado.",
    more:"Afina la búsqueda para ver más resultados.",applied:"Medida aplicada"},
};

function ShapePreview({item}:{item:CalculatorDimension}) {
  const a=item.primaryMm,b=item.secondaryMm,t=item.thicknessMm;
  const width=66, height=item.family==="rectangular_tube" ? Math.max(20,Math.min(66,66*b/a)) : 60;
  const wall=Math.min(14,Math.max(2,Math.min(width/2,height/2)*t/Math.min(a,b)));
  return <svg viewBox="0 0 92 72" aria-hidden="true" className="h-[3.25rem] w-[4.5rem] shrink-0">
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
  items, locale, onChoose,
}: {
  items:CalculatorDimension[];
  locale:TubeCalculatorLocale;
  onChoose:(item:CalculatorDimension)=>void;
}) {
  const c=copy[locale];
  const [query,setQuery]=useState("");
  const [family,setFamily]=useState<DimensionFamilyFilter>("all");
  const [wall,setWall]=useState<"all"|number>("all");
  const [selected,setSelected]=useState<string|null>(null);
  const found=useMemo(
    ()=>searchCalculatorDimensions(items,query,family,wall,8),
    [items,query,family,wall]
  );
  const families:[DimensionFamilyFilter,string][]=[
    ["all",c.all],["round_tube",c.round],["square_tube",c.square],["rectangular_tube",c.rect],
  ];
  return <section data-testid="calculator-dimension-discovery" aria-label={c.title}
    className="border-b border-[#d8e8df] bg-[#f5faf7] px-3 py-3 sm:px-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#28634c]">{c.subtitle}</p>
        <h2 className="mt-1 text-sm font-extrabold text-[#123d34]">{c.title}</h2>
      </div>
      <span role="status" aria-live="polite" className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#245640]">
        {found.matchCount} {c.results}
      </span>
    </div>
    <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(130px,170px)]">
      <label className="min-w-0 text-[11px] font-semibold text-[#375c4b]">
        {c.search}
        <input type="search" autoComplete="off" value={query} onChange={event=>setQuery(event.target.value)}
          placeholder={c.placeholder}
          className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-[#b8d6c8] bg-white px-3 text-sm text-[#173e30] outline-none focus-visible:ring-2 focus-visible:ring-[#1f6b5a]"/>
      </label>
      <label className="text-[11px] font-semibold text-[#375c4b]">
        {c.wall}
        <select value={wall} onChange={event=>setWall(event.target.value==="all"?"all":Number(event.target.value))}
          className="mt-1 min-h-11 w-full rounded-xl border border-[#b8d6c8] bg-white px-3 text-sm text-[#173e30] focus-visible:ring-2 focus-visible:ring-[#1f6b5a]">
          <option value="all">{c.all}</option>
          {found.thicknesses.map(x=><option key={x} value={x}>{dimensionNumber(x)} mm</option>)}
        </select>
      </label>
    </div>
    <div role="group" aria-label={c.title} className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
      {families.map(([value,label])=><button key={value} type="button" aria-pressed={family===value}
        onClick={()=>{setFamily(value);setWall("all");}}
        className={`min-h-10 shrink-0 rounded-xl border px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16714c] ${family===value
          ?"border-[#123d34] bg-[#123d34] text-white"
          :"border-[#bfd9cc] bg-white text-[#20513e] hover:bg-[#e2f2e8]"}`}>{label}</button>)}
    </div>
    {items.length===0 ? <p className="mt-2 text-xs text-[#52695d]">{c.noData}</p> :
      found.matchCount===0 ? <p role="status" className="mt-2 text-xs text-[#52695d]">{c.empty}</p> :
      <div className="mt-2 grid max-h-[210px] grid-cols-1 gap-1.5 overflow-y-auto overscroll-contain sm:grid-cols-2">
        {found.results.map(item=><button key={[item.family,item.primaryMm,item.secondaryMm,item.thicknessMm].join(":")}
          type="button" onClick={()=>{onChoose(item);setSelected(item.id);}}
          aria-label={`${c.apply}: ${dimensionLabel(item)}`}
          className="group flex min-h-16 items-center gap-2 rounded-xl border border-[#d0e2d7] bg-white p-2 text-left text-[#173e30] hover:border-[#237455] hover:bg-[#eef7f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16714c]">
          <ShapePreview item={item}/>
          <span className="min-w-0 flex-1">
            <strong className="block text-[12px] font-extrabold">{dimensionLabel(item)}</strong>
            <span className="block truncate text-[10px] text-[#597263]" title={item.source}>{item.source}</span>
          </span>
          <span aria-hidden="true" className="text-[#21674c]">↗</span>
        </button>)}
      </div>
    }
    {found.matchCount>found.results.length ? <p className="mt-1 text-[11px] text-[#5c7367]">{c.more}</p>:null}
    <p className="mt-2 text-[10px] leading-4 text-[#536b5d]">{c.onlySource}</p>
    <p className="sr-only" aria-live="polite">{selected ? c.applied : ""}</p>
  </section>;
}
