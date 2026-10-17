import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {submitNetworkConnection} from "@/app/(workspace)/network/actions";
import {getNetworkRecipientReadiness} from "@/lib/network-recipient-readiness";
import {canInteractWithNetwork} from "@/lib/access-policy";
import {getWorkspaceContext} from "@/lib/workspace-context";
import {getFreeNetworkProfile} from "@/lib/network-free";
import {isNetworkFrontendEnabled} from "@/lib/network-flags";

const reasons=[
 {value:"offer_products_services",label:"Voglio offrire prodotti o servizi",hint:"Una proposta commerciale o una capacità che possiamo mettere a disposizione"},
 {value:"request_products_services",label:"Voglio richiedere prodotti o servizi",hint:"Una necessità concreta di acquisto, approvvigionamento o lavorazione"},
 {value:"collaboration",label:"Voglio proporre una collaborazione",hint:"Un progetto tecnico, una partnership produttiva o un rapporto continuativo"},
];

export default async function NetworkConnectCompanyPage({
 params,searchParams,
}:{
 params:Promise<{id:string}>;
 searchParams:Promise<{error?:string}>;
}){
 if(!isNetworkFrontendEnabled())redirect("/dashboard");
 const {id}=await params;
 const actor=await getWorkspaceContext();
 const profile=await getFreeNetworkProfile(actor.organizationId,id);
 if(!profile)notFound();
 const status=profile.company.discovery_status==="unconfirmed"?"unavailable":canInteractWithNetwork(actor.role)
   ? (await getNetworkRecipientReadiness(actor.organizationId,[id]).catch(()=>null))?.get(id)
   : "unavailable";
 const error=(await searchParams).error;
 return <main className="mx-auto max-w-3xl space-y-5 pb-16">
  <Link href={"/network/"+id} className="text-sm font-semibold text-[#276f52] hover:underline">← Torna all'azienda</Link>
  <header className="rounded-2xl border border-[#cfe0d6] bg-[#f1f7f3] p-5 sm:p-7">
   <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#32745a]">Connessioni aziendali</p>
   <h1 className="mt-2 text-2xl font-semibold text-[#173f35] sm:text-3xl">Connettiti con {profile.company.trading_name||profile.company.legal_name}</h1>
   <p className="mt-2 text-sm leading-6 text-[#52615b]">
    Le richieste hanno uno scopo commerciale preciso. L'azienda destinataria potrà accettare o rifiutare.
    Inviare una richiesta non crea automaticamente una relazione, un ordine o un contratto.
   </p>
  </header>
  {error?<p role="alert" className="rounded-xl border border-[#e0cba3] bg-[#fff8e9] p-4 text-sm text-[#765821]">{error}</p>:null}
  {status!=="available"?(
   <section className="rounded-2xl border border-[#d8e5dd] bg-white p-5">
    <h2 className="text-base font-semibold text-[#173f35]">Connessione non ancora disponibile</h2>
    <p className="mt-2 text-sm leading-6 text-[#52615b]">{status==="pending"?"Hai già inviato una richiesta a questa azienda. Una seconda richiesta in attesa non è consentita.":status==="connected"?"Una tua richiesta è già stata accettata. Consulta le connessioni esistenti.":status===undefined?"La disponibilità delle connessioni non è verificabile in questo momento. Riprova più tardi.":"Questa azienda non è attualmente abilitata a ricevere richieste da questa organizzazione. Nessun invito viene inviato automaticamente."}</p>
    {status==="pending"||status==="connected"?<Link href="/network/connections?box=sent" className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-[#bdd3c7] px-4 text-sm font-semibold text-[#173f35]">Le mie richieste →</Link>:null}
    <Link href={"/network/"+id} className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-[#bdd3c7] px-4 text-sm font-semibold text-[#173f35]">Torna al profilo</Link>
   </section>
  ):(
   <form action={submitNetworkConnection} className="space-y-5 rounded-2xl border border-[#d9e6df] bg-white p-5 sm:p-7">
    <input type="hidden" name="network_company_id" value={id}/>
    <fieldset>
     <legend className="text-base font-semibold text-[#173f35]">Perché vuoi connetterti? <span className="text-[#8a481b]">*</span></legend>
     <div className="mt-3 space-y-2">
      {reasons.map(r=><label key={r.value} className="flex cursor-pointer gap-3 rounded-xl border border-[#d8e5dd] p-4 hover:bg-[#f4f9f6]">
        <input type="radio" name="purpose" value={r.value} required className="mt-1 accent-[#176647]"/>
        <span><span className="block text-sm font-semibold text-[#173f35]">{r.label}</span>
        <span className="mt-1 block text-xs leading-5 text-[#52615b]">{r.hint}</span></span>
      </label>)}
     </div>
    </fieldset>
    <div>
     <label htmlFor="network-connect-message" className="text-base font-semibold text-[#173f35]">Motiva la tua richiesta <span className="text-[#8a481b]">*</span></label>
     <p className="mt-1 text-xs text-[#52615b]">Spiega cosa offri, cosa cerchi o quale progetto vorresti sviluppare. Evita messaggi generici.</p>
     <textarea id="network-connect-message" name="message" required minLength={30} maxLength={2000} rows={5}
      placeholder="Siamo un'azienda specializzata in... Vorremmo confrontarci sulla possibilità di..."
      className="mt-3 w-full rounded-xl border border-[#bfd3c8] p-4 text-sm leading-6 text-[#173f35] focus:outline-2 focus:outline-offset-2 focus:outline-[#176647]"/>
     <p className="mt-1 text-xs text-[#64766d]">30–2000 caratteri · messaggio privato tra aziende</p>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
     <p className="max-w-md text-xs leading-5 text-[#64766d]">Le richieste sono protette da limiti anti-spam. Puoi ritirarle finché sono in attesa.</p>
     <button type="submit" className="app-primary min-h-11 rounded-xl px-5 text-sm font-semibold">Invia richiesta di connessione</button>
    </div>
   </form>
  )}
 </main>;
}
