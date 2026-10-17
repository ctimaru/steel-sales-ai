import Link from "next/link";

export function parseNetworkPage(value: string | undefined): number {
  const raw = (value ?? "").trim();
  if (!/^[1-9][0-9]{0,5}$/.test(raw)) return 1;
  const page = Number(raw);
  return page <= 100000 ? page : 1;
}

export function NetworkPagination({
  page, total, pageSize, parameter, params, anchor,
}: {
  page:number;total:number;pageSize:number;
  parameter:"p"|"dpage";params:Record<string,string|undefined>;anchor:string;
}) {
  const maxPage = Math.max(1,Math.ceil(total / Math.max(1,pageSize)));
  const href=(target:number)=>{
    const query=new URLSearchParams();
    for(const [key,value] of Object.entries(params)){
      if(value && !["message","error","p","dpage"].includes(key))query.set(key,value);
    }
    const other=parameter==="p"?"dpage":"p";
    if(params[other] && parseNetworkPage(params[other])>1)query.set(other,String(parseNetworkPage(params[other])));
    if(target>1)query.set(parameter,String(target));
    return "/network"+(query.size?"?"+query.toString():"")+"#"+anchor;
  };
  if(total<=pageSize && page===1)return null;
  const first=(page-1)*pageSize+1;
  const last=Math.min(page*pageSize,total);
  return (
    <nav aria-label={parameter==="p"?"Pagine dei profili pubblicati":"Pagine delle aziende da confermare"}
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce5df] bg-white px-3 py-2">
      <p className="text-xs font-medium tabular-nums text-[#52615b]">
        {total>0&&first<=total?`Risultati ${first}–${last} di ${total}`:`Pagina ${page} senza risultati · ${total} disponibili`}
      </p>
      <div className="flex items-center gap-2">
        {page>1?<Link rel="prev" href={href(page-1)}
          className="inline-flex min-h-10 items-center rounded-lg border border-[#b8d2c8] px-3 text-xs font-semibold text-[#173f35] hover:bg-[#edf5f2]">← Precedenti</Link>:null}
        <span className="px-1 text-xs font-semibold tabular-nums text-[#52615b]">{page} / {maxPage}</span>
        {page<maxPage?<Link rel="next" href={href(page+1)}
          className="inline-flex min-h-10 items-center rounded-lg bg-[#173f35] px-3 text-xs font-semibold text-white hover:bg-[#245746]">Successive →</Link>:null}
      </div>
    </nav>
  );
}
