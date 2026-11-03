import Link from "next/link";
import {decideNetworkConnection} from "@/app/(workspace)/network/actions";
import {getWorkspaceContext} from "@/lib/workspace-context";
import {createClient} from "@/lib/supabase/server";
import {canInteractWithNetwork} from "@/lib/access-policy";
import {getCompanyNetworkGrowth} from "@/lib/network-company-growth";
import {getNetworkReplyIntelligence} from "@/lib/network-reply-intelligence";
import {CopyConnectionReminder} from "@/components/copy-connection-reminder";

type Connection={
 id:string;purpose:string;status:string;inquiry_status:string;subject:string;message:string;
 sender_organization_id:string;recipient_organization_id:string;
 sender_name:string;recipient_name:string;company_id:string;created_at:string;decided_at:string|null;
 /** NET-CONN4: sender's approved, published company profile (null if none). */
 sender_network_company_id?:string|null;
};
type Box="connected"|"received"|"sent";
type Listed=Connection&{direction:"received"|"sent"};

/** Historic requests may still carry request_products_services: new purchase
 * requests go through the RFQ Hub only (founder decision, 2 Nov 2026). */
const purposeLabels:Record<string,string>={
 offer_products_services:"Offerta di prodotti o servizi",
 request_products_services:"Richiesta di prodotti o servizi",
 collaboration:"Proposta di collaborazione",
};
const statusLabels:Record<string,string>={
 pending:"In attesa",accepted:"Connessa",declined:"Rifiutata",withdrawn:"Ritirata",
};
const dateFormat=new Intl.DateTimeFormat("it-IT",{day:"numeric",month:"short",year:"numeric"});
function formatDate(value:string|null){
 const time=value?Date.parse(value):NaN;
 return Number.isFinite(time)?dateFormat.format(new Date(time)):null;
}

/** Profile of the OTHER company: recipient for sent requests, sender for received ones. */
function otherCompanyId(item:{direction:"received"|"sent";company_id:string;sender_network_company_id?:string|null}){
 return item.direction==="sent"?item.company_id:item.sender_network_company_id||null;
}

/** NET-CONN2 — Connessioni: Connesse (default) · Ricevute · Inviate. */
export default async function NetworkConnectionsPage({
 searchParams,
}:{searchParams:Promise<{box?:string;error?:string;message?:string}>}){
 const params=await searchParams;
 const box:Box=params.box==="sent"?"sent":params.box==="received"?"received":"connected";
 const actor=await getWorkspaceContext();
 const supabase=await createClient();
 const load=async(which:"received"|"sent")=>{
  const {data,error}=await supabase.rpc("netconnect1_list",{
   p_organization_id:actor.organizationId,p_box:which,p_limit:50,p_offset:0,
  });
  const records=(data??{}) as {items?:Connection[]};
  return error||!Array.isArray(records.items)?null:records.items.map(x=>({...x,direction:which}) as Listed);
 };
 const [received,sent,growth,intelligence]=await Promise.all([
  load("received"),load("sent"),
  getCompanyNetworkGrowth(actor.organizationId).catch(()=>null),
  getNetworkReplyIntelligence(actor.organizationId).catch(()=>null),
 ]);
 const connected=[...(received??[]),...(sent??[])].filter(x=>x.status==="accepted")
  .sort((a,b)=>Date.parse(b.decided_at||b.created_at)-Date.parse(a.decided_at||a.created_at));
 const source=box==="connected"?(received&&sent?connected:null):box==="received"?received:sent;
 const unavailable=source===null;
 const items=source??[];
 const ordered=box==="received"?[...items].sort((a,b)=>Number(b.status==="pending")-Number(a.status==="pending")):items;
 const canAct=canInteractWithNetwork(actor.role);
 const pendingReceived=growth?.requests_received_pending??received?.filter(x=>x.status==="pending").length??0;
 const tabs:{key:Box;label:string;count?:number;badge?:number}[]=[
  {key:"connected",label:"Connesse",count:received&&sent?connected.length:undefined},
  {key:"received",label:"Ricevute",badge:pendingReceived||undefined},
  {key:"sent",label:"Inviate"},
 ];
 const empty={
  connected:{title:"Nessuna connessione attiva",text:"Una connessione nasce quando un’azienda accetta la tua richiesta, o tu accetti la sua.",cta:true},
  received:{title:"Nessuna richiesta ricevuta",text:"Quando un’azienda ti chiederà di connettervi, la troverai qui per accettarla o rifiutarla.",cta:false},
  sent:{title:"Nessuna richiesta inviata",text:"Apri il profilo di un’azienda e premi «Connetti» per proporre un’offerta o una collaborazione.",cta:true},
 }[box];
 const kpi=intelligence&&intelligence.sent>0?[
  intelligence.sent+" inviate",intelligence.accepted+" accettate",intelligence.declined+" rifiutate",
  intelligence.median_decision_hours===null?null:"risposta mediana "+intelligence.median_decision_hours.toLocaleString("it-IT")+" h",
 ].filter(Boolean).join(" · "):null;

 return <main className="mx-auto max-w-4xl space-y-4 pb-16" data-testid="network-connections">
   <header className="flex flex-wrap items-end justify-between gap-2">
    <div>
     <h1 className="text-2xl font-bold tracking-tight text-[#173f35]">Connessioni</h1>
     <p className="mt-1 text-sm text-[#52615b]">Le aziende con cui hai un rapporto confermato e le richieste in corso. Una connessione esiste solo quando l’altra azienda accetta.</p>
    </div>
    <Link href="/network" className="text-sm font-semibold text-[#176647] hover:underline">Cerca aziende →</Link>
   </header>

   {box!=="received"&&pendingReceived>0?<Link href="/network/connections?box=received" data-testid="network-connections-pending"
     className="flex items-center justify-between gap-3 rounded-xl border border-[#e5d3a6] bg-[#fff8e8] px-4 py-3 text-sm text-[#6f5320] hover:bg-[#fff3d6]">
     <span><strong className="tabular-nums">{pendingReceived}</strong> {pendingReceived===1?"richiesta ricevuta attende":"richieste ricevute attendono"} la tua risposta</span>
     <span className="font-semibold">Valuta →</span>
    </Link>:null}

   <nav aria-label="Connessioni" className="flex flex-wrap gap-2">
    {tabs.map(t=><Link key={t.key} href={"/network/connections?box="+t.key}
      aria-current={box===t.key?"page":undefined}
      className={"ui-action inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold "+(box===t.key?"ui-action-primary":"ui-action-secondary")}>
      {t.label}
      {t.count!==undefined?<span className="tabular-nums opacity-80">{t.count}</span>:null}
      {t.badge?<span className="rounded-full bg-[#f2c66d] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#4b3610]" aria-label={t.badge+" in attesa"}>{t.badge}</span>:null}
     </Link>)}
   </nav>

   {params.error?<p role="alert" className="rounded-xl border border-[#dfc8ab] bg-[#fff8ed] p-3 text-sm text-[#765821]">{params.error}</p>:null}
   {params.message?<p role="status" className="rounded-xl border border-[#c8decf] bg-[#f2f9f5] p-3 text-sm text-[#175640]">{params.message}</p>:null}
   {box==="sent"&&kpi?<p className="text-xs text-[#52615b]" data-testid="network-connections-kpi">Ultimi 90 giorni: {kpi}</p>:null}

   {unavailable?<section role="status" className="rounded-xl border border-[#e3d1a7] bg-[#fff9ed] p-5 text-sm text-[#725929]">
      Le connessioni non sono disponibili in questo momento. <Link href={"/network/connections?box="+box} className="font-semibold underline">Riprova</Link>
    </section>:ordered.length===0?<section className="rounded-2xl border border-[#dce7df] bg-white p-6">
      <h2 className="text-lg font-semibold text-[#173f35]">{empty.title}</h2>
      <p className="mt-2 text-sm text-[#52615b]">{empty.text}</p>
      {empty.cta?<Link href="/network" className="ui-action ui-action-primary mt-4 inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-semibold">Cerca aziende</Link>:null}
    </section>:box==="connected"?<section aria-label="Aziende connesse" className="overflow-hidden rounded-2xl border border-[#d7e3dc] bg-white">
      {ordered.map(item=>{
       const name=item.direction==="sent"?item.recipient_name:item.sender_name;
       const since=formatDate(item.decided_at||item.created_at);
       return <article key={item.id} data-testid="network-connected-row" className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eeeb] px-4 py-3 last:border-b-0">
        <div className="min-w-0">
         <h2 className="truncate text-sm font-semibold text-[#173f35]">{name}</h2>
         <p className="text-xs text-[#52615b]">{purposeLabels[item.purpose]||"Richiesta commerciale"}{since?" · connessa dal "+since:""} · {item.direction==="sent"?"richiesta da te":"richiesta da loro"}</p>
        </div>
        {otherCompanyId(item)?<Link href={"/network/"+otherCompanyId(item)} className="text-xs font-semibold text-[#176647] underline">Apri profilo</Link>:null}
       </article>;
      })}
    </section>:<section aria-label={box==="received"?"Richieste ricevute":"Richieste inviate"} className="space-y-3">
     {ordered.map(item=>{
      const sentOn=formatDate(item.created_at);
      return <article key={item.id} className={"rounded-2xl border bg-white p-4 sm:p-5 "+(box==="received"&&item.status==="pending"?"border-[#e5d3a6]":"border-[#dce6de]")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
       <div className="min-w-0">
        <h2 className="text-base font-semibold text-[#173f35]">{box==="received"?item.sender_name:item.recipient_name}</h2>
        <p className="mt-0.5 text-xs text-[#52615b]">{purposeLabels[item.purpose]||"Richiesta commerciale"}{sentOn?" · "+sentOn:""}</p>
       </div>
       <span className={"rounded-full px-3 py-1 text-xs font-semibold "+(item.status==="accepted"?"bg-[#e5f3e9] text-[#176647]":item.status==="pending"?"bg-[#fff4df] text-[#875b1e]":"bg-[#f0f2f0] text-[#52615b]")}>{statusLabels[item.status]||item.status}</span>
      </div>
      {box==="received"&&item.status==="pending"?<p className="mt-3 text-xs font-semibold text-[#176647]">Decisione richiesta · leggi la proposta prima di rispondere</p>:null}
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#43524c]">{item.message}</p>
      {box==="sent"&&item.status==="pending"&&canAct&&Number.isFinite(Date.parse(item.created_at))&&
        Date.now()-Date.parse(item.created_at)>=7*24*60*60*1000?
       <div className="mt-3 rounded-xl border border-[#dae6dc] bg-[#f7faf8] p-3">
         <p className="mb-2 text-xs leading-5 text-[#52615b]">In attesa da almeno 7 giorni. Puoi copiare un promemoria da inviare tu, su un canale che usate già: la piattaforma non manda solleciti.</p>
         <CopyConnectionReminder recipient={item.recipient_name} purpose={purposeLabels[item.purpose]||"Richiesta commerciale"} createdAt={item.created_at}/>
       </div>:null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
       {otherCompanyId(item)?<Link href={"/network/"+otherCompanyId(item)} data-testid="network-connection-profile" className="text-xs font-semibold text-[#176647] underline">Apri profilo</Link>:<span/>}
       {canAct&&item.status==="pending" && (box==="received" || item.inquiry_status==="submitted")?<div className="flex flex-wrap gap-2">
         {(box==="received"?[{decision:"accepted",label:"Accetta connessione"},{decision:"declined",label:"Rifiuta"}]:[{decision:"withdrawn",label:"Ritira richiesta"}]).map(a=>
          <form action={decideNetworkConnection} key={a.decision}>
           <input type="hidden" name="request_id" value={item.id}/>
           <input type="hidden" name="decision" value={a.decision}/>
           <button className={"ui-action min-h-10 rounded-xl px-4 text-xs font-semibold "+(a.decision==="accepted"?"ui-action-primary":"ui-action-secondary")}>{a.label}</button>
          </form>)}
        </div>:null}
      </div>
     </article>;})}
    </section>}
 </main>;
}
