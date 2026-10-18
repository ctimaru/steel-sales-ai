import Link from "next/link";

/** Presentation only: mode comes from the server's PA1.3 entitlement, not from a query parameter. */
export type NetworkListingView = "all" | "published" | "unconfirmed";
export function networkListingView(value: string | undefined): NetworkListingView {
  return value === "published" || value === "unconfirmed" ? value : "all";
}
export function NetworkInventoryBar({
  accessMode, published, unconfirmed, discoveryUnavailable=false, publishedUnavailable=false,
  view="all", filters={},
}: {
  accessMode:"free"|"pro";
  published:number; unconfirmed:number;
  discoveryUnavailable?:boolean;publishedUnavailable?:boolean;
  view?:NetworkListingView;
  filters?:Record<string,string|undefined>;
}) {
  const complete=!discoveryUnavailable&&!publishedUnavailable;
  const tabs=[
    {value:"all" as const,label:"Tutte",count:complete?published+unconfirmed:null},
    {value:"published" as const,label:"Pubblicate",count:publishedUnavailable?null:published},
    {value:"unconfirmed" as const,label:"Da confermare",count:discoveryUnavailable?null:unconfirmed},
  ];
  const hasCriteria=Boolean(filters.q||filters.role||filters.region||filters.product||filters.capability||filters.market||filters.province||filters.city);
  return <section aria-label="Inventario aziende e modalità Network"
    className="rounded-2xl border border-[#bcd4c7] bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span data-testid="network-access-mode"
            className="inline-flex rounded-full border border-[#b5d4c0] bg-[#edf5f0] px-3 py-1 text-[11px] font-bold text-[#175640]">
            Modalità Network {accessMode==="pro"?"Pro":"Free"}
          </span>
          <span className="text-[11px] text-[#52615b]">Assegnata al tuo account aziendale</span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#173f35] sm:text-3xl">
          {complete?(published+unconfirmed).toLocaleString("it-IT")+" aziende nel Network":"Esplora il Network"}
        </h2>
        <p className="mt-1 text-xs leading-5 text-[#52615b]">
          {publishedUnavailable?"—":published.toLocaleString("it-IT")} profili pubblicati
          {" · "}{discoveryUnavailable?"—":unconfirmed.toLocaleString("it-IT")} aziende da confermare
          {hasCriteria?" · Filtri attivi":""}
        </p>
      </div>
      <p className="max-w-[280px] text-xs leading-5 text-[#52615b]">
        Le aziende da confermare sono ricercabili, ma non rappresentano clienti acquisiti o utilizzatori di tubi verificati.
      </p>
    </div>
    <nav className="mt-4 flex flex-wrap gap-2" aria-label="Mostra aziende">
      {tabs.map(tab=>{
        const params=new URLSearchParams();
        for(const [key,val] of Object.entries(filters)) {
          if(val&& !["view","p","dpage","error","message","utm_source"].includes(key))params.set(key,val);
        }
        if(tab.value!=="all")params.set("view",tab.value);
        const url="/network"+(params.size?"?"+params.toString():"")+"#network-company-list";
        return <Link key={tab.value} href={url}
          aria-current={view===tab.value?"page":undefined}
          className={"inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition "+(view===tab.value
            ?"border-[#175640] bg-[#175640] text-white"
            :"border-[#d2e2d7] bg-[#f8fbf9] text-[#275544] hover:bg-[#edf5ef]")}>
          {tab.label} <span className="tabular-nums opacity-80">{tab.count===null?"—":tab.count.toLocaleString("it-IT")}</span>
        </Link>;
      })}
    </nav>
    <nav className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#edf1ed] pt-3 text-xs font-semibold" aria-label="Esplora il Network">
      <a href="#network-regional-map" className="text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">Esplora la mappa Italia ↓</a>
      <a href="#network-company-list" className="text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">Consulta le aziende ↓</a>
    </nav>
    {!complete ? <p role="status" className="mt-3 text-xs text-[#805a26]">Una delle fonti è temporaneamente indisponibile: il totale non viene mostrato come zero.</p>:null}
  </section>;
}
