import Link from "next/link";
import {redirect} from "next/navigation";

import {GovernanceWorkspaceNav} from "@/components/governance-workspace-nav";
import {getPlatformAccessContext,requirePlatformPermission} from "@/lib/platform-admin";
import {getNetworkActivationOverview} from "@/lib/network-activation-overview";
import {getNetworkGrowthOverview} from "@/lib/network-growth-overview";
import {appRoutes} from "@/lib/routes";

export const dynamic="force-dynamic";

const number=(v:number)=>v.toLocaleString("it-IT");
const stages=[
  {key:"published",name:"Profili pubblicati",hint:"Identità visibili, non necessariamente registrate"},
  {key:"provisional_visible",name:"Schede da confermare",hint:"Scoperte da fonti governate, senza ownership"},
  {key:"registration_applications",name:"Domande inoltrate",hint:"Registrazioni non in bozza"},
  {key:"registrations_activated",name:"Registrazioni attivate",hint:"Account aziendali attivati dopo le verifiche"},
  {key:"claims_pending",name:"Rivendicazioni in attesa",hint:"Richieste ancora da approvare"},
  {key:"claims_approved",name:"Rivendicazioni approvate",hint:"Titolarità approvata; non prova di verifica dei dati"},
  {key:"companies_linked_and_claim_approved",name:"Aziende con titolarità attiva",hint:"Profilo pubblicato + link attivo + claim approvato + membro attivo"},
  {key:"connection_requests_sent",name:"Richieste di connessione inviate",hint:"Richieste realmente registrate nel database"},
  {key:"connections_accepted",name:"Connessioni accettate",hint:"Consenso effettivo del destinatario; non implica contratti o ordini"},
] as const;

export default async function PlatformNetworkActivationPage(){
 await requirePlatformPermission("registrations.read");
 const access=await getPlatformAccessContext();
 if(!access?.is_platform_owner)redirect("/platform");
 const [overview,growth]=await Promise.all([getNetworkActivationOverview(),getNetworkGrowthOverview()]);
 const counts=overview.counts;
 return <main className="mx-auto max-w-7xl space-y-6 pb-14">
  <GovernanceWorkspaceNav current="registrations" permissions={access.permissions}/>
  <div className="rounded-2xl border border-[#d5e4dc] bg-white p-6 sm:p-8">
   <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#32745a]">NET-CONNECT2B · Platform owner</p>
   <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#173f35] sm:text-3xl">Attivazione reale delle aziende</h1>
   <p className="mt-3 max-w-4xl text-sm leading-6 text-[#52615b]">
    Distinguere schede scoperte, registrazioni, rivendicazioni e aziende realmente collegate.
    I numeri sono conteggi verificati nel database, non somme dello stesso funnel né conversioni stimate.
   </p>
   <nav aria-label="Azioni governance" className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
    <Link href={appRoutes.platform.registrations} className="rounded-xl border border-[#c7d9ce] px-3 py-2 text-[#175640]">Registrazioni →</Link>
    <Link href={appRoutes.platform.claims} className="rounded-xl border border-[#c7d9ce] px-3 py-2 text-[#175640]">Rivendicazioni →</Link>
    <Link href={appRoutes.platform.discovery} className="rounded-xl border border-[#c7d9ce] px-3 py-2 text-[#175640]">Scoperta aziende →</Link>
   </nav>
  </div>
  <section aria-label="Crescita delle aziende" className="space-y-4">
   <div>
    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#32745a]">NET-CONNECT2C · Company Growth</p>
    <h2 className="mt-2 text-xl font-semibold text-[#173f35]">Dall'iscrizione alla prima connessione reale</h2>
    <p className="mt-2 max-w-4xl text-sm leading-6 text-[#52615b]">
     Stato attuale delle domande presentate negli ultimi 30 giorni (date UTC). Ogni tappa
     conserva la stessa coorte di domande: non è un conteggio di eventi accaduti negli stessi 30 giorni.
     Una richiesta inviata non equivale a una connessione accettata.
    </p>
   </div>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    {([
     {key:"submitted",label:"Domande presentate",note:"Domande realmente inviate"},
     {key:"activated",label:"Account attivati",note:"Registrazione abilitata"},
     {key:"owned",label:"Aziende realmente gestite",note:"Claim approvato, link e membro attivi"},
     {key:"requested",label:"Prima richiesta",note:"Almeno una connessione inviata"},
     {key:"accepted",label:"Prima accettazione",note:"Almeno una connessione accettata"},
    ] as const).map((item,i,arr)=>{
     const value=growth.cohort_30d[item.key];
     const previous=i>0?growth.cohort_30d[arr[i-1].key]:null;
     return <article key={item.key} className="rounded-2xl border border-[#dae5de] bg-white p-4">
      <p className="min-h-9 text-xs font-semibold text-[#52615b]">{item.label}</p>
      <div className="mt-2 flex items-baseline gap-2">
       <p className="text-3xl font-semibold tabular-nums tracking-tight text-[#173f35]">{number(value)}</p>
       {previous!==null?<span className="text-xs font-semibold text-[#32745a]">{previous>0?Math.round(value/previous*100)+"%":"—"}</span>:null}
      </div>
      <p className="mt-2 text-xs leading-5 text-[#617066]">{item.note}</p>
     </article>;
    })}
   </div>
   <div className="grid gap-3 sm:grid-cols-3">
    <article className="rounded-2xl border border-[#cfe2d3] bg-[#f3f8f4] p-4">
     <p className="text-xs font-semibold text-[#52615b]">Aziende gestite senza richiesta inviata</p>
     <p className="mt-2 text-2xl font-semibold tabular-nums text-[#173f35]">{number(growth.network.owned_without_outreach)}</p>
     <p className="mt-2 text-xs leading-5 text-[#617066]">Primo punto di attenzione: contatti reali, non inviti automatici.</p>
    </article>
    <article className="rounded-2xl border border-[#dae5de] bg-white p-4">
     <p className="text-xs font-semibold text-[#52615b]">Registrazioni approvate da attivare</p>
     <p className="mt-2 text-2xl font-semibold tabular-nums text-[#173f35]">{number(growth.network.approved_applications_pending_activation)}</p>
     <Link href={appRoutes.platform.registrations+"?status=approved"} className="mt-2 inline-block text-xs font-semibold text-[#176647] underline">Apri registrazioni →</Link>
    </article>
    <article className="rounded-2xl border border-[#dae5de] bg-white p-4">
     <p className="text-xs font-semibold text-[#52615b]">Richieste / accettazioni negli ultimi 30 giorni</p>
     <p className="mt-2 text-2xl font-semibold tabular-nums text-[#173f35]">{number(growth.network.requests_last_30d)} / {number(growth.network.accepted_last_30d)}</p>
     <p className="mt-2 text-xs leading-5 text-[#617066]">Richieste per data di invio, accettazioni per data di decisione.</p>
    </article>
   </div>
   <div className="rounded-2xl border border-[#dae5de] bg-white p-5 sm:p-6">
    <h3 className="text-base font-semibold text-[#173f35]">Coorti di acquisizione · ultime 8 settimane</h3>
    <p className="mt-1 text-xs leading-5 text-[#617066]">
     Settimana di invio della domanda (UTC). I passaggi successivi sono gli esiti attuali
     della stessa coorte, non eventi verificatisi in quella settimana. Le coorti più recenti sono ancora in maturazione.
    </p>
    <div className="mt-3 overflow-x-auto">
     <table className="w-full min-w-[560px] border-collapse text-left text-xs">
      <thead><tr className="border-b border-[#dce5df] text-[#52615b]">
       <th className="py-3 pr-3">Settimana</th>
       <th className="p-3">Domande</th><th className="p-3">Attivate</th>
       <th className="p-3">Gestite</th><th className="p-3">Richiesta</th><th className="p-3">Accettate</th>
      </tr></thead>
      <tbody>{growth.weeks.map(week=><tr key={week.week_start} className="border-b border-[#edf1ee]">
       <th className="py-3 pr-3 font-semibold text-[#173f35]">{week.week_start}</th>
       {(["submitted","activated","owned","requested","accepted"] as const).map(key=>
        <td key={key} className="p-3 tabular-nums text-[#365247]">{number(week[key])}</td>)}
      </tr>)}</tbody>
     </table>
    </div>
   </div>
  </section>
  <section aria-label="Stato attivazioni">
   <h2 className="mb-3 text-lg font-semibold text-[#173f35]">Stato della rete</h2>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {stages.map(item=><article key={item.key} className="rounded-2xl border border-[#dae5de] bg-white p-5">
      <p className="text-xs font-semibold text-[#52615b]">{item.name}</p>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-[#173f35]">{number(counts[item.key])}</p>
      <p className="mt-2 text-xs leading-5 text-[#617066]">{item.hint}</p>
    </article>)}
   </div>
  </section>
  <section className="rounded-2xl border border-[#dae5de] bg-white p-5 sm:p-6">
   <h2 className="text-lg font-semibold text-[#173f35]">Riconciliazione delle identità</h2>
   <p className="mt-2 text-sm leading-6 text-[#52615b]">
    Il sistema collega automaticamente la provenienza di una scheda scoperta al profilo
    canonico quando coincidono <strong>dominio web univoco e ragione sociale normalizzata</strong>.
    Questo produce una traccia di evidenza, non un nuovo claim né un trasferimento di controllo.
   </p>
   <div className="mt-4 grid gap-3 sm:grid-cols-3">
    <div className="rounded-xl border border-[#dce5df] p-4">
     <p className="text-xs text-[#52615b]">Corrispondenze canoniche registrate</p>
     <p className="mt-1 text-2xl font-semibold tabular-nums text-[#173f35]">{number(counts.canonical_evidence_links)}</p>
    </div>
    <div className="rounded-xl border border-[#dce5df] p-4">
     <p className="text-xs text-[#52615b]">Domande con prove coerenti</p>
     <p className="mt-1 text-2xl font-semibold tabular-nums text-[#173f35]">{number(counts.registration_strong_matches)}</p>
    </div>
    <div className="rounded-xl border border-[#dce5df] p-4">
     <p className="text-xs text-[#52615b]">Corrispondenze ambigue</p>
     <p className="mt-1 text-2xl font-semibold tabular-nums text-[#173f35]">{number(counts.registration_ambiguous_matches)}</p>
    </div>
   </div>
   <p className="mt-4 text-xs leading-5 text-[#647269]">
     La corrispondenza di dominio non basta a identificare un proprietario. Anche le domande
     con prove coerenti devono passare il normale percorso di registrazione e approvazione.
     La sola presenza nel Network non dà accesso a contatti né autorizza inviti commerciali.
   </p>
  </section>
  <section className="rounded-2xl border border-[#dae5de] bg-white p-5 sm:p-6">
   <h2 className="text-lg font-semibold text-[#173f35]">Registrazioni da riconciliare</h2>
   <p className="mt-2 text-sm leading-6 text-[#52615b]">
    Anteprima di massimo 30 possibili corrispondenze, dedotte da domini aziendali.
    I casi con domini condivisi, nomi diversi o email non confermate restano indicati
    come ambigui, senza attivazioni automatiche.
   </p>
   {overview.proposals.length===0?
    <p className="mt-4 rounded-xl border border-[#e0e7e2] p-4 text-sm text-[#52615b]">
      Nessuna domanda associabile alle schede provvisorie in questo momento. La ricerca
      continuerà a verificare le nuove domande presenti nel database.
    </p>:
    <div className="mt-4 overflow-x-auto">
     <table className="w-full border-collapse text-left text-sm">
      <thead><tr className="border-b border-[#dce5df] text-xs text-[#52615b]">
       <th className="px-3 py-3">Scheda scoperta</th><th className="px-3 py-3">Dominio</th>
       <th className="px-3 py-3">Azienda registrata</th><th className="px-3 py-3">Valutazione</th></tr></thead>
      <tbody>
       {overview.proposals.map(item=><tr key={item.discovery_id+":"+item.application_id} className="border-b border-[#edf1ee]">
        <td className="px-3 py-3 font-semibold text-[#173f35]">{item.discovered_name}</td>
        <td className="px-3 py-3 text-[#52615b]">{item.domain}</td>
        <td className="px-3 py-3 text-[#52615b]">{item.applicant_company}</td>
        <td className="px-3 py-3 text-[#52615b]">{item.match_state==="strong_evidence"?"Prove coerenti · nessun claim automatico":"Richiede verifica"}</td>
       </tr>)}
      </tbody>
     </table>
    </div>
   }
  </section>
  <p className="text-xs text-[#647269]">Fotografia dei dati alle {new Date(overview.snapshot_at).toLocaleString("it-IT")}. Visibile solo al proprietario della piattaforma.</p>
 </main>;
}
