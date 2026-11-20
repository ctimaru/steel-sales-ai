"use client";

import {useTransition,type FormEvent,type ReactNode} from "react";
import {useRouter} from "next/navigation";

/**
 * NET-FILTERBAR1.P0 — shared GET-form behavior for the Network facet bar and
 * technical search. Preserve the native /network GET fallback without JS,
 * while hydrated users keep the same document and current scroll position.
 *
 * The server owns validation, counts and Free/Pro access; the form only builds
 * a canonical query from its successful HTML controls. Every filter change
 * returns to page 1. Name search, map and role links use the same URL contract.
 */
export function NetworkFilterRouteForm({
  children,className,ariaLabel,
}:{
  children:ReactNode;className?:string;ariaLabel:string;
}){
  const router=useRouter();
  const [,startTransition]=useTransition();
  const submit=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const params=new URLSearchParams();
    for(const [key,value] of new FormData(event.currentTarget).entries()){
      if(typeof value==="string"&&value.trim())params.set(key,value.trim());
    }
    params.delete("np");
    params.delete("province");
    params.delete("city");
    const href="/network"+(params.size?"?"+params.toString():"")+"#network-results";
    startTransition(()=>router.replace(href,{scroll:false}));
  };
  return <form method="get" action="/network" aria-label={ariaLabel}
    className={className} onSubmit={submit}>
    {children}
  </form>;
}
