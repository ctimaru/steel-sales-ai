import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {getPlatformAccessContext,requirePlatformPermission} from "@/lib/platform-admin";
import {decideGeoEvidence} from "./actions";
type Entry={id:string;company_id:string;legal_name:string;city:string;province_code:string|null;region:string|null;address_line_1:string|null;source_url:string;source_kind:string;evidence_snippet:string;created_at:string};
export default async function GeoReviewPage({searchParams}:{searchParams:Promise<{message?:string;error?:string}>}){
 await requirePlatformPermission("discovery.read");
 const context=await getPlatformAccessContext();
 const canReview=context?.permissions.includes("discovery.governance_review")??false;
 const params=await searchParams;
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("crawl_it61_geo_review_queue");
 const items=(data??[]) as Entry[];
 return <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
  <Link className="text-sm underline" href="/platform/company-discovery/governance">← Governance Discovery</Link>
  <header className="space-y-2"><p className="platform-kicker">CRAWL-IT6.1 · Italia</p><h1 className="text-3xl font-semibold">Revisione evidenze geografiche</h1>
  <p className="text-sm text-[#52615b]">Verifica l'identità aziendale e la fonte della località. L'approvazione trasferisce solo l'evidenza alla fase di valutazione della sede: non crea né pubblica una sede.</p></header>
  {params.message?<p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-900">{params.message}</p>:null}
  {params.error||error?<p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-900">{params.error??"Impossibile leggere le evidenze."}</p>:null}
  <h2 className="font-semibold">In attesa di revisione ({items.length})</h2>
  {!items.length&&!error?<p className="rounded-xl border p-4 text-sm">Nessuna evidenza geografica da esaminare.</p>:null}
  {items.map(e=><article key={e.id} className="space-y-3 rounded-2xl border bg-white p-4">
   <h3 className="font-semibold">{e.legal_name}</h3><p className="text-sm">{e.city}{e.province_code?` (${e.province_code})`:""}{e.region?` · ${e.region}`:""}</p>
   {e.address_line_1?<p className="text-sm">{e.address_line_1}</p>:null}
   <p className="text-xs text-[#52615b]">{e.source_kind} · {e.evidence_snippet}</p>
   <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="block break-all text-sm underline">Apri la fonte dell'evidenza</a>
   {canReview?<form action={decideGeoEvidence} className="grid gap-3 sm:grid-cols-2">
    <input type="hidden" name="id" value={e.id}/>
    <label className="grid gap-1 text-sm">Decisione<select name="decision" className="min-h-11 rounded-lg border px-3">
     <option value="conflict">Da approfondire · conflitto</option><option value="rejected">Rifiuta</option><option value="approved_for_facility_review">Approva per revisione sede</option>
    </select></label>
    <label className="grid gap-1 text-sm">Motivazione<input name="note" required minLength={12} maxLength={2000} className="min-h-11 rounded-lg border px-3" placeholder="Spiega la verifica eseguita"/></label>
    <button className="min-h-11 rounded-xl border border-[#173f35] px-4 font-semibold sm:col-span-2">Registra revisione (senza pubblicare)</button>
   </form>:null}
  </article>)}
 </main>;
}
