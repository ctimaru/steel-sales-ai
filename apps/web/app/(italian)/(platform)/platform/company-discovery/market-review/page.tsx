import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {getPlatformAccessContext,requirePlatformPermission} from "@/lib/platform-admin";
import {safeNetworkWebsiteUrl} from "@/lib/network-free";
import {decideMarketEvidence} from "./actions";

export const dynamic="force-dynamic";
type Candidate={
 id:string;company_name:string;domain:string;market_key:string;market_name:string;
 source_url:string;summary:string;review_status:"candidate";
};
type ReviewResponse={contract:"netdata1c-review-v1";items:Candidate[]};
export default async function NetworkMarketReviewPage({searchParams}:{
 searchParams:Promise<{error?:string;message?:string}>
}){
 await requirePlatformPermission("discovery.read");
 const access=await getPlatformAccessContext();
 const canReview=Boolean(access?.permissions?.includes("discovery.enrich"));
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netdata1c_market_review_queue",{p_limit:50});
 const response=data as ReviewResponse|null;
 const items=!error&&response?.contract==="netdata1c-review-v1"&&Array.isArray(response.items)
  ?response.items:[];
 const params=await searchParams;
 return <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
  <Link href="/platform/company-discovery"
    className="inline-flex min-h-10 items-center text-sm font-semibold text-[#175640] underline underline-offset-4">
    ← Company Discovery
  </Link>
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <p className="platform-kicker">NET-UX DATA1C · Company Intelligence</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#173f35]">
        Mercati industriali · fonti e revisioni
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52615b]">
        Associa il settore soltanto quando il sito aziendale descrive esplicitamente l'attività.
        L'approvazione riguarda il settore documentato, non la verifica della società,
        la capacità produttiva o la sua disponibilità a ricevere RFQ.
      </p>
    </div>
    <div className="rounded-xl border border-[#c7dcd0] bg-[#f6faf7] px-4 py-2">
      <p className="text-2xl font-bold tabular-nums text-[#173f35]">{items.length}</p>
      <p className="text-[11px] text-[#52615b]">evidenze in coda (max 50)</p>
    </div>
  </div>
  {params.message?<p role="status" className="rounded-lg border border-[#c1d9c7] p-3 text-sm text-[#175640]">{params.message}</p>:null}
  {params.error?<p role="alert" className="rounded-lg border border-[#f1ceaa] p-3 text-sm text-[#84501c]">{params.error}</p>:null}
  {error||!response||response.contract!=="netdata1c-review-v1"?
    <p role="alert" className="rounded-lg border border-[#f1ceaa] p-4 text-sm text-[#84501c]">
      Registro dei mercati non disponibile. Verifica la migrazione DATA1C e i permessi della piattaforma.
    </p>:!items.length?
    <p className="rounded-lg border border-[#c7dcd0] p-4 text-sm text-[#52615b]">
      Nessuna proposta da rivedere. Il crawler non è avviato automaticamente.
    </p>:
    <section aria-label="Proposte settore aziendale" className="grid gap-3 lg:grid-cols-2">
      {items.map(item=><article key={item.id}
        className="min-w-0 space-y-2 rounded-xl border border-[#d7e3dc] bg-white p-4">
        <div className="flex flex-wrap justify-between gap-2">
          <div className="min-w-0">
            <h2 className="break-words text-sm font-bold text-[#173f35]">{item.company_name}</h2>
            <p className="break-all text-xs text-[#52615b]">{item.domain}</p>
          </div>
          <span className="h-fit rounded-full bg-[#e9f2ed] px-2.5 py-1 text-xs font-semibold text-[#175640]">
            {item.market_name}
          </span>
        </div>
        <p className="text-xs leading-5 text-[#34483e]">{item.summary}</p>
        {safeNetworkWebsiteUrl(item.source_url)?<a
          href={safeNetworkWebsiteUrl(item.source_url)||"#"}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex max-w-full break-all text-xs font-semibold text-[#175640] underline underline-offset-2">
          Apri fonte ufficiale ↗
        </a>:null}
        <p className="text-[11px] leading-4 text-[#52615b]">
          Settore indicativo, fonte da verificare. Non usare per attestare acquisti, certificazioni o approvazioni.
        </p>
        {canReview?<div className="flex flex-wrap gap-2">
          <form action={decideMarketEvidence}>
            <input type="hidden" name="id" value={item.id}/>
            <input type="hidden" name="decision" value="accept"/>
            <button type="submit" className="ui-action ui-action-primary min-h-10 rounded-lg px-3 text-xs font-semibold">
              Approva settore documentato
            </button>
          </form>
          <form action={decideMarketEvidence}>
            <input type="hidden" name="id" value={item.id}/>
            <input type="hidden" name="decision" value="reject"/>
            <button type="submit" className="ui-action ui-action-secondary min-h-10 rounded-lg px-3 text-xs font-semibold">
              Rifiuta evidenza
            </button>
          </form>
        </div>:<p className="text-xs text-[#84501c]">Revisione riservata al ruolo Platform abilitato.</p>}
      </article>)}
    </section>}
 </main>;
}
