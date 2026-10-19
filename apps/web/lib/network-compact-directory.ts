import "server-only";

import {getNetworkBrowsePage, type FreeCompany, type NetworkBrowsePage} from "@/lib/network-free";
import {parseNetworkPage} from "@/components/network-pagination";

/** NET-UX COMPACT1: one honest, stable server-side pagination across BOTH feeds.
 * Keep each existing RLS/entitlement-gated source and its original provenance.
 * 6 real companies per page makes first results visible on standard laptop screens.
 */
export const COMPACT_NETWORK_PAGE_SIZE=6;
export type CompactNetworkFilters={
  q?:string;role?:string;region?:string;persona?:string;np?:string;
};
export type CompactNetworkPage={
  items:FreeCompany[];total:number;published:number;discovered:number;
  page:number;pages:number;first:number;last:number;discoveryUnavailable:boolean;
};
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
    items:[...publishedItems,...discoveredItems],total,published:publishedCount,discovered:discoveredCount,
    page,pages,first:total?offset+1:0,last:Math.min(offset+COMPACT_NETWORK_PAGE_SIZE,total),
    discoveryUnavailable:!discovered,
  };
}
