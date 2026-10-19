/** Small, self-contained vector flags. Never rely on emoji regional indicators:
 * Chrome/Windows commonly renders 🇮🇹 as the letters "IT".
 * Country names remain the accessible text next to these decorative icons.
 */
export type NetworkFlagCountry="IT"|"DE"|"FR"|"ES"|"US"|"GB"|"CH";
const supported=new Set<string>(["IT","DE","FR","ES","US","GB","CH"]);

function FlagShapes({country}:{country:NetworkFlagCountry}){
  switch(country){
    case "IT":return <>
      <rect width="8" height="16" fill="#009246"/>
      <rect x="8" width="8" height="16" fill="#fff"/>
      <rect x="16" width="8" height="16" fill="#ce2b37"/>
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
  if(!country||!supported.has(country))return null;
  const square=country==="CH";
  return <svg viewBox={square?"0 0 16 16":"0 0 24 16"}
    aria-hidden="true" focusable="false"
    width={square?16:24} height={16}
    className={"inline-block h-4 shrink-0 overflow-hidden rounded-[2px] border border-[#c9d7cf] align-[-2px] "+(square?"w-4":"w-6")}
    xmlns="http://www.w3.org/2000/svg">
    <FlagShapes country={country as NetworkFlagCountry}/>
  </svg>;
}
