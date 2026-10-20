import "server-only";

import {getNetworkBrowsePage,getNetworkDiscoveredMarketPage,getNetworkSteelRelevancePage, type FreeCompany, type NetworkBrowsePage} from "@/lib/network-free";
import {parseNetworkPage} from "@/components/network-pagination";
import {searchNetwork} from "@/lib/network";
import {withCompactGeoEvidence} from "@/lib/network-compact-geo";
import {isSupportedNetworkCountry} from "@/lib/network-eu-countries";
import {europeRegionForCountry} from "@/lib/network-eu-regions";
import {getEuropeRegionalSearch} from "@/lib/network-europe-regional";

/** NET-UX COMPACT1: one honest, stable server-side pagination across BOTH feeds.
 * Keep each existing RLS/entitlement-gated source and its original provenance.
 * 6 real companies per page makes first results visible on standard laptop screens.
 */
export const COMPACT_NETWORK_PAGE_SIZE=6;
export type CompactNetworkFilters={
  q?:string;role?:string;region?:string;persona?:string;np?:string;
  product?:string;capability?:string;market?:string;country?:string;steel?:string;
};
export type CompactNetworkPage={
  items:FreeCompany[];total:number;published:number;discovered:number;
  page:number;pages:number;first:number;last:number;discoveryUnavailable:boolean;
  technicalOnly?:boolean;marketEvidence?:boolean;steelMode?:boolean;steelEvidenceTotal?:number;capabilityLabels?:Record<string,string[]>;
  geoInvalid?:boolean;regionPublishedOnly?:boolean;
};
/** Normalize URL-originated geographic facets before any Free/Pro data query.
 * Region names here belong to Italy; never combine them with a foreign country.
 */
export function normalizeCompactGeoFilters(filters:CompactNetworkFilters):CompactNetworkFilters{
  const requested=filters.country?.trim().toUpperCase();
  const legacyCountries=["IT","DE","FR","ES","US","GB","CH"];
  const country=requested&&(legacyCountries.includes(requested)||isSupportedNetworkCountry(requested))?requested:undefined;
  return {...filters,country,region:country&&country!=="IT"?filters.region?.trim().toUpperCase():filters.region};
}

export type SourceWindow={start:number;end:number};

export function compactSourceWindows(offset:number,count:number,published:number,discovered:number){
  const end=Math.min(offset+count,published+discovered);
  return {
    published:{start:Math.min(offset,published),end:Math.min(end,published)},
    discovered:{start:Math.max(0,offset-published),end:Math.min(discovered,Math.max(0,end-published))},
  };
}

async function sourceSlice(
  org:string,access:"free"|"pro",source:"published"|"unconfirmed",
  filters:CompactNetworkFilters,initial:NetworkBrowsePage,window:SourceWindow,
):Promise<FreeCompany[]> {
  if(window.end<=window.start)return [];
  const size=Math.max(1,initial.page_size);
  const beginPage=Math.floor(window.start/size)+1;
  const endPage=Math.floor((window.end-1)/size)+1;
  const pieces=await Promise.all(Array.from({length:endPage-beginPage+1},async(_,index)=>{
    const num=beginPage+index;
    const page=num===1?initial:await getNetworkBrowsePage(org,access,source,{
      q:filters.q,role:filters.role,region:filters.region,persona:filters.persona,page:num,
    });
    const start=Math.max(window.start,num===1?0:(num-1)*size);
    const end=Math.min(window.end,num*size);
    return page.items.slice(start-(num-1)*size,end-(num-1)*size);
  }));
  return pieces.flat();
}

export async function getCompactNetworkPage(
  organizationId:string,access:"free"|"pro",filters:CompactNetworkFilters,
):Promise<CompactNetworkPage>{
  filters=normalizeCompactGeoFilters(filters);
  if(filters.country&&filters.country!=="IT"&&filters.region){
    const region=europeRegionForCountry(filters.country,filters.region);
    if(!region)return {
      items:[],total:0,published:0,discovered:0,page:1,pages:1,first:0,last:0,
      discoveryUnavailable:false,technicalOnly:true,geoInvalid:true,regionPublishedOnly:true,
    };
    const requestedPage=parseNetworkPage(filters.np);
    const initial=await getEuropeRegionalSearch(organizationId,access,filters,requestedPage,COMPACT_NETWORK_PAGE_SIZE);
    const total=Math.max(0,initial.total);
    const pages=Math.max(1,Math.ceil(total/COMPACT_NETWORK_PAGE_SIZE));
    const page=Math.min(requestedPage,pages);
    const actual=page===requestedPage?initial:
      await getEuropeRegionalSearch(organizationId,access,filters,page,COMPACT_NETWORK_PAGE_SIZE);
    return {
      items:actual.items,total,published:total,discovered:0,page,pages,
      first:total?(page-1)*COMPACT_NETWORK_PAGE_SIZE+1:0,
      last:Math.min(page*COMPACT_NETWORK_PAGE_SIZE,total),
      discoveryUnavailable:false,technicalOnly:true,regionPublishedOnly:true,
      capabilityLabels:Object.fromEntries(actual.items.map(company=>[
        company.id,(company.capabilities||[]).map(cap=>cap.name),
      ])),
    };
  }
  // DATA1B.4: intentional opt-in ranking; do not ignore technical facets.
  // Full source ordering is computed in SQL before limit/offset, not in the browser.
  const steelMode=filters.steel==="1" && !filters.product && !filters.capability &&
    !filters.market && (!filters.country || filters.country==="IT");
  if(steelMode){
    const requestedPage=parseNetworkPage(filters.np);
    const first=await getNetworkSteelRelevancePage(organizationId,access,{
      q:filters.q,role:filters.role,region:filters.region,offset:0,limit:COMPACT_NETWORK_PAGE_SIZE,
    });
    const pages=Math.max(1,Math.ceil(first.total/COMPACT_NETWORK_PAGE_SIZE));
    const page=Math.min(requestedPage,pages);
    const offset=(page-1)*COMPACT_NETWORK_PAGE_SIZE;
    const selected=page===1?first:await getNetworkSteelRelevancePage(organizationId,access,{
      q:filters.q,role:filters.role,region:filters.region,offset,limit:COMPACT_NETWORK_PAGE_SIZE,
    });
    return {items:selected.items,total:selected.total,published:selected.published,
      discovered:selected.discovered,page,pages,
      first:selected.total?offset+1:0,last:Math.min(offset+COMPACT_NETWORK_PAGE_SIZE,selected.total),
      discoveryUnavailable:false,technicalOnly:true,steelMode:true,steelEvidenceTotal:selected.evidenceTotal};
  }
  const technicalOnly=Boolean(filters.product||filters.capability||filters.market||
    (filters.country && filters.country.toUpperCase()!=="IT"));
  // DATA1C: a market-only search spans BOTH published and sourced provisional
  // companies. The exact legacy product/capability combinations still use the
  // canonical technical finder, to avoid silently dropping technical constraints.
  const sectorSearch=Boolean(filters.market && !filters.product && !filters.capability &&
    (!filters.country || filters.country==="IT"));
  if(sectorSearch && filters.market){
    // Preserve per-org authorization before both SQL evidence and M6 search.
    await getNetworkBrowsePage(organizationId,access,"published",{
      q:filters.q,role:filters.role,region:filters.region,persona:filters.persona,page:1,
    });
    const [publishedFirst,discoveredFirst]=await Promise.all([
      searchNetwork({query:filters.q,role:filters.role,region:filters.region,
        market:filters.market,country:"IT",page:1}),
      getNetworkDiscoveredMarketPage(organizationId,access,{
        market:filters.market,q:filters.q,role:filters.role,region:filters.region,
        offset:0,limit:1,
      }).catch(()=>null),
    ]);
    const publishedCount=Math.max(0,publishedFirst.total);
    const discoveredCount=discoveredFirst?.total??0;
    const total=publishedCount+discoveredCount;
    const pages=Math.max(1,Math.ceil(total/COMPACT_NETWORK_PAGE_SIZE));
    const page=Math.min(parseNetworkPage(filters.np),pages);
    const offset=(page-1)*COMPACT_NETWORK_PAGE_SIZE;
    const windows=compactSourceWindows(offset,COMPACT_NETWORK_PAGE_SIZE,publishedCount,discoveredCount);
    const publishedOffset=windows.published.start;
    const m6Page=Math.floor(publishedOffset/18)+1;
    const canonical=m6Page===1?publishedFirst:
      await searchNetwork({query:filters.q,role:filters.role,region:filters.region,
        market:filters.market,country:"IT",page:m6Page});
    const start=publishedOffset%18;
    const take=windows.published.end-windows.published.start;
    const selected=take>0?canonical.items.slice(start,start+take):[];
    const publishedItems:FreeCompany[]=selected.map(company=>({
      id:company.id,legal_name:company.legal_name,trading_name:company.trading_name,
      country_code:company.country_code,website_url:company.website_url,
      claimed_status:company.claimed_status,verification_status:company.verification_status,
      roles:company.roles,products:company.products.map(product=>product.name),
      location:null,
    }));
    const provisionalTake=windows.discovered.end-windows.discovered.start;
    const provisional=provisionalTake>0 && discoveredFirst?
      await getNetworkDiscoveredMarketPage(organizationId,access,{
        market:filters.market,q:filters.q,role:filters.role,region:filters.region,
        offset:windows.discovered.start,limit:provisionalTake,
      }).catch(()=>null):null;
    return {
      items:await withCompactGeoEvidence(organizationId,access,[
        ...publishedItems,...(provisional?.items||[]),
      ]),
      total,published:publishedCount,discovered:discoveredCount,page,pages,
      first:total?offset+1:0,last:Math.min(offset+COMPACT_NETWORK_PAGE_SIZE,total),
      discoveryUnavailable:!discoveredFirst||(provisionalTake>0&&!provisional),
      technicalOnly:true,marketEvidence:true,
      capabilityLabels:Object.fromEntries(selected.map(company=>[
        company.id,company.capabilities.map(x=>x.name),
      ])),
    };
  }
  if(technicalOnly){
    // Keep the Free/Pro tenant access guard before querying published technical data.
    // M6 exposes published structured company attributes, not unverified discoveries.
    await getNetworkBrowsePage(organizationId,access,"published",{
      q:filters.q,role:filters.role,region:filters.region,persona:filters.persona,page:1,
    });
    const requestedPage=parseNetworkPage(filters.np);
    const technicalPage=Math.floor(((requestedPage-1)*COMPACT_NETWORK_PAGE_SIZE)/18)+1;
    const data=await searchNetwork({
      query:filters.q,role:filters.role,region:filters.region,
      product:filters.product,capability:filters.capability,market:filters.market,
      country:filters.country,page:technicalPage,
    });
    const total=Math.max(0,data.total);
    const pages=Math.max(1,Math.ceil(total/COMPACT_NETWORK_PAGE_SIZE));
    const page=Math.min(requestedPage,pages);
    // If a stale URL was beyond the last page, fetch its valid final M6 window.
    const m6Page=Math.floor(((page-1)*COMPACT_NETWORK_PAGE_SIZE)/18)+1;
    const resolved=m6Page===technicalPage?data:await searchNetwork({
      query:filters.q,role:filters.role,region:filters.region,
      product:filters.product,capability:filters.capability,market:filters.market,
      country:filters.country,page:m6Page,
    });
    const startIndex=((page-1)*COMPACT_NETWORK_PAGE_SIZE)%18;
    const selected=resolved.items.slice(startIndex,startIndex+COMPACT_NETWORK_PAGE_SIZE);
    const items=selected.map(company=>({
        id:company.id,legal_name:company.legal_name,trading_name:company.trading_name,
        country_code:company.country_code,website_url:company.website_url,
        claimed_status:company.claimed_status,verification_status:company.verification_status,
        roles:company.roles,products:company.products.map(product=>product.name),
        location:null,
      }));
    return {
      items:await withCompactGeoEvidence(organizationId,access,items),
      total,published:total,discovered:0,page,pages,
      first:total?(page-1)*COMPACT_NETWORK_PAGE_SIZE+1:0,
      last:Math.min(page*COMPACT_NETWORK_PAGE_SIZE,total),
      discoveryUnavailable:false,technicalOnly:true,
      capabilityLabels:Object.fromEntries(selected.map(company=>[company.id,company.capabilities.map(x=>x.name)])),
    };
  }
  const sourceFilters={q:filters.q,role:filters.role,region:filters.region,persona:filters.persona,page:1};
  const [published,discovered]=await Promise.all([
    getNetworkBrowsePage(organizationId,access,"published",sourceFilters),
    getNetworkBrowsePage(organizationId,access,"unconfirmed",sourceFilters).catch(()=>null),
  ]);
  const publishedCount=published.total;
  const discoveredCount=discovered?.total??0;
  const total=publishedCount+discoveredCount;
  const pages=Math.max(1,Math.ceil(total/COMPACT_NETWORK_PAGE_SIZE));
  const page=Math.min(parseNetworkPage(filters.np),pages);
  const offset=(page-1)*COMPACT_NETWORK_PAGE_SIZE;
  const windows=compactSourceWindows(offset,COMPACT_NETWORK_PAGE_SIZE,publishedCount,discoveredCount);
  const [publishedItems,discoveredItems]=await Promise.all([
    sourceSlice(organizationId,access,"published",filters,published,windows.published),
    discovered ? sourceSlice(organizationId,access,"unconfirmed",filters,discovered,windows.discovered):Promise.resolve([]),
  ]);
  return {
    items:await withCompactGeoEvidence(organizationId,access,[...publishedItems,...discoveredItems]),
    total,published:publishedCount,discovered:discoveredCount,
    page,pages,first:total?offset+1:0,last:Math.min(offset+COMPACT_NETWORK_PAGE_SIZE,total),
    discoveryUnavailable:!discovered,
  };
}
