import Link from "next/link";
import type {NetworkReplyIntelligence} from "@/lib/network-reply-intelligence";

/** A private sender-only pulse, never a public vendor leaderboard or synthetic reply-rate. */
export function NetworkReplyPulse({data}:{data:NetworkReplyIntelligence|null}){
 return <section aria-label="Decisioni sulle richieste inviate" className="rounded-2xl border border-[#d7e6dc] bg-white p-4 sm:p-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#287153]">Intelligence commerciale · solo la tua azienda</p>
    <h2 className="mt-1 text-lg font-semibold text-[#173f35]">Dalle richieste alle decisioni</h2>
    <p className="mt-1 text-xs leading-5 text-[#53675a]">Ultimi 90 giorni · richieste inviate dalla tua organizzazione; non misura messaggi o qualità della risposta.</p>
   </div>
   <Link href="/network?source=connections" className="inline-flex min-h-10 items-center rounded-lg border border-[#cadbcf] bg-[#f5faf6] px-3 text-xs font-semibold text-[#175640]">Trova controparti →</Link>
  </div>
  {data?<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
   {[
    {label:"Richieste inviate",value:String(data.sent),note:"Anche in attesa"},
    {label:"Accettate",value:String(data.accepted),note:"Decisioni positive"},
    {label:"Rifiutate",value:String(data.declined),note:"Decisioni negative"},
    {label:"Tempo mediano decisione",value:data.median_decision_hours===null?"—":data.median_decision_hours.toLocaleString("it-IT")+" h",
     note:data.median_decision_hours===null?"Servono almeno 3 decisioni datate":"Su "+data.decided_with_timestamp+" decisioni con data"},
   ].map(c=><article key={c.label} className="rounded-xl bg-[#f4f8f5] p-3">
    <p className="text-[11px] font-medium text-[#52645a]">{c.label}</p>
    <p className="mt-2 text-2xl font-semibold tabular-nums text-[#173f35]">{c.value}</p>
    <p className="mt-1 text-[11px] leading-4 text-[#617269]">{c.note}</p>
   </article>)}
  </div>:<p role="status" className="mt-3 text-sm text-[#765821]">Dati delle decisioni temporaneamente non verificabili; nessun numero viene stimato.</p>}
  {data?.pending_over_7_days ? <p className="mt-3 rounded-lg border border-[#e5d6b6] bg-[#fffaf0] px-3 py-2 text-xs leading-5 text-[#795821]">
   {data.pending_over_7_days} richieste inviate ancora in attesa da almeno 7 giorni. Puoi preparare un riepilogo da utilizzare manualmente; nessun sollecito viene inviato dalla piattaforma.
  </p>:null}
 </section>;
}
