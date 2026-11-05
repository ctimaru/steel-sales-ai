import Link from "next/link";
import {redirect} from "next/navigation";

import {GovernanceWorkspaceNav} from "@/components/governance-workspace-nav";
import {getPlatformAccessContext,requirePlatformPermission} from "@/lib/platform-admin";
import {getNetworkActivationOverview} from "@/lib/network-activation-overview";
import {appRoutes} from "@/lib/routes";
import {getProvisionalReconciliationQueue} from "@/lib/network-provisional-claim";
import {reviewProvisionalReconciliation} from "./actions";

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

export default async function PlatformNetworkActivationPage({searchParams}:{searchParams:Promise<{error?:string;message?:string}>}){
 await requirePlatformPermission("registrations.read");
 const access=await getPlatformAccessContext();
 if(!access?.is_platform_owner)redirect("/platform");
 const [overview,reconciliations]=await Promise.all([getNetworkActivationOverview(),getProvisionalReconciliationQueue()]);
 const query=await searchParams;
 const canApprove=access.permissions.includes("claims.approve");
 const canReject=access.permissions.includes("claims.reject");
 const canReviewProof=access.permissions.includes("claims.review_proof");
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
  <section id="claim-reconciliation" aria-label="Rivendicazioni delle schede provvisorie" className="rounded-2xl border border-[#dae5de] bg-white p-5 sm:p-6">
   <h2 className="text-lg font-semibold text-[#173f35]">Richieste di collegamento · schede provvisorie</h2>
   <p className="mt-2 text-sm leading-6 text-[#52615b]">Le corrispondenze con registrazioni attivate e prove forti possono essere approvate dalla piattaforma. L'approvazione crea un profilo canonico rivendicabile, non attribuisce ownership e non verifica automaticamente l'azienda.</p>
   {query.error?<p role="alert" className="mt-3 rounded-xl border border-[#e6c6c1] bg-[#fff8f6] p-3 text-sm text-[#85483f]">{query.error}</p>:null}
   {query.message?<p className="mt-3 rounded-xl border border-[#bddacb] bg-[#f4faf6] p-3 text-sm text-[#175640]">{query.message}</p>:null}
   <p className="mt-2 text-xs font-semibold text-[#175640]">In attesa: {reconciliations.total_pending.toLocaleString("it-IT")}</p>
   {reconciliations.items.length===0?<p className="mt-3 text-sm text-[#52615b]">Nessuna richiesta di collegamento presente.</p>:
    <div className="mt-4 grid gap-3">
     {reconciliations.items.map(item=><article key={item.request_id} className="rounded-xl border border-[#e1e9e4] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
       <div>
        <p className="font-semibold text-[#173f35]">{item.source_name}</p>
        <p className="mt-1 text-xs text-[#52615b]">{item.source_domain} · {item.organization_name} · {item.status}</p>
       </div>
       <span className="rounded-full bg-[#edf5f1] px-2.5 py-1 text-xs font-semibold text-[#175640]">{item.has_activated_strong_match?"Registrazione attiva · prove forti":"Prove insufficienti"}</span>
      </div>
      {item.request_note?<p className="mt-2 text-xs leading-5 text-[#52615b]">Nota richiedente: {item.request_note}</p>:null}
      {["requested","under_review"].includes(item.status)?<form action={reviewProvisionalReconciliation} className="mt-3 flex flex-wrap items-end gap-3 border-t border-[#eef2ef] pt-3">
       <input type="hidden" name="request_id" value={item.request_id}/>
       <label className="min-w-[220px] flex-1 text-xs font-semibold text-[#52615b]">Motivazione obbligatoria
        <textarea name="note" rows={2} minLength={10} maxLength={2000} required placeholder="Fonte, ragione sociale e controllo effettuato" className="mt-1 w-full rounded-xl border border-[#cbdcd2] bg-white p-2 text-sm font-normal text-[#173f35]"/>
       </label>
       <div className="flex flex-wrap gap-2">
        {item.status==="requested"&&canReviewProof?<button name="decision" value="under_review" type="submit" className="rounded-xl border border-[#c8d9ce] px-3 py-2 text-xs font-semibold text-[#175640]">In revisione</button>:null}
        {canReject?<button name="decision" value="rejected" type="submit" className="rounded-xl border border-[#e3c3c0] px-3 py-2 text-xs font-semibold text-[#8d4138]">Respingi</button>:null}
        {item.has_activated_strong_match&&canApprove?<button name="decision" value="ready_for_claim" type="submit" className="app-primary rounded-xl px-3 py-2 text-xs font-semibold">Approva corrispondenza</button>:null}
       </div>
      </form>:null}
      {item.status==="ready_for_claim"&&item.canonical_company_id?<Link href={"/network/"+item.canonical_company_id} className="mt-3 inline-block text-xs font-semibold text-[#175640] underline">Apri profilo canonico</Link>:null}
     </article>)}
    </div>}
  </section>
  <p className="text-xs text-[#647269]">Fotografia dei dati alle {new Date(overview.snapshot_at).toLocaleString("it-IT")}. Visibile solo al proprietario della piattaforma.</p>
 </main>;
}
