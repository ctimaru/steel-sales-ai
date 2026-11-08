"use client";

import {useEffect,useState,type ComponentType} from "react";
import {usePathname} from "next/navigation";

const ACTIVE_KEY="sss:net-perf1a:active:v1";

/**
 * Superadmin-only opt-in gate. Ordinary users and ordinary Network visits do not
 * load the performance probe. Measurements remain in this browser tab.
 */
export function NetworkPerfGate(){
  const pathname=usePathname();
  const [Panel,setPanel]=useState<ComponentType<{onStop:()=>void}>|null>(null);

  useEffect(()=>{
    if(!pathname.startsWith("/network") || Panel)return;
    try{
      if(new URLSearchParams(window.location.search).get("netperf")==="1"){
        window.sessionStorage.setItem(ACTIVE_KEY,"1");
      }
      if(window.sessionStorage.getItem(ACTIVE_KEY)!=="1")return;
    }catch{return;}
    let alive=true;
    void import("./network-perf-panel").then(module=>{
      if(alive)setPanel(()=>module.NetworkPerfPanel);
    });
    return ()=>{alive=false;};
  },[pathname,Panel]);

  return Panel?<Panel onStop={()=>{
    try{window.sessionStorage.removeItem(ACTIVE_KEY);}catch{}
    setPanel(null);
  }}/>:null;
}
