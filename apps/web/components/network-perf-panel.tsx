"use client";

import {useCallback,useEffect,useRef,useState} from "react";

const STORE="sss:net-perf1a:samples:v1";
const PENDING="sss:net-perf1a:pending:v1";
const MAX_SAMPLES=100;
const classifyRoute=(pathname:string)=>
  pathname==="/network"?"network":/^\/network\/[^/]+$/.test(pathname)?"company_profile":"other";

type PerfSample={
  kind:"navigation"|"paint"|"interaction";
  metric:string;
  ms:number;
  route:"network"|"company_profile"|"other";
  viewport:number;
  mode?:string;
};

const round=(v:number)=>Math.round(v*10)/10;
const asFinite=(value:number)=>Number.isFinite(value)&&value>=0?round(value):null;
const percentile=(values:number[],p:number)=>{
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  return round(sorted[Math.max(0,Math.ceil(p*sorted.length)-1)]);
};

/** Opt-in, tab-local measurements only. Never records query values, IDs, emails,
 * company names, RFQs, tokens, full URLs, user-agent or personal information.
 * No fetch/sendBeacon/analytics export; the operator explicitly copies JSON.
 */
export function NetworkPerfPanel({onStop}:{onStop:()=>void}){
  const samplesRef=useRef<PerfSample[]>([]);
  const [samples,setSamples]=useState<PerfSample[]>([]);
  const [message,setMessage]=useState("");
  const latestLcp=useRef<number|null>(null);
  const latestCls=useRef(0);
  const latestEvent=useRef(0);
  const pending=useRef<{
    action:string;start:number;epoch:number;route:PerfSample["route"];
    url:string;results:Element|null;heading:string;
  }|null>(null);

  const record=useCallback((kind:PerfSample["kind"],metric:string,ms:number,mode?:string)=>{
    const value=asFinite(ms);
    if(value===null)return;
    const sample:PerfSample={kind,metric,ms:value,route:classifyRoute(location.pathname),
      viewport:window.innerWidth,...(mode?{mode}:{})};
    const current=[...samplesRef.current,sample].slice(-MAX_SAMPLES);
    samplesRef.current=current;
    setSamples(current);
    try{window.sessionStorage.setItem(STORE,JSON.stringify(current));}catch{}
  },[]);

  useEffect(()=>{
    try{
      const previous=JSON.parse(window.sessionStorage.getItem(STORE)||"[]");
      if(Array.isArray(previous)){
        const safe=previous.filter((x):x is PerfSample=>
          x&&["navigation","paint","interaction"].includes(x.kind)&&
          typeof x.metric==="string"&&typeof x.ms==="number"&&
          Number.isFinite(x.ms)&&["network","company_profile","other"].includes(x.route)&&
          typeof x.viewport==="number").slice(-MAX_SAMPLES);
        samplesRef.current=safe;setSamples(safe);
      }
    }catch{}

    // A native GET reload destroys the old document; this records the elapsed
    // interval up to the new, mounted diagnostic client (not a Core Web Vital).
    try{
      const previous=JSON.parse(window.sessionStorage.getItem(PENDING)||"null");
      if(previous&&typeof previous.action==="string"&&typeof previous.epoch==="number"&&
         Date.now()-previous.epoch>=0&&Date.now()-previous.epoch<60000){
        record("interaction",previous.action,Date.now()-previous.epoch,"full_document_to_probe_ready");
      }
      window.sessionStorage.removeItem(PENDING);
    }catch{}

    const nav=performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming|undefined;
    if(nav){
      record("navigation","ttfb",nav.responseStart-nav.startTime,nav.type);
      if(nav.domContentLoadedEventEnd>0)record("navigation","dom_content_loaded",
        nav.domContentLoadedEventEnd-nav.startTime,nav.type);
    }

    const observers:PerformanceObserver[]=[];
    const observe=(type:string,callback:PerformanceObserverCallback,options:PerformanceObserverInit)=>{
      if(!PerformanceObserver.supportedEntryTypes.includes(type))return;
      try{
        const observer=new PerformanceObserver(callback);
        observer.observe(options);
        observers.push(observer);
      }catch{}
    };
    observe("paint",list=>{
      for(const entry of list.getEntries()){
        if(entry.name==="first-contentful-paint")
          record("paint","fcp",entry.startTime);
      }
    },{type:"paint",buffered:true});
    observe("largest-contentful-paint",list=>{
      const last=list.getEntries().at(-1);
      if(last)latestLcp.current=round(last.startTime);
    },{type:"largest-contentful-paint",buffered:true});
    let shiftStart=0,shiftLast=0,shiftWindow=0;
    observe("layout-shift",list=>{
      for(const raw of list.getEntries()){
        const shift=raw as PerformanceEntry&{value:number;hadRecentInput:boolean};
        if(shift.hadRecentInput)continue;
        if(shift.startTime-shiftLast>1000||shift.startTime-shiftStart>5000){
          shiftStart=shift.startTime;shiftWindow=0;
        }
        shiftWindow+=shift.value;
        shiftLast=shift.startTime;
        latestCls.current=Math.max(latestCls.current,shiftWindow);
      }
    },{type:"layout-shift",buffered:true});
    // A longest-event diagnostic, NOT the official field INP algorithm.
    observe("event",list=>{
      for(const entry of list.getEntries()){
        latestEvent.current=Math.max(latestEvent.current,entry.duration);
      }
    },{type:"event",durationThreshold:16,buffered:true} as PerformanceObserverInit);

    const start=(action:string)=>{
      if(classifyRoute(location.pathname)!=="network")return;
      const results=document.getElementById("network-results");
      const current={action,start:performance.now(),epoch:Date.now(),
        route:classifyRoute(location.pathname),url:location.pathname+location.search,
        results,heading:results?.querySelector("h2")?.textContent||""};
      pending.current=current;
      try{window.sessionStorage.setItem(PENDING,JSON.stringify({
        action,epoch:current.epoch
      }));}catch{}
    };

    const clicked=(event:MouseEvent)=>{
      const node=event.target;
      if(!(node instanceof Element)||node.closest("[data-netperf-panel]"))return;
      const link=node.closest<HTMLAnchorElement>("a[href]");
      if(link){
        let url:URL;
        try{url=new URL(link.href,location.href);}catch{return;}
        if(url.origin!==location.origin)return;
        if(/^\/network\/[^/]+$/.test(url.pathname)){start("company_profile_open");return;}
        if(url.pathname!=="/network")return;
        const next=url.searchParams;
        const now=new URLSearchParams(location.search);
        const map=node.closest("a[data-country]");
        const action=map?"map_country":
          ["role","country","region","product","capability","market","np","q","steel"].find(k=>
            next.get(k)!==now.get(k))||"network_link";
        start("filter_"+action);
      }
    };
    const changed=(event:Event)=>{
      const el=event.target;
      if(!(el instanceof HTMLSelectElement)||!el.closest("main"))return;
      if(["country","region","product","capability","market"].includes(el.name))
        start("select_"+el.name);
    };
    const input=(event:Event)=>{
      const el=event.target;
      if(el instanceof HTMLInputElement&&el.name==="q"&&el.closest("main"))
        start("search_typing");
    };
    const submitted=(event:Event)=>{
      const el=event.target;
      if(!(el instanceof HTMLFormElement)||!el.closest("main"))return;
      if(!pending.current||performance.now()-pending.current.start>200)
        start("search_or_filter_submit");
    };
    document.addEventListener("click",clicked,true);
    document.addEventListener("change",changed,true);
    document.addEventListener("input",input,true);
    document.addEventListener("submit",submitted,true);

    const observer=new MutationObserver(records=>{
      const task=pending.current;
      if(!task||location.pathname+location.search===task.url)return;
      const results=document.getElementById("network-results");
      const heading=results?.querySelector("h2")?.textContent||"";
      const changedResults=results!==task.results||heading!==task.heading||
        records.some(record=>{
          const target=record.target;
          return target instanceof Element&&Boolean(target.closest("#network-results"));
        });
      const profileNow=classifyRoute(location.pathname)==="company_profile"&&
        document.querySelector("main")!==null;
      if(!changedResults&&!profileNow)return;
      pending.current=null;
      try{sessionStorage.removeItem(PENDING);}catch{}
      record("interaction",task.action,performance.now()-task.start,"action_to_dom_update");
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});

    const onPageHide=()=>{
      if(latestLcp.current!==null)record("paint","lcp_candidate",latestLcp.current);
      record("paint","cls_session_max",latestCls.current);
      if(latestEvent.current>0)record("paint","longest_event_duration",latestEvent.current);
    };
    window.addEventListener("pagehide",onPageHide);

    return ()=>{
      observer.disconnect();
      for(const observer of observers)observer.disconnect();
      document.removeEventListener("click",clicked,true);
      document.removeEventListener("change",changed,true);
      document.removeEventListener("input",input,true);
      document.removeEventListener("submit",submitted,true);
      window.removeEventListener("pagehide",onPageHide);
    };
  },[record]);

  const exportReport=()=>{
    const routeSamples=[...samplesRef.current];
    if(latestLcp.current!==null)routeSamples.push({
      kind:"paint",metric:"lcp_candidate",ms:latestLcp.current,
      route:classifyRoute(location.pathname),viewport:innerWidth,
    });
    routeSamples.push({kind:"paint",metric:"cls_session_max",ms:round(latestCls.current),
      route:classifyRoute(location.pathname),viewport:innerWidth});
    if(latestEvent.current>0)routeSamples.push({
      kind:"paint",metric:"longest_event_duration",ms:round(latestEvent.current),
      route:classifyRoute(location.pathname),viewport:innerWidth,
    });
    const interactions=routeSamples.filter(s=>s.kind==="interaction").map(s=>s.ms);
    return JSON.stringify({
      contract:"net-perf1a-local-v1",scope:"tab_local_opt_in",measurement:"Chrome Performance API; not real-user p75 Core Web Vitals",
      generatedAt:new Date().toISOString(),samples:routeSamples,
      summary:{interactionCount:interactions.length,interactionP50Ms:percentile(interactions,.5),
        interactionP75Ms:interactions.length>=5?percentile(interactions,.75):null,
        note:"Soft navigation: action to results DOM update; native reload: action to diagnostic probe ready. Do not pool modes."}
    },null,2);
  };
  const copy=async()=>{
    try{await navigator.clipboard.writeText(exportReport());setMessage("Rapporto copiato; incollalo nella chat per l'analisi.");}
    catch{setMessage("Copia non disponibile: usa un browser HTTPS con permessi clipboard.");}
  };
  const reset=()=>{
    samplesRef.current=[];setSamples([]);
    try{sessionStorage.removeItem(STORE);sessionStorage.removeItem(PENDING);}catch{}
    setMessage("Campioni azzerati.");
  };
  const stop=()=>{
    try{sessionStorage.removeItem(PENDING);}catch{}
    onStop();
  };
  return <aside data-netperf-panel aria-label="Misurazione prestazioni Network"
    className="fixed bottom-3 right-3 z-[90] w-[min(320px,calc(100vw-24px))] rounded-xl border border-[#a7c4b7] bg-white p-3 text-[#173f35] shadow-xl"
    role="region">
    <div className="flex items-center justify-between gap-2">
      <strong className="text-sm">NET-PERF1.A · Misura locale</strong>
      <button type="button" onClick={stop} aria-label="Termina misurazione" className="rounded px-2 py-1 text-xs font-bold">×</button>
    </div>
    <p className="mt-1 text-[11px] leading-4 text-[#52615b]">
      Solo questa scheda · nessun invio di dati · non registra ricerche o nomi.
      Prova ricerca, Paese, Ruolo, prodotto e profili; confronta 1440/390/320 px.
    </p>
    <div className="mt-2 flex gap-3 text-xs">
      <span><strong>{samples.length}</strong> campioni</span>
      <span><strong>{samples.filter(s=>s.kind==="interaction").length}</strong> interazioni</span>
      <span>{innerWidth} px</span>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={()=>void copy()}
        className="rounded-lg bg-[#165b43] px-3 py-2 text-xs font-semibold text-white">Copia JSON</button>
      <button type="button" onClick={reset}
        className="rounded-lg border border-[#bacfc3] px-3 py-2 text-xs font-semibold">Azzera</button>
      <button type="button" onClick={stop}
        className="rounded-lg border border-[#bacfc3] px-3 py-2 text-xs font-semibold">Termina</button>
    </div>
    {message?<p role="status" className="mt-2 text-[11px]">{message}</p>:null}
  </aside>;
}
