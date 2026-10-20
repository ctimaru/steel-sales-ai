"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {EU_MEMBER_COUNTRIES,OTHER_NETWORK_COUNTRIES} from "@/lib/network-eu-countries";
import {europeRegionsForCountry} from "@/lib/network-eu-regions";

/** Country and region must share one state boundary. Italian regions are not
 * applicable to other countries; changing country clears any stale region.
 * The server also normalizes incoming URLs before reading company data.
 */
export function NetworkCountryRegionFilters({
  country="IT",region="",regions=[],
}:{country?:string;region?:string;regions?:string[]}){
  const router=useRouter();
  const [selectedCountry,setSelectedCountry]=useState(country);
  const [selectedRegion,setSelectedRegion]=useState(region);
  const italy=selectedCountry==="IT";
  const foreignRegions=italy?[]:europeRegionsForCountry(selectedCountry);
  const canSelectRegion=italy||foreignRegions.length>0;
  // URL is the shared contract for Free/Pro, live search and future map clicks.
  // Never carry an old region (or pagination) into another country.
  const navigateGeo=(nextCountry:string,nextRegion:string)=>{
    const params=new URLSearchParams(window.location.search);
    params.set("country",nextCountry);
    if(nextRegion)params.set("region",nextRegion);else params.delete("region");
    params.delete("np");params.delete("province");params.delete("city");
    router.replace("/network?"+params.toString()+"#network-results",{scroll:false});
  };
  const inputStyle="h-10 w-full min-w-0 rounded-lg border border-[#b7cfc2] bg-white px-2.5 text-xs font-semibold text-[#173f35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:cursor-not-allowed disabled:border-[#d7e3dc] disabled:bg-[#eef2ef] disabled:text-[#53635b]";
  return <>
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold text-[#315d4a]">Paese</span>
      <select name="country" aria-label="Paese" value={selectedCountry}
        onChange={event=>{setSelectedCountry(event.target.value);setSelectedRegion("");navigateGeo(event.target.value,"");}}
        className={inputStyle}>
        <optgroup label="Unione europea · 27 Paesi">
          {EU_MEMBER_COUNTRIES.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}
        </optgroup>
        <optgroup label="Altri Paesi già supportati">
          {OTHER_NETWORK_COUNTRIES.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}
        </optgroup>
      </select>
    </label>
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold text-[#315d4a]">Regione</span>
      <select name="region" aria-label="Regione" aria-describedby="network-region-country-hint"
        value={selectedRegion} disabled={!canSelectRegion}
        onChange={event=>{setSelectedRegion(event.target.value);navigateGeo(selectedCountry,event.target.value);}}
        className={inputStyle}>
        <option value="">{canSelectRegion?"Tutte le regioni":"Regioni non disponibili"}</option>
        {italy?regions.map(item=><option key={item} value={item}>{item}</option>):
          foreignRegions.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}
      </select>
    </label>
    <span id="network-region-country-hint" className="sr-only" role="status">
      {italy?"Puoi filtrare per regione italiana.":foreignRegions.length?"Aree statistiche Eurostat NUTS 2024. Filtra soltanto sedi pubblicate con geografia collegata.":"Nessuna classificazione regionale disponibile per questo Paese."}
    </span>
  </>;
}
