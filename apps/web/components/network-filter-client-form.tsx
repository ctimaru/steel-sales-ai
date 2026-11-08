"use client";

import {useCallback,useTransition,type FormEvent,type ReactNode} from "react";
import {useRouter} from "next/navigation";

/**
 * NET-PERF1.B — Keep the existing GET form as a no-JavaScript fallback while
 * submitting product/capability/market changes through the App Router.
 *
 * Country/region controls have their own client-side navigation. Only actual
 * form submissions are intercepted here.
 */
const CONTROLLED_FILTERS=[
  "q","role","persona","steel","std","grade","shape","od","wt",
  "side","side2","stock","country","region","product","capability","market",
] as const;
const RESET_ON_FILTER_CHANGE=["np","p","dpage","province","city"] as const;

function networkFilterDestination(
  currentSearch:string,
  data:FormData,
):string{
  const params=new URLSearchParams(currentSearch);
  // Remove the fields represented by this form before writing the latest
  // values; an empty dropdown must clear its previous URL value as well.
  for(const key of CONTROLLED_FILTERS)params.delete(key);
  for(const key of RESET_ON_FILTER_CHANGE)params.delete(key);
  for(const key of CONTROLLED_FILTERS){
    const value=data.get(key);
    if(typeof value!=="string")continue;
    const trimmed=value.trim();
    if(trimmed)params.set(key,trimmed);
  }
  const query=params.toString();
  return "/network"+(query?"?"+query:"")+"#network-results";
}

export function NetworkFilterClientForm({children}:{children:ReactNode}){
  const router=useRouter();
  const [isPending,startTransition]=useTransition();
  const submit=useCallback((event:FormEvent<HTMLFormElement>)=>{
    if(event.defaultPrevented)return;
    // A native form GET is still available when JavaScript is disabled.
    // The client enhancement only runs after React has hydrated.
    event.preventDefault();
    const destination=networkFilterDestination(
      window.location.search,new FormData(event.currentTarget),
    );
    if(destination==="/network"+window.location.search+"#network-results")return;
    startTransition(()=>router.replace(destination,{scroll:false}));
  },[router]);

  return <form method="get" action="/network"
    aria-label="Filtri tecnici e geografici"
    className="grid grid-cols-1 gap-3"
    onSubmit={submit} aria-busy={isPending}>
    {children}
    <span role="status" aria-live="polite" className="sr-only">
      {isPending?"Aggiornamento dei risultati in corso":""}
    </span>
  </form>;
}
