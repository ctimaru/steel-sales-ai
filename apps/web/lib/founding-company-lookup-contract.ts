import type { PublicCompanyLookupState } from "@/lib/public-company-lookup-contract";
export type FoundingCompanyIdentity = { legal_name:string; trading_name:string|null; country_code:string; vat_hint:string|null };
export type FoundingCompanyLookupState = {status:PublicCompanyLookupState["status"];items:FoundingCompanyIdentity[]};
export const initialFoundingCompanyLookup:FoundingCompanyLookupState={status:"idle",items:[]};
// Explicit allowlist: never forward claim references, claim status, contacts, or internal IDs.
export function foundingCompanyLookupResult(state:PublicCompanyLookupState):FoundingCompanyLookupState {
 if(state.status!=="ok")return {status:state.status,items:[]};
 const items=state.items.slice(0,5).filter(x=>typeof x.legal_name==="string"&&x.legal_name.trim()&&typeof x.country_code==="string"&&/^[A-Z]{2}$/.test(x.country_code)).map(x=>({legal_name:x.legal_name,trading_name:typeof x.trading_name==="string"?x.trading_name:null,country_code:x.country_code,vat_hint:typeof x.vat_hint==="string"&&/^••••[A-Z0-9]{4}$/i.test(x.vat_hint)?x.vat_hint:null}));
 return {status:items.length?"ok":"error",items};
}
