"use client";

import {useState,type ReactNode} from "react";
import Link from "next/link";
import {networkCountryName} from "@/lib/network-eu-countries";
import type {NetworkProAccess,NetworkProCoverage} from "@/lib/network-pro-coverage";
import {
  NETWORK_PRO_ANNUAL_DISCOUNT_PERCENT,
  NETWORK_PRO_MODULES,
  networkProQuote,
  type NetworkProModuleKey,
  type NetworkProTerritory,
} from "@/lib/network-pro-catalog";

const euro = new Intl.NumberFormat("it-IT", {style:"currency",currency:"EUR",maximumFractionDigits:0});
const orderedModules:NetworkProModuleKey[]=["producers","distributors","processors","end_users"];
type IconName="cursor"|"card"|"bolt"|"globe"|"calendar"|"layers"|"factory"|"truck"|"tools"|"gear"|"building"|"check"|"shield"|"arrow"|"chart"|"database"|"lock"|"info"|"spark"|"receipt";

function Icon({name,size=20,className=""}:{name:IconName;size?:number;className?:string}){
  const paths:Record<IconName,ReactNode>={
    cursor:<><path d="m4 3 7 17 2.4-6.6L20 11 4 3Z"/><path d="m13.4 13.4 4.8 4.8"/></>,
    card:<><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3 10h18M7 15h4"/></>,
    bolt:<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>,
    globe:<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>,
    calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
    layers:<><path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/></>,
    factory:<><path d="M3 21V10l6 4V9l6 4V3l6 3v15H3Z"/><path d="M7 18h.01M12 18h.01M17 18h.01"/></>,
    truck:<><path d="M3 5h11v11H3zM14 9h4l3 4v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    tools:<><path d="m4 20 8-8M9 4l4 4-5 5-4-4M14 11l7 7-3 3-7-7M15 3a5 5 0 0 0 6 6l-4 4-6-6 4-4Z"/></>,
    gear:<><path d="M10 2h4l.7 2.2 2 .9 2.1-1.1 2.8 2.8-1.1 2.1.9 2L23 11v4l-2.2.7-.9 2 1.1 2.1-2.8 2.8-2.1-1.1-2 .9L14 23h-4l-.7-2.2-2-.9-2.1 1.1-2.8-2.8 1.1-2.1-.9-2L1 15v-4l2.2-.7.9-2L3 6.2 5.8 3.4l2.1 1.1 2-.9L10 2Z" transform="translate(1 -1) scale(.9)"/><circle cx="12" cy="12" r="3"/></>,
    building:<><path d="M4 21V4h12v17M16 11h4v10M2 21h20"/><path d="M8 8h1M12 8h1M8 12h1M12 12h1M8 16h1M12 16h1"/></>,
    check:<path d="m5 12 4 4L19 6"/>,
    shield:<><path d="m12 2 9 4v6c0 6-4 9-9 10-5-1-9-4-9-10V6l9-4Z"/><path d="m8 12 3 3 5-6"/></>,
    arrow:<><path d="M4 12h16m-7-7 7 7-7 7"/></>,
    chart:<><path d="M4 20V12m6 8V7m6 13v-9m4 9V4"/></>,
    database:<><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/></>,
    lock:<><rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v3"/></>,
    info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
    spark:<><path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z"/></>,
    receipt:<><path d="M5 2h14v20l-3-2-4 2-4-2-3 2V2Z"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
    strokeLinejoin="round" className={className}>{paths[name]}</svg>;
}

function territoryCopy(territory:NetworkProTerritory){
  return territory==="IT"?"Italia":"Paesi europei censiti";
}

export function NetworkProCatalog({coverage,access}:{coverage:NetworkProCoverage|null;access:NetworkProAccess|null}){
  const [territory,setTerritory]=useState<NetworkProTerritory>("IT");
  const [billing,setBilling]=useState<"monthly"|"annual">("monthly");
  const [selected,setSelected]=useState<NetworkProModuleKey[]>(["producers","distributors"]);
  const [coverageExpanded,setCoverageExpanded]=useState(false);
  const quote=networkProQuote(selected,territory,billing);
  const countries=coverage?.countries.filter(row=>territory==="EU"||row.countryCode==="IT")??[];
  const publishedTerritory=coverage?countries.reduce((total,country)=>total+country.published,0):null;
  const selectedModules=orderedModules.map(key=>NETWORK_PRO_MODULES.find(m=>m.key===key)!)
    .filter(module=>selected.includes(module.key));

  // NET-PRO-UX3: live totals for the hero (published only) and the access state in one place.
  const italyPublished=coverage?coverage.countries.find(row=>row.countryCode==="IT")?.published??0:null;
  const europePublished=coverage?coverage.countries.reduce((sum,row)=>sum+row.published,0):null;
  const activeModules=access?orderedModules.filter(key=>access.modules[key].italy||access.modules[key].europe):[];
  const hasActiveAccess=Boolean(access&&(access.legacyFullNetwork||activeModules.length>0));
  const annualSaving=billing==="annual"?Math.max(0,quote.monthlyBase*12-quote.annualTotal):0;
  // Marginal price of adding a module to the current selection (package pricing).
  function addPrice(key:NetworkProModuleKey){
    const next=networkProQuote([...selected,key],territory,"monthly").monthlyBase;
    return next-networkProQuote(selected,territory,"monthly").monthlyBase;
  }
  const allSelected=orderedModules.every(key=>selected.includes(key));

  function toggle(key:NetworkProModuleKey){
    setSelected(current=>current.includes(key)
      ?current.filter(entry=>entry!==key)
      :[...current,key]);
  }
  const controls = (kind:"territory"|"billing")=>{
    if(kind==="territory")return <div role="group" aria-label="Copertura geografica"
      className="grid grid-cols-2 rounded-xl border border-[#cfddd4] bg-[#f4f8f5] p-1">
      {([{key:"IT",title:"Italia"},{key:"EU",title:"Europa"}] as const).map(area=>
        <button key={area.key} type="button" aria-pressed={territory===area.key}
          onClick={()=>setTerritory(area.key)}
          className={"min-h-10 rounded-lg px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] "+
            (territory===area.key?"bg-[#145640] text-white shadow-sm":"text-[#244638] hover:bg-white")}>
          {area.title}
        </button>)}
    </div>;
    return <div role="group" aria-label="Periodicità abbonamento"
      className="grid grid-cols-2 rounded-xl border border-[#cfddd4] bg-[#f4f8f5] p-1">
      {([{key:"monthly",title:"Mensile"},{key:"annual",title:"Annuale"}] as const).map(item=>
        <button key={item.key} type="button" aria-pressed={billing===item.key}
          onClick={()=>setBilling(item.key)}
          className={"min-h-10 rounded-lg px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] "+
            (billing===item.key?"bg-[#145640] text-white shadow-sm":"text-[#244638] hover:bg-white")}>
          {item.title}
        </button>)}
    </div>;
  };

  return <main className="mx-auto w-full max-w-[1400px] min-w-0 space-y-5 pb-[164px] sm:pb-[155px] lg:pb-12"
    data-testid="network-pro-catalog">
    <nav aria-label="Percorso Network" className="px-1 text-xs">
      <Link href="/network" className="font-semibold text-[#256347] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
        ← Torna al Network
      </Link>
    </nav>

    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_350px] xl:gap-8">
      <div className="min-w-0 space-y-5">
        <header className="relative overflow-hidden rounded-[24px] bg-[#123a2e] p-5 text-white shadow-[0_14px_34px_rgba(18,58,46,0.2)] sm:p-7">
          <svg aria-hidden="true" width="260" height="260" viewBox="0 0 260 260" className="pointer-events-none absolute -right-16 -top-20 opacity-[0.12]">
            <circle cx="130" cy="130" r="110" fill="none" stroke="#9fd3bc" strokeWidth="22"/>
            <circle cx="130" cy="130" r="64" fill="none" stroke="#9fd3bc" strokeWidth="14"/>
          </svg>
          <div className="relative space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 uppercase tracking-[0.08em]">
                Network <span className="rounded-[4px] bg-[#f2b544] px-1 py-px text-[9px] text-[#3a2600]">PRO</span>
              </span>
              <span className="rounded-full border border-white/20 px-3 py-1.5 uppercase tracking-[0.06em] text-[#cfe6db]">Catalogo aziende</span>
              {hasActiveAccess?<span data-testid="netpro-ux3-active-access" className="rounded-full bg-[#e6f3ec] px-3 py-1.5 text-[#155a3c]">
                ✓ Il tuo accesso PRO è attivo
              </span>:null}
            </div>
            <h1 className="max-w-[760px] text-[26px] font-extrabold leading-[1.14] tracking-[-0.035em] sm:text-[34px] xl:text-[38px]">
              Sblocca i contatti industriali che ti servono.
            </h1>
            <p className="max-w-[720px] text-[13px] leading-5 text-[#d3e7dd] sm:text-sm sm:leading-6">
              Configura il tuo accesso al Network dell&apos;acciaio: produttori, commercianti,
              carpenterie e utilizzatori industriali, con copertura reale per Paese.
            </p>
            <dl className="grid max-w-[560px] grid-cols-3 gap-2 pt-1" data-testid="netpro-ux3-hero-stats">
              {[
                {label:"aziende pubblicate in Italia",value:italyPublished},
                {label:"nei Paesi europei censiti",value:europePublished},
                {label:"moduli da combinare",value:4},
              ].map(stat=><div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
                <dd className="text-[22px] font-extrabold leading-7 tabular-nums text-[#f2b544]">{stat.value===null?"—":stat.value.toLocaleString("it-IT")}</dd>
                <dt className="text-[10.5px] leading-[14px] text-[#cfe6db]">{stat.label}</dt>
              </div>)}
            </dl>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/network/pro/producers"
                className="inline-flex min-h-10 items-center rounded-xl bg-[#f2b544] px-4 text-xs font-extrabold text-[#2a1c00] hover:bg-[#f6c460] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2b544]">
                Esplora Intelligence Produttori →
              </Link>
              {hasActiveAccess?<Link href="/network"
                className="inline-flex min-h-10 items-center rounded-xl border border-white/30 px-4 text-xs font-bold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Apri il Network
              </Link>:null}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-1.5 rounded-[18px] bg-[linear-gradient(120deg,#eef6f0,#f7faf8)] p-2.5 sm:gap-3 sm:p-3"
          aria-label="Come funziona l'abbonamento">
          {([
            {icon:"cursor" as const,title:"1. Seleziona",description:"Scegli i moduli"},
            {icon:"card" as const,title:"2. Paga",description:"Checkout in arrivo"},
            {icon:"bolt" as const,title:"3. Accedi subito",description:"Pagamento verificato"},
          ]).map(step=><div key={step.title} className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#deeee2] text-[#17583e] sm:h-11 sm:w-11">
              <Icon name={step.icon} size={20}/>
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-bold leading-4 text-[#162d23] sm:text-[12px]">{step.title}</span>
              <span className="hidden text-[10px] leading-4 text-[#5c6b60] sm:block">{step.description}</span>
            </span>
          </div>)}
        </div>

        <section aria-label="Configura il tuo Network PRO" className="grid gap-4 sm:grid-cols-2 sm:gap-6">
          <div className="min-w-0 space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#18372a]">
              <Icon name="globe" size={19}/> Territorio
              <span className="text-[#778e7e]" title="Europa comprende solo i Paesi effettivamente censiti"><Icon name="info" size={14}/></span>
            </h2>
            {controls("territory")}
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-1">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[#18372a]">
                <Icon name="calendar" size={19}/> Periodicità
              </h2>
              <span className="rounded-full bg-[#e4f3e6] px-2 py-0.5 text-[10px] font-semibold text-[#286646]">
                -{NETWORK_PRO_ANNUAL_DISCOUNT_PERCENT}% annuale indicativo
              </span>
            </div>
            {controls("billing")}
          </div>
        </section>

        <section aria-labelledby="network-pro-modules-title" className="space-y-3">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h2 id="network-pro-modules-title" className="flex items-center gap-2 text-base font-extrabold text-[#142f23] sm:text-lg">
              <Icon name="layers" size={21}/> Seleziona i moduli di tuo interesse
            </h2>
            <span className="flex items-center gap-2 text-[11px] font-semibold text-[#477460]">
              {selected.length} di 4 selezionati
              <button type="button" onClick={()=>setSelected(allSelected?[]:[...orderedModules])}
                data-testid="netpro-ux3-select-all"
                className="min-h-8 rounded-lg border border-[#c9dbcf] bg-white px-2.5 text-[11px] font-bold text-[#175640] hover:bg-[#eef6f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
                {allSelected?"Deseleziona tutti":"Tutta la filiera · 4 moduli"}
              </button>
            </span>
          </div>
          {selected.length===0?<p className="text-xs font-semibold text-[#775d36]" role="status">
            Seleziona almeno un modulo per configurare l&apos;abbonamento.
          </p>:null}
          <div className="grid gap-3 sm:grid-cols-2">
            {orderedModules.map(key=>{
              const module=NETWORK_PRO_MODULES.find(m=>m.key===key)!;
              const active=selected.includes(module.key);
              const publishedInTerritory = coverage
                ? countries.reduce((total, country) => total + country.publishedModules[module.key], 0)
                : null;
              const iconName:IconName=key==="producers"?"factory":key==="distributors"?"truck":key==="processors"?"tools":"gear";
              return <button key={module.key} type="button" aria-pressed={active}
                aria-label={(active?"Rimuovi":"Aggiungi")+" modulo "+module.title}
                onClick={()=>toggle(module.key)}
                data-testid={"network-pro-module-"+module.key}
                className={"group flex min-h-[160px] min-w-0 flex-col rounded-2xl border px-3.5 py-3.5 text-left shadow-[0_5px_15px_rgba(17,65,47,0.045)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] sm:min-h-[183px] sm:px-4 sm:py-4 "+
                  (active?"border-[#2b7955] bg-[#f0f8f2] ring-1 ring-[#c1deca]":"border-[#dce4de] bg-white hover:border-[#97bba5] hover:bg-[#f8faf8]")}>
                <div className="flex items-start gap-3">
                  <span className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-xl "+
                    (active?"bg-[#dceee1] text-[#176342]":"bg-[#eff4f0] text-[#386751]")}>
                    <Icon name={iconName} size={24}/>
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-extrabold leading-5 text-[#142b20]">
                      {module.title}
                      <span className={"text-[11px] font-bold "+(active?"text-[#176342]":"text-[#6e4400]")} data-testid={"netpro-ux3-add-price-"+module.key}>
                        {active?"incluso":"+ "+euro.format(addPrice(module.key))+" / mese"}
                      </span>
                    </h3>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#3f6b56]">{module.audience}</p>
                    <p className="mt-1 text-[11px] leading-[17px] text-[#4f6356] sm:text-[12px]">
                      {module.description}
                    </p>
                    <p className="mt-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] italic leading-4 text-[#365746] ring-1 ring-[#e1ebe4]">
                      «{module.example}»
                    </p>
                  </div>
                  <span aria-hidden="true" className={"flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-md border "+
                    (active?"border-[#176042] bg-[#176042] text-white":"border-[#b5c9bc] bg-white text-transparent")}>
                    {active?<Icon name="check" size={17}/>:null}
                  </span>
                </div>
                <div className="mt-auto flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-[#dce9df] pt-2.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#1d3b2c]"
                    data-testid={"netpro1d-live-count-"+module.key}>
                    <Icon name="building" size={15}/>
                    {publishedInTerritory===null
                      ? "Copertura pubblicata non disponibile"
                      : <>
                        <span className="font-bold tabular-nums text-[#173f35]">
                          {publishedInTerritory.toLocaleString("it-IT")}
                        </span>{" "}{publishedInTerritory===1?"profilo pubblicato":"profili pubblicati"}{" "}
                        {territory==="IT"?"in Italia":"nei Paesi europei censiti"}
                      </>}
                  </span>
                  <span className="rounded-full border border-[#cbdcd0] bg-white px-2 py-0.5 text-[9px] font-semibold text-[#356249]">
                    {territory==="IT"?"Copertura Italia":"Copertura Europa"}
                  </span>
                </div>
                <span className="mt-1.5 text-[10px] font-bold text-[#2d6a4c]" data-testid={"netpro1b-license-"+module.key}>
                  {access?(territory==="IT"?access?.modules[module.key].italy:access?.modules[module.key].europe)
                    ?"Accesso PRO attivo":"Accesso PRO non attivo":"Stato accesso non disponibile"}
                </span>
              </button>;
            })}
          </div>
        </section>

        <section className="rounded-[18px] border border-[#dfe8e1] bg-white p-4 sm:p-5" aria-label="Cosa ottieni con Network PRO">
          <h2 className="flex items-center gap-2 text-[14px] font-bold text-[#153a2b]">
            <Icon name="chart" size={20}/> Cosa ottieni con Network PRO
          </h2>
          <ul className="mt-3 grid gap-2.5 text-[12px] leading-5 text-[#405647] sm:grid-cols-2">
            {[
              {title:"Profili e contatti",text:"Consultazione dei profili e dei contatti disponibili, solo dati pubblicati."},
              {title:"Filtri avanzati",text:"Filtri per ruolo industriale, prodotto, capability, mercato e Paese."},
              {title:"Intelligence Produttori",text:"Cataloghi ufficiali, dati tecnici con fonte e confronto fino a 3 aziende (modulo Produttori)."},
              {title:"Lavoro quotidiano",text:"Salva le aziende, connettiti con quelle attive e porta i fornitori nelle tue RFQ."},
            ].map(item=><li key={item.title} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#e7f3e9] text-[#16714b]"><Icon name="check" size={15}/></span>
              <span><strong className="text-[#173f35]">{item.title}</strong> · {item.text}</span>
            </li>)}
          </ul>
          <p className="mt-3 text-[10.5px] leading-4 text-[#637668]">
            Copertura aggiornata con i profili pubblicati; nessuna stima di aziende o contatti disponibili.
          </p>
        </section>
      </div>

      <aside className="hidden min-w-0 lg:sticky lg:top-24 lg:block" aria-label="Configurazione e prezzi Network PRO">
        <div className="overflow-hidden rounded-[22px] border border-[#d8e3da] bg-white p-5 shadow-[0_15px_38px_rgba(25,56,39,0.1)]">
          <h2 className="flex items-center gap-2.5 text-[17px] font-extrabold leading-6 text-[#172c21]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6f2e9] text-[#185a3d]">
              <Icon name="bolt" size={21}/>
            </span>
            Il tuo abbonamento Network PRO
          </h2>
          {hasActiveAccess?<p className="mt-3 rounded-xl bg-[#e9f6ee] px-3 py-2 text-[11.5px] font-semibold leading-5 text-[#155a3c]">
            ✓ Accesso attivo{access?.legacyFullNetwork?" a tutto il Network":activeModules.length?": "+activeModules.map(key=>NETWORK_PRO_MODULES.find(m=>m.key===key)!.title).join(", "):""}.
          </p>:null}
          <div className="mt-4 rounded-xl border border-[#e3eae4] px-3.5 py-1">
            <div className="flex items-center justify-between gap-2 border-b border-[#e8eee9] py-3 text-[12px]">
              <span className="flex items-center gap-2 text-[#44594b]"><Icon name="globe" size={17}/> Territorio</span>
              <strong className="text-[#172a20]">{territoryCopy(territory)}</strong>
            </div>
            <div className="flex items-center justify-between gap-2 py-3 text-[12px]">
              <span className="flex items-center gap-2 text-[#44594b]"><Icon name="calendar" size={17}/> Periodicità</span>
              <strong className="text-[#172a20]">{billing==="annual"?"Annuale":"Mensile"}</strong>
            </div>
          </div>
          <h3 className="mt-5 flex items-center gap-2 text-[13px] font-bold text-[#1e382a]">
            <Icon name="layers" size={18}/> Moduli selezionati ({selected.length})
          </h3>
          <div className="mt-3 min-h-12 space-y-2" aria-live="polite">
            {selectedModules.length===0?<p className="text-xs text-[#7b6653]">Seleziona almeno un modulo.</p>:
              selectedModules.map(m=><div key={m.key} className="flex items-center gap-2 text-[12px] font-semibold text-[#1e3528]">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#e7f3e9] text-[#176342]">
                  <Icon name="check" size={15}/>
                </span>
                <span className="flex-1">{m.title}</span>
              </div>)}
          </div>
          <div className="mt-5 space-y-2 border-t border-[#e2e9e2] pt-4 text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[#4c6154]">Pacchetto {quote.count} {quote.count===1?"modulo":"moduli"}</span>
              <strong className="tabular-nums text-[#223a2a]">{euro.format(quote.monthlyBase)} / mese</strong>
            </div>
            {billing==="annual"?<div className="flex justify-between gap-2 text-[#376a4c]">
              <span>Sconto annuo indicativo</span><strong>-{NETWORK_PRO_ANNUAL_DISCOUNT_PERCENT}%</strong>
            </div>:null}
            {annualSaving>0?<div className="flex justify-between gap-2 font-semibold text-[#155a3c]" data-testid="netpro-ux3-annual-saving">
              <span>Risparmio indicativo</span><strong className="tabular-nums">{euro.format(annualSaving)} / anno</strong>
            </div>:null}
            <div className="flex justify-between gap-2 text-[#6b796f]">
              <span>Imposte</span><span>Calcolate al checkout</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#edf5ef] px-3 py-4">
            <span className="text-[12px] font-bold text-[#1b3a29]">Totale indicativo</span>
            <div className="text-right">
              <p data-testid="network-pro-price" className="text-[24px] font-extrabold tabular-nums leading-7 text-[#102c20]">
                {euro.format(quote.displayedTotal)}
              </p>
              <span className="text-[10px] text-[#536b59]">{billing==="annual"?"/ anno":"/ mese"} · IVA esclusa</span>
            </div>
          </div>
          <div className="mt-5 space-y-3 border-t border-[#e7eee8] pt-4">
            {[
              {icon:"bolt" as const,title:"Attivazione automatica",body:"Dopo conferma del pagamento."},
              {icon:"shield" as const,title:"Checkout sicuro",body:"Pagamento gestito dal provider."},
              {icon:"gear" as const,title:"Gestione autonoma",body:"Rinnovo e disdetta dal profilo."},
            ].map(item=><div key={item.title} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#edf5ef] text-[#1c6345]">
                <Icon name={item.icon} size={20}/>
              </span>
              <div><p className="text-[12px] font-bold text-[#1d3628]">{item.title}</p>
                <p className="text-[11px] leading-4 text-[#68776b]">{item.body}</p></div>
            </div>)}
          </div>
          <button type="button" disabled aria-disabled="true" data-testid="netpro-design1-desktop-checkout"
            title="Checkout Stripe non ancora disponibile"
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#124f39] px-3 text-[14px] font-extrabold text-white opacity-70"
          ><Icon name="lock" size={19}/> Abbonati e sblocca <Icon name="arrow" size={19}/></button>
          <p className="mt-2 rounded-lg bg-[#fff6e3] px-3 py-2 text-center text-[10.5px] leading-4 text-[#6e4a14]">
            Checkout in preparazione. Prezzi proposti, ancora da validare.
            Nessun ordine o pagamento viene creato da questa schermata.
          </p>
          <Link href="/network" className="mt-3 inline-flex min-h-9 w-full items-center justify-center text-xs font-semibold text-[#286d4d] underline">
            Esplora il Network
          </Link>
        </div>
      </aside>
    </div>

    <section className="rounded-[18px] border border-[#dce8df] bg-white p-3.5 sm:p-5"
      data-testid="netpro1b-coverage" aria-label="Copertura reale Network per modulo e Paese">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#17422f]">
            <Icon name="database" size={18}/> Dettaglio della copertura per Paese
          </h2>
          <p className="mt-1 text-[11px] leading-4 text-[#647769]">
            Solo schede pubblicate e ruoli registrati nel database. Le aziende preliminari
            non sono incluse nei numeri e non costituiscono copertura commerciale pronta.
          </p>
        </div>
        <button type="button" aria-expanded={coverageExpanded}
          onClick={()=>setCoverageExpanded(current=>!current)}
          data-testid="netpro-design1-toggle-country-details"
          className="min-h-10 rounded-lg border border-[#c9dbcf] bg-[#f8faf8] px-3 text-[11px] font-bold text-[#275b40] hover:bg-[#eaf4ee]">
          {coverageExpanded?"Nascondi dettagli":"Mostra dettagli"}
        </button>
      </div>
      {!coverage?<p className="mt-3 rounded-xl bg-[#fff7e9] p-3 text-xs text-[#75572e]" role="status">
        Conteggi verificati temporaneamente non disponibili. Non mostriamo valori stimati.
      </p>:null}
      {coverageExpanded&&<div className="mt-4 grid gap-3 lg:grid-cols-2" data-testid="netpro-design1-country-details">
        {countries.map(country=><article key={country.countryCode}
          className="rounded-xl border border-[#e0eae2] bg-[#f8fbf9] p-3"
          data-testid={"netpro1b-country-"+country.countryCode}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#173f35]">
              {networkCountryName(country.countryCode)||country.countryCode}
            </h3>
            <span className="text-[12px] font-bold tabular-nums text-[#174d39]">
              {country.published.toLocaleString("it-IT")} pubblicate
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-[#596d60]">
            {country.classified.toLocaleString("it-IT")} classificate ·{" "}
            {country.unclassified.toLocaleString("it-IT")} senza ruolo ·{" "}
            {country.provisional.toLocaleString("it-IT")} preliminari
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {NETWORK_PRO_MODULES.filter(module=>selected.includes(module.key)).map(module=>{
              const allowed=country.countryCode==="IT"
                ?access?.modules[module.key].italy
                :access?.modules[module.key].europe;
              const count=country.publishedModules[module.key];
              const sourced=country.provisionalModules[module.key];
              return <div key={module.key} className="rounded-lg border border-[#e2ebe4] bg-white p-2.5"
                data-testid={"netpro1b-module-"+country.countryCode+"-"+module.key}>
                <p className="text-[11px] font-semibold text-[#355b42]">{module.title}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-[#183d2d]">{count}</p>
                <p className="text-[11px] text-[#62766a]">{sourced} preliminari, non incluse</p>
                {allowed?<Link href={"/network/pro/explore?"+new URLSearchParams({module:module.key,country:country.countryCode})}
                  className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-[#175640] underline"
                  data-testid={"netpro1b-browse-"+country.countryCode+"-"+module.key}>
                  Esplora con accesso attivo
                </Link>:<span className="mt-2 block text-[11px] font-medium text-[#7b806e]">
                  {access?"Modulo non attivo":"Accesso da verificare"}
                </span>}
              </div>;
            })}
          </div>
        </article>)}
      </div>}
      <p className="mt-3 text-[11px] leading-4 text-[#64776b]">
        Le carpenterie classificate come terzisti sono nel modulo lavorazioni:
        non diventano automaticamente utilizzatori finali o acquirenti di tubi.
        Un&apos;azienda può comparire in più moduli soltanto se dispone di più ruoli registrati.
        Europa comprende soltanto i Paesi con dati disponibili.
        {coverage?" Rilevazione "+coverage.asOf.slice(0,10)+".":""}
      </p>
    </section>

    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d7e6dc] bg-white/95 px-3 pt-2.5 shadow-[0_-9px_28px_rgba(15,53,35,0.11)] backdrop-blur-md lg:hidden"
      data-testid="netpro-design1-mobile-checkout"
      style={{paddingBottom:"max(12px, env(safe-area-inset-bottom))"}}>
      <div className="mx-auto max-w-[540px]">
        <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-[#f2f7f3] px-3 py-2">
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-[#193729]">{selected.length} moduli selezionati</p>
            <p className="text-[10px] text-[#627467]">Totale indicativo · IVA esclusa</p>
          </div>
          <p data-testid="network-pro-mobile-price" className="shrink-0 text-[21px] font-extrabold tabular-nums text-[#112c20]">
            {euro.format(quote.displayedTotal)} <span className="text-[11px] font-medium">{billing==="annual"?"/ anno":"/ mese"}</span>
          </p>
        </div>
        <button type="button" disabled aria-disabled="true" data-testid="netpro-design1-mobile-pay"
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-3 rounded-xl bg-[#124f39] px-3 text-[14px] font-extrabold text-white opacity-70">
          <Icon name="lock" size={18}/> Abbonati e sblocca <Icon name="arrow" size={19}/>
        </button>
        <p className="mt-1 text-center text-[10px] leading-4 text-[#795f38]">
          Checkout non ancora disponibile · nessun addebito
        </p>
      </div>
    </div>
  </main>;
}
