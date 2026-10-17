import Link from "next/link";
import {redirect} from "next/navigation";
import {decideNetworkConnection} from "@/app/(workspace)/network/actions";
import {getWorkspaceContext} from "@/lib/workspace-context";
import {createClient} from "@/lib/supabase/server";
import {canInteractWithNetwork} from "@/lib/access-policy";
import {getCompanyNetworkGrowth} from "@/lib/network-company-growth";

type Connection={
 id:string;purpose:string;status:string;inquiry_status:string;subject:string;message:string;
 sender_organization_id:string;recipient_organization_id:string;
 sender_name:string;recipient_name:string;company_id:string;created_at:string;decided_at:string|null;
};
const purposeLabels:Record<string,string>={
 offer_products_services:"Offerta di prodotti o servizi",
 request_products_services:"Richiesta di prodotti o servizi",
 collaboration:"Proposta di collaborazione",
};
const statusLabels:Record<string,string>={
 pending:"In attesa",accepted:"Connessione accettata",declined:"Rifiutata",withdrawn:"Ritirata",
};
export default async function NetworkConnectionsPage({
 searchParams,
}:{searchParams:Promise<{box?:string;error?:string;message?:string}>}){
 const params=await searchParams;
 const box=params.box==="sent"?"sent":"received";
 const actor=await getWorkspaceContext();
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netconnect1_list",{
  p_organization_id:actor.organizationId,p_box:box,p_limit:50,p_offset:0,
 });
 const records=(data??{}) as {items?:Connection[];total?:number};
 const unavailable=Boolean(error)||!Array.isArray(records.items);
 const items=unavailable?[]:records.items??[];
 const ordered=box==="received"?[...items].sort((a,b)=>Number(b.status==="pending")-Number(a.status==="pending")):items;
 const canAct=canInteractWithNetwork(actor.role);
 const growth=await getCompanyNetworkGrowth(actor.organizationId).catch(()=>null);
 const pendingReceived=growth?.requests_received_pending;
 const currentPending=box==="received"?ordered.filter(x=>x.status==="pending").length:0;
 return <main className="mx-auto max-w-5xl space-y-5 pb-16">
   <div className="rounded-2xl border border-[#d4e3da] bg-[#f3f8f5] p-5 sm:p-7">
    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#32745a]">Network professionale</p>
    <h1 className="mt-2 text-2xl font-semibold text-[#173f35]">Connessioni aziendali</h1>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#52615b]">Proposte con un obiettivo commerciale, inviate e ricevute tra aziende. Una connessione esiste soltanto quando il destinatario l'ha accettata.</p>
    <Link href="/network" className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-[#b8d2c8] bg-white px-4 text-sm font-semibold text-[#173f35]">Esplora aziende →</Link>
    <Link href="/network/start" className="ml-2 inline-flex min-h-10 items-center rounded-xl border border-[#b8d2c8] bg-white px-4 text-sm font-semibold text-[#173f35]">Il mio percorso →</Link>
   </div>
   <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center rounded-2xl border border-[#c8dfd0] bg-white p-4 sm:p-5">
     <div>
       <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#287153]">Prima risposta commerciale</p>
       <h2 className="mt-1 text-lg font-semibold text-[#173f35]">{pendingReceived===undefined?"Richieste da verificare":pendingReceived===0?"Nessuna richiesta in attesa":pendingReceived+" richieste ricevute in attesa"}</h2>
       <p className="mt-1 text-xs leading-5 text-[#52615b]">Le richieste in attesa compaiono per prime. Leggi la motivazione, poi accetta o rifiuta: nessuna relazione si attiva da sola.</p>
     </div>
     <Link href="/network/connections?box=received" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#c4dccc] bg-[#edf7f0] px-4 text-xs font-semibold text-[#175640]">Esamina le ricevute →</Link>
   </div>
   <nav aria-label="Richieste di connessione" className="flex flex-wrap gap-2">
    {[{key:"received",label:"Ricevute"},{key:"sent",label:"Inviate"}].map(t=>
      <Link key={t.key} href={"/network/connections?box="+t.key}
       aria-current={box===t.key?"page":undefined}
       className={"inline-flex min-h-10 items-center rounded-xl border px-4 text-sm font-semibold "+(box===t.key?"border-[#173f35] bg-[#173f35] text-white":"border-[#cbded3] bg-white text-[#173f35]")}>{t.label}</Link>)}
   </nav>
   {params.error?<p role="alert" className="rounded-xl border border-[#dfc8ab] bg-[#fff8ed] p-3 text-sm text-[#765821]">{params.error}</p>:null}
   {params.message?<p role="status" className="rounded-xl border border-[#c8decf] bg-[#f2f9f5] p-3 text-sm text-[#175640]">{params.message}</p>:null}
   {!unavailable&&box==="received"&&currentPending>0?<p className="text-xs font-semibold text-[#52615b]">Richieste in attesa in cima all’elenco delle ultime 50. Rispondi soltanto dopo aver letto il messaggio.</p>:null}
   {unavailable?<section role="status" className="rounded-xl border border-[#e3d1a7] bg-[#fff9ed] p-5 text-sm text-[#725929]">
      Le richieste non sono disponibili in questo momento. <Link href="/network/connections" className="font-semibold underline">Riprova</Link>
    </section>:items.length===0?<section className="rounded-2xl border border-[#dce7df] bg-white p-6">
      <h2 className="text-lg font-semibold text-[#173f35]">Nessuna richiesta {box==="received"?"ricevuta":"inviata"}</h2>
      <p className="mt-2 text-sm text-[#52615b]">{box==="received"?"Quando un’azienda ti invierà una richiesta motivata, potrai accettarla o rifiutarla da qui.":"Esplora le aziende e invia una proposta motivata per ciò che offri, cerchi o vuoi sviluppare insieme."}</p>
      <Link href="/network" className="app-primary mt-4 inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-semibold">Esplora aziende</Link>
    </section>:<section aria-label="Elenco richieste" className="space-y-3">
     {ordered.map(item=><article key={item.id} className="rounded-2xl border border-[#dce6de] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
       <div>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#36745a]">{box==="received"?"Da "+item.sender_name:"A "+item.recipient_name}</p>
        <h2 className="mt-2 text-base font-semibold text-[#173f35]">{purposeLabels[item.purpose]||"Richiesta commerciale"}</h2>
       </div>
       <span className={"rounded-full px-3 py-1 text-xs font-semibold "+(item.status==="accepted"?"bg-[#e5f3e9] text-[#176647]":item.status==="pending"?"bg-[#fff4df] text-[#875b1e]":"bg-[#f0f2f0] text-[#52615b]")}>{statusLabels[item.status]||item.status}</span>
      </div>
      {box==="received"&&item.status==="pending"?<p className="mt-3 text-xs font-semibold text-[#176647]">Decisione richiesta · leggi la proposta prima di rispondere</p>:null}
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#43524c]">{item.message}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
       <Link href={"/network/"+item.company_id} className="text-xs font-semibold text-[#176647] underline">Apri profilo aziendale</Link>
       {canAct&&item.status==="pending" && (box==="received" || item.inquiry_status==="submitted")?<div className="flex flex-wrap gap-2">
         {(box==="received"?[{decision:"accepted",label:"Accetta connessione"},{decision:"declined",label:"Rifiuta"}]:[{decision:"withdrawn",label:"Ritira richiesta"}]).map(a=>
          <form action={decideNetworkConnection} key={a.decision}>
           <input type="hidden" name="request_id" value={item.id}/>
           <input type="hidden" name="decision" value={a.decision}/>
           <button className={a.decision==="accepted"?"app-primary min-h-10 rounded-xl px-4 text-xs font-semibold":"min-h-10 rounded-xl border border-[#d4e1d9] px-4 text-xs font-semibold text-[#52615b]"}>{a.label}</button>
          </form>)}
        </div>:null}
      </div>
     </article>)}
    </section>}
 </main>;
}
