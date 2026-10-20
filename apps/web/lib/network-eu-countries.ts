/** ISO 3166-1 alpha-2 country keys used by Network. Geographic coverage is
 * not evidence of a published company, headquarters, facility or active market.
 * NUTS uses EL for Greece; our legal-entity country key remains GR.
 */
export const EU_MEMBER_COUNTRIES = [
  {code:"AT",name:"Austria"},
  {code:"BE",name:"Belgio"},
  {code:"BG",name:"Bulgaria"},
  {code:"CY",name:"Cipro"},
  {code:"HR",name:"Croazia"},
  {code:"DK",name:"Danimarca"},
  {code:"EE",name:"Estonia"},
  {code:"FI",name:"Finlandia"},
  {code:"FR",name:"Francia"},
  {code:"DE",name:"Germania"},
  {code:"GR",name:"Grecia"},
  {code:"IE",name:"Irlanda"},
  {code:"IT",name:"Italia"},
  {code:"LV",name:"Lettonia"},
  {code:"LT",name:"Lituania"},
  {code:"LU",name:"Lussemburgo"},
  {code:"MT",name:"Malta"},
  {code:"NL",name:"Paesi Bassi"},
  {code:"PL",name:"Polonia"},
  {code:"PT",name:"Portogallo"},
  {code:"CZ",name:"Repubblica Ceca"},
  {code:"RO",name:"Romania"},
  {code:"SK",name:"Slovacchia"},
  {code:"SI",name:"Slovenia"},
  {code:"ES",name:"Spagna"},
  {code:"SE",name:"Svezia"},
  {code:"HU",name:"Ungheria"},
] as const;

export const OTHER_NETWORK_COUNTRIES = [
  {code:"CH",name:"Svizzera"},
  {code:"GB",name:"Regno Unito"},
  {code:"US",name:"Stati Uniti"},
] as const;

const EU_CODES = new Set<string>(EU_MEMBER_COUNTRIES.map(country=>country.code));
const COUNTRY_LABELS:Record<string,string> = Object.fromEntries(
  [...EU_MEMBER_COUNTRIES,...OTHER_NETWORK_COUNTRIES].map(country=>[country.code,country.name]),
);

export function isEuMemberCountry(country:string):boolean {
  return EU_CODES.has(country.trim().toUpperCase());
}

export function isSupportedNetworkCountry(country:string):boolean {
  return Object.hasOwn(COUNTRY_LABELS,country.trim().toUpperCase());
}

export function networkCountryName(country:string):string|undefined {
  return COUNTRY_LABELS[country.trim().toUpperCase()];
}
