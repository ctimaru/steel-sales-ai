"use client";

import {useState} from "react";

/** Country and region must share one state boundary. Italian regions are not
 * applicable to other countries; changing country clears any stale region.
 * The server also normalizes incoming URLs before reading company data.
 */
export function NetworkCountryRegionFilters({
  country="IT",region="",regions=[],
}:{country?:string;region?:string;regions?:string[]}){
  const [selectedCountry,setSelectedCountry]=useState(country);
  const [selectedRegion,setSelectedRegion]=useState(country==="IT"?region:"");
  const italy=selectedCountry==="IT";
  const inputStyle="h-10 w-full min-w-0 rounded-lg border border-[#b7cfc2] bg-white px-2.5 text-xs font-semibold text-[#173f35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:cursor-not-allowed disabled:border-[#d7e3dc] disabled:bg-[#eef2ef] disabled:text-[#53635b]";
  return <>
    <label className="min-w-0">
      <span className="sr-only">Regione</span>
      <select name="region" aria-label="Regione" aria-describedby="network-region-country-hint"
        value={selectedRegion} disabled={!italy}
        onChange={event=>setSelectedRegion(event.target.value)}
        className={inputStyle}>
        <option value="">{italy?"Tutte le regioni":"Solo per Italia"}</option>
        {italy?regions.map(item=><option key={item} value={item}>{item}</option>):null}
      </select>
    </label>
    <label className="min-w-0">
      <span className="sr-only">Paese</span>
      <select name="country" aria-label="Paese" value={selectedCountry}
        onChange={event=>{setSelectedCountry(event.target.value);setSelectedRegion("");}}
        className={inputStyle}>
        <option value="IT">Italia</option>
        <option value="DE">Germania</option>
        <option value="FR">Francia</option>
        <option value="ES">Spagna</option>
        <option value="US">USA</option>
        <option value="GB">Regno Unito</option>
        <option value="CH">Svizzera</option>
      </select>
    </label>
    <span id="network-region-country-hint" className="sr-only" role="status">
      {italy?"Puoi filtrare per regione italiana.":"Il filtro regione è disponibile soltanto per l’Italia."}
    </span>
  </>;
}
