import Link from "next/link";
import {redirect} from "next/navigation";

import {getWorkspaceContext} from "@/lib/workspace-context";
import {getCompanyNetworkGrowth} from "@/lib/network-company-growth";
import {getNetworkReplyIntelligence} from "@/lib/network-reply-intelligence";
import {NetworkReplyPulse} from "@/components/network-reply-pulse";
import {getManagedNetworkCompany,getManagedNetworkProfileState,getInquiryPreferences} from "@/lib/network";
import {getFreeNetworkViewerRole} from "@/lib/network-free";
import {isNetworkFrontendEnabled} from "@/lib/network-flags";
import {canInteractWithNetwork} from "@/lib/access-policy";
import {appRoutes} from "@/lib/routes";

export const dynamic="force-dynamic";

const interests:Record<string,{role:string;label:string;reason:string}[]>={
  producer:[
    {role:"trader_distributor",label:"Commercianti",reason:"Distribuzione e presenza sul territorio"},
    {role:"processor_service_provider",label:"Terzisti",reason:"Lavorazioni e capacità complementari"},
    {role:"end_user",label:"Utilizzatori",reason:"Mercati di sbocco e progetti industriali"},
  ],
  trader_distributor:[
    {role:"end_user",label:"Utilizzatori",reason:"Possibili clienti e applicazioni"},
    {role:"processor_service_provider",label:"Terzisti",reason:"Servizi e lavorazioni aggiuntive"},
    {role:"producer",label:"Produttori",reason:"Fonti di approvvigionamento"},
  ],
  processor_service_provider:[
    {role:"trader_distributor",label:"Commercianti",reason:"Collaborazioni con distributori"},
    {role:"end_user",label:"Utilizzatori",reason:"Progetti e lavorazioni richieste"},
    {role:"producer",label:"Produttori",reason:"Partnership di filiera"},
  ],
  end_user:[
    {role:"trader_distributor",label:"Commercianti",reason:"Materiali e disponibilità a stock"},
    {role:"processor_service_provider",label:"Terzisti",reason:"Taglio, lavorazioni e trattamenti"},
    {role:"producer",label:"Produttori",reason:"Forniture e capacità produttive"},
  ],
};

export default async function NetworkCompanyStartPage(){
  if(!isNetworkFrontendEnabled())redirect("/dashboard");
  const actor=await getWorkspaceContext();
  const admin=actor.role==="admin";
  const canSend=canInteractWithNetwork(actor.role);
  const [progressResult,managedResult,personaResult,replyResult]=await Promise.allSettled([
    getCompanyNetworkGrowth(actor.organizationId),
    admin?getManagedNetworkCompany():Promise.resolve(null),
    getFreeNetworkViewerRole(actor.organizationId),
    getNetworkReplyIntelligence(actor.organizationId),
  ]);
  const growth=progressResult.status==="fulfilled"?progressResult.value:null;
  // A failed authorized RPC is NOT a zero count or proof of missing ownership.
  const managed=growth&&managedResult.status==="fulfilled" &&
    managedResult.value?.organization_id===actor.organizationId &&
    managedResult.value.network_company_id===growth.owned_company_id
    ?managedResult.value:null;
  const ownershipUnknown=progressResult.status==="rejected"|| (admin&&managedResult.status==="rejected");
  const profile=managed?await getManagedNetworkProfileState(managed.network_company_id).catch(()=>null):null;
  const preferences=managed?await getInquiryPreferences(actor.organizationId).catch(()=>null):null;
  const persona=personaResult.status==="fulfilled"?personaResult.value:null;
  const suggested=interests[persona||""]||interests.end_user;
  const owned=Boolean(growth?.owned_company_id);
  const sent=(growth?.requests_sent??0)>0;
  const accepted=(growth?.requests_accepted??0)>0;
  const pending=(growth?.claim_requests_pending??0)>0;
  const inbound=(growth?.requests_received_pending??0)>0;
  const primary=inbound&&canSend
    ?{label:"Valuta richieste ricevute",href:appRoutes.network.connections+"?box=received"}
    :growth&&!owned&&admin
      ?{label:pending?"Esplora aziende mentre il claim è in revisione":"Trova e rivendica il tuo profilo",href:appRoutes.network.directory}
      :sent
        ?{label:"Controlla le richieste inviate",href:appRoutes.network.connections+"?box=sent"}
        :{label:"Esplora aziende della filiera",href:appRoutes.network.directory};
  const steps=[
    {label:"Registrazione aziendale",status:"ready" as const,detail:"Organizzazione attiva e accesso autenticato",href:appRoutes.home,cta:"Workspace"},
    {label:"Titolarità del profilo",status:!growth||ownershipUnknown?"unknown" as const:owned?"ready" as const:pending?"pending" as const:"todo" as const,
      detail:owned?"Profilo pubblicato con claim approvato e collegamento attivo":
        pending?"Richiesta di gestione in attesa di approvazione":
        admin?"Trova la tua azienda e presenta una richiesta di gestione":
          "La gestione del profilo richiede un amministratore aziendale",
      href:owned?appRoutes.network.manage:appRoutes.network.directory,
      cta:owned?"Gestisci profilo":"Cerca il profilo"},
    {label:"Presentazione industriale",status:!growth||ownershipUnknown?"unknown" as const:!owned?"todo" as const:!profile?"unknown" as const:
        profile.completeness.percentage>=100?"ready" as const:"todo" as const,
      detail:profile?"Informazioni compilate: "+profile.completeness.passed_sections+"/"+profile.completeness.total_sections+" sezioni (indicatore informativo, non un requisito di verifica)":
        owned&&!admin?"L'amministratore può completare prodotti, servizi e competenze":
        "Descrivi prodotti, servizi e competenze quando gestisci il profilo",
      href:appRoutes.network.manage,cta:"Completa dati"},
    {label:"Prima richiesta commerciale",status:!growth?"unknown" as const:sent?"ready" as const:"todo" as const,
      detail:sent?"Una o più richieste inviate a controparti della rete":"Scegli un'impresa e specifica se vuoi offrire, acquistare o collaborare",
      href:sent?appRoutes.network.connections+"?box=sent":appRoutes.network.directory,
      cta:sent?"Richieste inviate":"Trova controparti"},
    {label:"Prima connessione accettata",status:!growth?"unknown" as const:accepted?"ready" as const:"todo" as const,
      detail:accepted?"Almeno un'impresa ha accettato la tua richiesta":
        "Una relazione viene conteggiata solo quando la controparte accetta",
      href:appRoutes.network.connections+"?box=sent",cta:"Le mie connessioni"},
  ];

  return <main className="mx-auto max-w-[1100px] space-y-5 pb-16">
    <nav aria-label="Percorso Network" className="flex flex-wrap gap-2 text-xs">
      <Link href={appRoutes.network.directory} className="font-semibold text-[#236d52] hover:underline">← Esplora aziende</Link>
      <span className="text-[#8a9790]">/</span><span className="text-[#52615b]">Attivazione aziendale</span>
    </nav>
    <header className="rounded-3xl border border-[#b9d6c7] bg-[#f1f7f3] p-5 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#32745a]">Network · Percorso aziendale</p>
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#173f35] sm:text-3xl">Attiva le opportunità per {actor.organizationName}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#43584b]">
            Rendi riconoscibile l'azienda, trova controparti adatte e avvia conversazioni commerciali con uno scopo preciso.
            Nessuna funzione «Segui», nessun invito automatico.
          </p>
        </div>
        <Link href={primary.href} className="app-primary inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold">
          {primary.label} →
        </Link>
      </div>
    </header>
    {!growth?<section role="status" className="rounded-2xl border border-[#e2d0a3] bg-[#fff9ed] p-4 text-sm text-[#795521]">
      Dati delle connessioni temporaneamente non disponibili. Il percorso resta consultabile, ma i conteggi non sono mostrati come zero.
    </section>:null}
    <NetworkReplyPulse data={replyResult.status==="fulfilled"?replyResult.value:null}/>
    <section aria-label="Stato connessioni" className="grid gap-3 sm:grid-cols-3">
      {([
        {label:"Richieste inviate",value:growth?.requests_sent,note:"Invii effettivi, anche se non ancora accettati"},
        {label:"Connessioni accettate",value:growth?.requests_accepted,note:"Controparti che hanno accettato una tua richiesta"},
        {label:"Da valutare",value:growth?.requests_received_pending,note:"Richieste ricevute che attendono risposta"},
      ]).map(item=><article key={item.label} className="rounded-2xl border border-[#dae5de] bg-white p-4">
        <p className="text-xs font-semibold text-[#52615b]">{item.label}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-[#173f35]">{item.value===undefined?"—":item.value.toLocaleString("it-IT")}</p>
        <p className="mt-2 text-xs leading-5 text-[#617066]">{item.note}</p>
      </article>)}
    </section>
    <section className="rounded-2xl border border-[#dae5de] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[#173f35]">Il tuo percorso</h2>
          <p className="mt-1 text-xs text-[#617066]">Fatti verificabili, non punteggi social. Completa solo ciò che ti serve.</p>
        </div>
        {owned&&managed?<Link href={appRoutes.network.manage} className="text-xs font-semibold text-[#176647] underline">Modifica il profilo →</Link>:null}
      </div>
      <ol className="mt-4 divide-y divide-[#edf1ee]">
        {steps.map((step,index)=><li key={step.label} className="flex flex-wrap items-center gap-3 py-4 sm:flex-nowrap">
          <span aria-hidden="true" className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold "+
            (step.status==="ready"?"bg-[#e2f1e7] text-[#176647]":
              step.status==="pending"?"bg-[#fff1d5] text-[#805d21]":"bg-[#eff2f0] text-[#53675b]")}>
            {step.status==="ready"?"✓":index+1}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-[#173f35]">{step.label}</h3>
            <p className="mt-1 text-xs leading-5 text-[#62746a]">{step.detail}</p>
          </div>
          <span className="text-xs font-semibold text-[#52615b]">
            {step.status==="ready"?"Raggiunto":step.status==="pending"?"In revisione":step.status==="unknown"?"Da verificare":"Prossimo passo"}
          </span>
          {(index===0 || (index<=2 && admin) || (index>=3 && canSend)) ?
            <Link href={step.href} className="inline-flex min-h-10 items-center rounded-xl border border-[#cfddd4] px-3 text-xs font-semibold text-[#175640] hover:bg-[#f4f8f5]">{step.cta} →</Link>
          :null}
        </li>)}
      </ol>
      {preferences?<p className="mt-3 rounded-xl border border-[#dbe7de] p-3 text-xs leading-5 text-[#52615b]">
        Ricezione delle richieste: <strong>{preferences.inquiries_enabled?"abilitata":"disabilitata"}</strong>. Puoi modificarla in
        {" "}<Link href={appRoutes.network.manage} className="font-semibold text-[#176647] underline">Gestione profilo</Link>.
        Questo stato non sostituisce i controlli di eleggibilità sul destinatario.
      </p>:null}
    </section>
    <section className="rounded-2xl border border-[#dae5de] bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-[#173f35]">Scopri controparti della filiera</h2>
      <p className="mt-2 text-sm leading-6 text-[#52615b]">Parti dal settore rilevante. La ricerca include profili da confermare, ma soltanto aziende abilitate possono ricevere una richiesta: il controllo viene ripetuto prima dell'invio.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {suggested.map(item=><Link key={item.role} href={appRoutes.network.directory+"?role="+encodeURIComponent(item.role)}
          className="rounded-xl border border-[#d5e3da] bg-[#f9fbf9] p-4 transition hover:border-[#80ac95] hover:bg-[#f1f7f3]">
          <p className="text-sm font-semibold text-[#173f35]">{item.label} →</p>
          <p className="mt-1 text-xs leading-5 text-[#65766b]">{item.reason}</p>
        </Link>)}
      </div>
    </section>
    <p className="text-xs leading-5 text-[#65766b]">
      Profilo gestito significa collegamento e claim approvato, non «Azienda verificata».
      Le connessioni richiedono sempre una motivazione, l'idoneità del destinatario e la sua accettazione.
    </p>
  </main>;
}
