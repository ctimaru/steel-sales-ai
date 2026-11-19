import Link from "next/link";
import {NetworkCountryFlag} from "@/components/network-country-flag";
import {networkCountryName} from "@/lib/network-eu-countries";
import {getNetworkCountryStats,type NetworkCountryStats} from "@/lib/network-country-stats";
import styles from "./network-country-ticker.module.css";

function CountryMessage({item,duplicate=false}:{item:NetworkCountryStats;duplicate?:boolean}){
  const name=networkCountryName(item.countryCode)||item.countryCode;
  return <Link
    href={"/network?country="+encodeURIComponent(item.countryCode)+"#network-results"}
    tabIndex={duplicate?-1:undefined}
    title={"Esplora "+name+" · "+item.total+" aziende nel Network"}
    className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md px-1 text-xs text-[#284b3d] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
    <NetworkCountryFlag code={item.countryCode}/>
    <strong className="text-[#173f35]">{name}</strong>
    <span className="text-[#7a9386]" aria-hidden="true">·</span>
    <strong className="tabular-nums text-[#173f35]">{item.total.toLocaleString("it-IT")}</strong>
    <span>aziende</span>

  </Link>;
}

function Messages({items,duplicate=false}:{items:NetworkCountryStats[];duplicate?:boolean}){
  return <>
    {items.map(item=><CountryMessage key={item.countryCode} item={item} duplicate={duplicate}/>)}

  </>;
}

/** Access-guarded server component: no hard-coded counts or speculative countries. */
export async function NetworkCountryTicker({organizationId,accessMode}:{
  organizationId:string;accessMode:"free"|"pro";
}){
  const items=await getNetworkCountryStats(organizationId,accessMode);
  return <section
    aria-label="Numero di aziende nel Network per Paese"
    data-testid="network-country-ticker"
    className="mb-3 flex min-h-11 items-center gap-3 rounded-xl border border-[#d7e3dc] bg-white px-3 sm:px-4">
    <span className="shrink-0 border-r border-[#d7e3dc] pr-3 text-[10px] font-bold uppercase tracking-wider text-[#175640]">
      Network in numeri
    </span>
    <div className={styles.viewport+" min-w-0 flex-1"} aria-label="Scopri le aziende censite per Paese">
      <div className={styles.track}>
        <div className={styles.group}><Messages items={items}/></div>
        <div aria-hidden="true" className={styles.group+" "+styles.duplicate}>
          <Messages items={items} duplicate/>
        </div>
      </div>
    </div>
  </section>;
}
