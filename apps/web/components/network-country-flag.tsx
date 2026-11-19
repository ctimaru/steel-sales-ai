/** Small, self-contained vector flags. Never rely on emoji regional indicators:
 * Chrome/Windows commonly renders 🇮🇹 as the letters "IT".
 * Country names remain the accessible text next to these decorative icons.
 */
export type NetworkFlagCountry="IT"|"RO"|"DE"|"FR"|"ES"|"US"|"GB"|"CH"|"RS"|"TR"|"UA";
const supported=new Set<string>(["IT","RO","DE","FR","ES","US","GB","CH","RS","TR","UA"]);
// Offline, local SVGs for the remaining 22 EU member states.
// Source: lipis/flag-icons (MIT); license in public/network-flags/LICENSE.
const localSvgFlags=new Set<string>(["AT","BE","BG","CY","HR","DK","EE","FI","GR","IE","LV","LT","LU","MT","NL","PL","PT","CZ","SK","SI","SE","HU"]);

function FlagShapes({country}:{country:NetworkFlagCountry}){
  switch(country){
    case "IT":return <>
      <rect width="8" height="16" fill="#009246"/>
      <rect x="8" width="8" height="16" fill="#fff"/>
      <rect x="16" width="8" height="16" fill="#ce2b37"/>
    </>;
    case "RO":return <>
      <rect width="8" height="16" fill="#002b7f"/>
      <rect x="8" width="8" height="16" fill="#fcd116"/>
      <rect x="16" width="8" height="16" fill="#ce1126"/>
    </>;
    case "FR":return <>
      <rect width="8" height="16" fill="#0055a4"/>
      <rect x="8" width="8" height="16" fill="#fff"/>
      <rect x="16" width="8" height="16" fill="#ef4135"/>
    </>;
    case "DE":return <>
      <rect width="24" height="5.34" fill="#171717"/>
      <rect y="5.33" width="24" height="5.34" fill="#dd0000"/>
      <rect y="10.66" width="24" height="5.34" fill="#ffce00"/>
    </>;
    case "ES":return <>
      <rect width="24" height="16" fill="#aa151b"/>
      <rect y="4" width="24" height="8" fill="#f1bf00"/>
      <rect x="8" y="6" width="1.2" height="4" fill="#aa151b"/>
    </>;
    case "UA":return <>
      <rect width="24" height="8" fill="#0057b7"/>
      <rect y="8" width="24" height="8" fill="#ffd700"/>
    </>;
    case "RS":return <>
      <rect width="24" height="5.34" fill="#c6363c"/>
      <rect y="5.33" width="24" height="5.34" fill="#0c4076"/>
      <rect y="10.66" width="24" height="5.34" fill="#fff"/>
      <path d="M6.3 3h6.2v6l-3.1 3-3.1-3Z" fill="#fff" stroke="#c6363c" strokeWidth=".6"/>
      <path d="M9.4 5.1V10M7.4 7.2h4" stroke="#c6363c" strokeWidth="1.2"/>
    </>;
    case "TR":return <>
      <rect width="24" height="16" fill="#e30a17"/>
      <circle cx="10" cy="8" r="5" fill="#fff"/>
      <circle cx="11.8" cy="8" r="4" fill="#e30a17"/>
      <path d="m15.8 4.1.8 2.5h2.6l-2.1 1.5.8 2.4-2.1-1.5-2.1 1.5.8-2.4-2.1-1.5H15Z" fill="#fff"/>
    </>;
    case "CH":return <>
      <rect width="16" height="16" fill="#da291c"/>
      <path d="M6.5 3h3v3.5H13v3H9.5V13h-3V9.5H3v-3h3.5Z" fill="#fff"/>
    </>;
    case "GB":return <>
      <rect width="24" height="16" fill="#012169"/>
      <path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="4"/>
      <path d="M0 0 24 16M24 0 0 16" stroke="#c8102e" strokeWidth="1.6"/>
      <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5.2"/>
      <path d="M12 0v16M0 8h24" stroke="#c8102e" strokeWidth="2.8"/>
    </>;
    case "US":return <>
      <rect width="24" height="16" fill="#fff"/>
      {Array.from({length:7},(_,index)=><rect key={index} y={index*32/13} width="24" height={16/13} fill="#b22234"/>)}
      <rect width="10" height={112/13} fill="#3c3b6e"/>
      {Array.from({length:4},(_,row)=>Array.from({length:5},(_,col)=>
        <circle key={row+"-"+col} cx={1.2+col*1.9} cy={1.1+row*2.05} r=".28" fill="#fff"/>))}
    </>;
  }
}

export function NetworkCountryFlag({code}:{code:string|null|undefined}){
  const country=code?.toUpperCase();
  if(!country)return null;
  if(localSvgFlags.has(country)){
    return <img src={"/network-flags/"+country.toLowerCase()+".svg"} alt="" aria-hidden="true"
      width={24} height={16} loading="lazy"
      className="inline-block h-4 w-6 shrink-0 rounded-[2px] border border-[#c9d7cf] object-fill align-[-2px]"/>;
  }
  if(!supported.has(country))return null;
  const square=country==="CH";
  return <svg viewBox={square?"0 0 16 16":"0 0 24 16"}
    aria-hidden="true" focusable="false"
    width={square?16:24} height={16}
    className={"inline-block h-4 shrink-0 overflow-hidden rounded-[2px] border border-[#c9d7cf] align-[-2px] "+(square?"w-4":"w-6")}
    xmlns="http://www.w3.org/2000/svg">
    <FlagShapes country={country as NetworkFlagCountry}/>
  </svg>;
}
