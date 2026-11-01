/** NET-AUDIT1.5 — Italian display labels for the Network taxonomy.
 *
 * Display only: canonical keys, URLs, SQL and the chat parser keep using the
 * server taxonomy unchanged. Unknown keys/names fall back to the server label,
 * so a new taxonomy entry never disappears from the UI.
 */
const IT:Record<string,string>={
  // Roles (same wording as the role doors).
  producer:"Produttore",trader_distributor:"Commerciante",
  processor_service_provider:"Terzista",end_user:"Utilizzatore",
  // Product families.
  bars:"Barre",beams_sections:"Travi e profilati",coils:"Coil",flat_products:"Prodotti piani",
  hollow_sections:"Profilati cavi",long_products:"Prodotti lunghi",plates:"Lamiere da treno",
  rebar:"Tondo per cemento armato",sheets:"Lamiere",tubes_pipes:"Tubi",wire_rod_wire:"Vergella e filo",
  // Capabilities.
  bending_forming:"Piegatura e formatura",cut_to_length:"Taglio a misura",
  export_capability:"Export",galvanizing:"Zincatura",heat_treatment:"Trattamento termico",
  jit_delivery:"Consegne just-in-time",laser_cutting:"Taglio laser",oxy_cutting:"Ossitaglio",
  painting_coating:"Verniciatura e rivestimento",pickling_oiling:"Decapaggio e oliatura",
  plasma_cutting:"Taglio plasma",project_supply:"Forniture su commessa",sawing:"Segagione",
  slitting:"Taglio coil (slitting)",small_batch:"Piccoli lotti",stockholding:"Magazzino (stock)",
  testing_ndt:"Prove e controlli non distruttivi",welding_fabrication:"Saldatura e carpenteria",
  // Markets.
  agri_machinery:"Macchine agricole",appliances:"Elettrodomestici",automotive:"Automotive",
  construction_infrastructure:"Edilizia e infrastrutture",energy:"Energia",hvac:"Climatizzazione (HVAC)",
  marine:"Navale",mechanical_engineering_market:"Meccanica",
};
/** Server display names as stored today (English), mapped to their key. */
const KEY_BY_NAME:Record<string,string>={
  "Producer":"producer","Trader / Distributor":"trader_distributor",
  "Processor / Service Provider":"processor_service_provider","End User":"end_user",
  "Bars":"bars","Beams & sections":"beams_sections","Coils":"coils","Flat products":"flat_products",
  "Hollow sections":"hollow_sections","Long products":"long_products","Plates":"plates","Rebar":"rebar",
  "Sheets":"sheets","Tubes & pipes":"tubes_pipes","Wire rod / wire":"wire_rod_wire",
  "Bending / forming":"bending_forming","Cut-to-length":"cut_to_length","Export capability":"export_capability",
  "Galvanizing":"galvanizing","Heat treatment":"heat_treatment","JIT delivery":"jit_delivery",
  "Laser cutting":"laser_cutting","Oxy cutting":"oxy_cutting","Painting / coating":"painting_coating",
  "Pickling / oiling":"pickling_oiling","Plasma cutting":"plasma_cutting","Project supply":"project_supply",
  "Sawing":"sawing","Slitting":"slitting","Small batch":"small_batch","Stockholding":"stockholding",
  "Testing / NDT":"testing_ndt","Welding / fabrication":"welding_fabrication",
  "Agriculture machinery":"agri_machinery","Appliances":"appliances","Automotive":"automotive",
  "Construction & infrastructure":"construction_infrastructure","Energy":"energy","HVAC":"hvac",
  "Marine":"marine","Mechanical engineering":"mechanical_engineering_market",
};

/** Italian label for a canonical key, or the given fallback. */
export function networkLabelIt(key:string|null|undefined,fallback=""):string{
  return (key&&IT[key])||fallback||key||"";
}
/** Italian label for a server display name (used where only names are available). */
export function networkNameIt(name:string|null|undefined):string{
  if(!name)return "";
  const key=KEY_BY_NAME[name.trim()];
  return key?IT[key]:name;
}
/** Translate a taxonomy option list for <select>, keeping canonical keys. */
export function localizeTaxonomyOptions<T extends {canonical_key:string;display_name:string}>(options:T[]):T[]{
  return options.map(option=>({...option,display_name:networkLabelIt(option.canonical_key,option.display_name)}))
    .sort((a,b)=>a.display_name.localeCompare(b.display_name,"it"));
}
