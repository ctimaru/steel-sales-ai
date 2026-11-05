import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {getFreeNetworkProfile,safeNetworkWebsiteUrl} from "@/lib/network-free";
import {getMyProvisionalReconciliation} from "@/lib/network-provisional-claim";
import {requireWorkspaceAdmin} from "@/lib/workspace-context";
import {submitProvisionalReconciliation} from "@/app/(workspace)/network/actions";
import {PendingSubmitButton} from "@/components/pending-submit-button";
import {isNetworkFrontendEnabled} from "@/lib/network-flags";

export const dynamic="force-dynamic";
export default async function ReconcileProvisionalCompanyPage({
 params,searchParams
}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;message?:string}>;}){
 if(!isNetworkFrontendEnabled())redirect("/dashboard");
 const {id}=await params;
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))notFound();
 const context=await requireWorkspaceAdmin("/network/"+id);
 const query=await searchParams;
 const state=await getMyProvisionalReconciliation(id,context.organizationId);
 const ready=state.status==="ready_for_claim"&&Boolean(state.canonical_company_id);
 const profile=ready?null:await getFreeNetworkProfile(context.organizationId,id);
 if(!ready&&(!profile||profile.company.discovery_status!=="unconfirmed"))notFound();
 const name=profile?.company.trading_name||profile?.company.legal_name||"Azienda riconciliata";
 const website=safeNetworkWebsiteUrl(profile?.company.website_url);
 return <main className="mx-auto max-w-[900px] space-y-4 pb-16">
  <Link href={"/network/"+id} className="text-sm font-semibold text-[#175640] underline">Torna al profilo</Link>
  <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-7">
   <p className="text-xs font-semibold uppercase tracking-wider text-[#175640]">NET-GROWTH3.G.3 · Titolarità aziendale</p>
   <h1 className="mt-2 text-2xl font-semibold text-[#173f35]">Rivendica questa azienda</h1>
   <p className="mt-2 text-sm leading-6 text-[#52615b]">{name}</p>
   {website?<a href={website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-[#175640] underline">Sito aziendale</a>:null}
   <ol className="mt-5 flex flex-wrap gap-3 border-t border-[#e0e9e3] pt-4 text-xs font-semibold text-[#31574b]">
    <li>1. Richiedi collegamento</li><li>2. Controllo della piattaforma</li>
    <li>3. Rivendica profilo canonico</li><li>4. Arricchisci e verifica</li>
   </ol>
   {query.error?<p role="alert" className="mt-4 rounded-xl border border-[#ebd0cc] bg-[#fff8f6] p-3 text-sm text-[#8e3229]">{query.error}</p>:null}
   {query.message?<p className="mt-4 rounded-xl border border-[#b9dac9] bg-[#f2faf5] p-3 text-sm text-[#175640]">{query.message}</p>:null}
   {ready?<div className="mt-5 rounded-2xl border border-[#b9dcca] bg-[#f4faf6] p-5">
     <h2 className="font-semibold text-[#173f35]">Corrispondenza approvata · Claim ancora necessario</h2>
     <p className="mt-2 text-sm leading-6 text-[#52615b]">La piattaforma ha collegato la fonte a un profilo canonico. Non hai ancora ottenuto il diritto di gestirlo: completa il controllo di rappresentanza nella normale procedura di claim.</p>
     <Link href={"/network/"+state.canonical_company_id+"/claim"} className="app-primary mt-4 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">Continua con il claim</Link>
    </div>:state.status==="requested"||state.status==="under_review"?
    <div className="mt-5 rounded-2xl border border-[#d9e6df] bg-[#f6faf8] p-5">
     <h2 className="font-semibold text-[#173f35]">{state.status==="requested"?"Richiesta ricevuta":"Verifica in corso"}</h2>
     <p className="mt-2 text-sm leading-6 text-[#52615b]">La corrispondenza è in attesa di revisione. Il profilo rimane non rivendicato e non verificato; non vengono inviate RFQ né assegnati permessi di modifica.</p>
    </div>:<form action={submitProvisionalReconciliation} className="mt-5 space-y-4">
     {state.status==="rejected"?<p className="rounded-xl border border-[#efdec5] bg-[#fffaf2] p-3 text-sm text-[#73522f]">La richiesta precedente non è stata approvata. Controlla le informazioni e presenta una nuova richiesta, se necessario. {state.review_note||""}</p>:null}
     <input type="hidden" name="discovery_id" value={id}/>
     <label className="block text-sm font-semibold text-[#173f35]">Informazioni utili alla verifica
      <textarea name="note" rows={3} maxLength={1000} placeholder="Indica la ragione sociale e la tua relazione con l'azienda." className="mt-2 block w-full rounded-xl border border-[#cbdcd2] bg-white p-3 text-sm font-normal text-[#173f35]"/>
     </label>
     <label className="flex items-start gap-2 rounded-xl bg-[#f5f9f7] p-3 text-sm text-[#43524c]">
      <input type="checkbox" name="authority_confirmed" value="true" required className="mt-1 h-4 w-4"/>
      Confermo di essere autorizzato a rappresentare questa azienda e richiedo il controllo della corrispondenza.
     </label>
     <PendingSubmitButton pendingLabel="Invio richiesta…" className="app-primary inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold">Invia richiesta di collegamento</PendingSubmitButton>
    </form>}
  </section>
  <p className="text-xs leading-5 text-[#647269]">Il controllo del dominio e della registrazione non equivale a verifica delle capacità, delle norme, dei prezzi o delle certificazioni. Dopo un claim approvato, i dati potranno essere aggiornati soltanto dagli amministratori autorizzati e resteranno soggetti alla revisione delle dichiarazioni.</p>
 </main>;
}
