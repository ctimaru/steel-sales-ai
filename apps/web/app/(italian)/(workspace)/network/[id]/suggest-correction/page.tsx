import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getFreeNetworkProfile, getProNetworkDiscoveryProfile, safeNetworkWebsiteUrl } from "@/lib/network-free";
import { getItalianCorrectionQueue } from "@/lib/netit-identity-resolution";
import { getNetworkAccessState } from "@/lib/network-access";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

import { attestItalianIdentityCorrection, submitItalianIdentityCorrection } from "./actions";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fieldClass="mt-1 min-h-11 w-full rounded-xl border border-[#c2d4c9] bg-white px-3 py-2 text-sm text-[#173f35] outline-none focus-visible:ring-2 focus-visible:ring-[#226b50]";
const labelClass="block text-sm font-semibold text-[#173f35]";

export default async function ItalianCorrectionSuggestionPage({
 params,searchParams,
}:{
 params:Promise<{id:string}>;
 searchParams:Promise<{submitted?:string;error?:string;attested?:string;resolution_error?:string}>;
}){
 if(!isNetworkFrontendEnabled()) redirect("/dashboard");
 const {id}=await params;
 if(!UUID.test(id)) notFound();
 const context=await requireWorkspaceAdmin("/network/"+id);
 const access=await getNetworkAccessState(context.organizationId);
 const profile=access.can_access_network
   ? await getProNetworkDiscoveryProfile(context.organizationId,id).catch(()=>null)
   : await getFreeNetworkProfile(context.organizationId,id).catch(()=>null);
 if(!profile || profile.company.discovery_status!=="unconfirmed"
    || profile.company.country_code!=="IT") notFound();
 const {submitted,error,attested,resolution_error}=await searchParams;
 const name=profile.company.trading_name||profile.company.legal_name;
 const queue=await getItalianCorrectionQueue(context.organizationId,id);

 return <main className="mx-auto max-w-[760px] space-y-4 px-4 py-6">
  <Link href={"/network/"+encodeURIComponent(id)} className="inline-flex min-h-10 items-center text-sm font-semibold text-[#175640] underline underline-offset-4">← Torna a {name}</Link>
  <header className="rounded-2xl border border-[#d2e2d8] bg-white p-5 sm:p-6">
    <p className="text-xs font-bold uppercase tracking-wide text-[#175640]">NET-IT IDENTITY2D.2 · Italian Network</p>
    <h1 className="mt-2 text-2xl font-bold text-[#173f35]">Proponi una correzione</h1>
    <p className="mt-2 text-sm leading-6 text-[#52615b]">
      Segnala un dato inesatto relativo a <strong>{name}</strong>.
      La richiesta sarà archiviata con la fonte, senza modificare automaticamente il profilo.
      Non assegna un claim, non dimostra la rappresentanza legale e non pubblica i contenuti della fonte.
    </p>
  </header>

  {submitted==="1" ? <p role="status" className="rounded-xl border border-[#bdd9c8] bg-[#eef8f0] p-4 text-sm font-semibold text-[#175640]">Segnalazione ricevuta. Il profilo è invariato; la fonte e la proposta restano da valutare.</p>:null}
  {error ? <p role="alert" className="rounded-xl border border-[#ecd5b7] bg-[#fff9ec] p-4 text-sm text-[#6e501e]">
   {error==="invalid"?"Completa i campi obbligatori, verifica la fonte HTTPS e conferma le condizioni.":"Invio non completato. Verifica che la fonte sia sul sito ufficiale, che la tua email sia confermata e che non siano già presenti richieste uguali o recenti."}
  </p>:null}

  <section aria-label="Stato delle rettifiche aziendali" className="rounded-2xl border border-[#d2e2d8] bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#175640]">IDENTITY2D.3 · Resolution</p>
        <h2 className="mt-1 text-lg font-bold text-[#173f35]">Segnalazioni e risposta aziendale</h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-[#52615b]">Le attestazioni di un profilo già rivendicato non certificano l'identità legale e non pubblicano automaticamente una correzione.</p>
      </div>
      {queue?.owner_attestation_eligible ? <span className="rounded-full border border-[#bad8c5] bg-[#eff8f2] px-3 py-1 text-xs font-semibold text-[#175640]">Claim canonico attivo</span>:
      <span className="rounded-full border border-[#e8d6b5] bg-[#fff8ea] px-3 py-1 text-xs font-semibold text-[#73521f]">Nessuna ownership attribuita</span>}
    </div>
    {attested==="1" ? <p role="status" className="mt-3 rounded-lg border border-[#bad8c5] bg-[#eff8f2] p-3 text-sm text-[#175640]">Attestazione registrata nello storico, senza modificare il profilo.</p>:null}
    {resolution_error ? <p role="alert" className="mt-3 rounded-lg border border-[#ead3bb] bg-[#fff8ea] p-3 text-sm text-[#73521f]">Attestazione non registrata. Controlla il claim canonico attivo e riprova.</p>:null}
    {!queue ? <p role="alert" className="mt-4 text-sm text-[#73521f]">Stato delle rettifiche temporaneamente non disponibile. Non vengono inventati esiti o conteggi.</p>:
     <>
       <div className="mt-4 flex flex-wrap items-center gap-3">
         {queue.claim_target_company_id && !queue.owner_attestation_eligible ?
           <Link href={"/network/"+encodeURIComponent(queue.claim_target_company_id)+"/claim"}
             className="ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-xl px-3 text-xs font-semibold">
             Rivendica il profilo canonico →</Link> : null}
         {queue.owner_attestation_eligible ? <Link href="/network/manage" className="ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-xl px-3 text-xs font-semibold">Gestisci il tuo profilo aziendale →</Link>:null}
         {!queue.owner_attestation_eligible && !queue.claim_target_company_id ?
           <Link href={"/register?company="+encodeURIComponent(name.trim().slice(0,120))+"#company-check"}
             className="ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-xl px-3 text-xs font-semibold">Percorso di registrazione azienda →</Link>:null}
       </div>
       <p className="mt-2 text-xs leading-5 text-[#52615b]">
         Il collegamento è proposto solo per un dominio univoco. La procedura HP5 verifica autonomamente il diritto di gestione. Nessun UUID discovered viene trasferito come claim.
       </p>
       <p className="mt-4 text-xs font-semibold text-[#52615b]">{queue.total_visible} segnalazioni consultabili con il tuo ruolo</p>
       <div className="mt-3 space-y-3">
         {queue.items.map(item=><article key={item.id} className="rounded-xl border border-[#dce6de] bg-[#f8faf9] p-4">
           <div className="flex flex-wrap items-center justify-between gap-2">
             <p className="text-sm font-semibold capitalize text-[#173f35]">{item.field_key.replaceAll("_"," ")} · {item.proposed_value}</p>
             <span className="rounded-full border border-[#d4dfd7] bg-white px-2 py-1 text-xs font-semibold text-[#52615b]">
               {item.resolution==="owner_supported"?"Supportata da azienda con claim":item.resolution==="owner_disputed"?"Contestata da azienda con claim":"In attesa di riscontro aziendale"}
             </span>
           </div>
           {item.evidence_note ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#52615b]">{item.evidence_note}</p>:null}
           {safeNetworkWebsiteUrl(item.source_url)?.startsWith("https://") ?
            <a href={safeNetworkWebsiteUrl(item.source_url)||"#"} target="_blank" rel="noopener noreferrer"
               className="mt-2 inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4">Consulta la fonte HTTPS ↗</a>:null}
           <p className="mt-1 text-xs text-[#52615b]">{item.is_my_organization?"Segnalata dalla tua organizzazione":"Fonte segnalata da un altro operatore"} · Nessuna modifica automatica</p>
           {item.can_attest?<form action={attestItalianIdentityCorrection} className="mt-3 space-y-2 border-t border-[#dce6de] pt-3">
             <input type="hidden" name="discovery_id" value={id}/>
             <input type="hidden" name="request_id" value={item.id}/>
             <label htmlFor={"decision-"+item.id} className={labelClass}>Riscontro dell'azienda titolare del claim</label>
             <select id={"decision-"+item.id} name="decision" defaultValue="" required className={fieldClass}>
               <option disabled value="">Seleziona</option>
               <option value="owner_supported">Confermo il contenuto della segnalazione</option>
               <option value="owner_disputed">Contesto il contenuto della segnalazione</option>
               {item.resolution!=="awaiting_owner"?<option value="owner_withdrawn">Ritiro il mio precedente riscontro</option>:null}
             </select>
             <label htmlFor={"note-"+item.id} className={labelClass}>Motivazione</label>
             <textarea id={"note-"+item.id} name="decision_note" required minLength={12} maxLength={600} rows={2} className={fieldClass} placeholder="Spiega il tuo riscontro aziendale."/>
             <PendingSubmitButton className="ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-xl px-3 text-xs font-semibold" pendingLabel="Registrazione…">Registra nuovo evento nello storico</PendingSubmitButton>
           </form>:null}
         </article>)}
         {queue.items.length===0?<p className="rounded-lg border border-[#dce6de] bg-[#f8faf9] p-4 text-sm text-[#52615b]">Nessuna segnalazione visibile su questa scheda.</p>:null}
       </div>
     </>
    }
  </section>

  <form action={submitItalianIdentityCorrection} className="space-y-5 rounded-2xl border border-[#d2e2d8] bg-white p-5 sm:p-6">
    <input type="hidden" name="discovery_id" value={id}/>
    <div>
      <label htmlFor="field_key" className={labelClass}>Quale informazione vuoi correggere?</label>
      <select id="field_key" name="field_key" required defaultValue="" className={fieldClass}>
        <option value="" disabled>Seleziona il dato</option>
        <option value="company_name">Denominazione o nome commerciale</option>
        <option value="website_domain">Dominio aziendale</option>
        <option value="location">Sede / località</option>
        <option value="brand_group">Marchio / appartenenza a gruppo</option>
      </select>
    </div>
    <div>
      <label htmlFor="proposed_value" className={labelClass}>Informazione proposta</label>
      <input id="proposed_value" name="proposed_value" className={fieldClass}
        required minLength={4} maxLength={180} placeholder="Scrivi il valore corretto (non un claim)"/>
      <p className="mt-1 text-xs leading-5 text-[#52615b]">Per il dominio inserisci esempio.it, senza https://. Non inserire informazioni personali.</p>
    </div>
    <div>
      <label htmlFor="source_url" className={labelClass}>Fonte ufficiale HTTPS</label>
      <input id="source_url" name="source_url" type="url" inputMode="url" className={fieldClass}
        required maxLength={500} placeholder="https://azienda.it/chi-siamo"/>
      <p className="mt-1 text-xs leading-5 text-[#52615b]">È accettata una pagina ufficiale del dominio aziendale. Per modifiche al dominio, può essere usato anche quello proposto. Il sito non viene acquisito automaticamente.</p>
    </div>
    <div>
      <label htmlFor="evidence_note" className={labelClass}>Motivo e riferimento della correzione</label>
      <textarea id="evidence_note" name="evidence_note" className={fieldClass}
        minLength={30} maxLength={800} rows={4} required
        placeholder="Descrivi dove la fonte documenta il dato e perché la scheda va rettificata."/>
      <p className="mt-1 text-xs leading-5 text-[#52615b]">30–800 caratteri. Inserisci solo una sintesi originale, non copiare pagine protette.</p>
    </div>
    <fieldset className="space-y-2">
      <legend className={labelClass}>In che qualità invii la segnalazione?</legend>
      <label className="flex min-h-10 items-center gap-3 text-sm text-[#334c40]">
        <input type="radio" name="representation_basis" value="industry_observer" defaultChecked/>
        Sono un operatore del settore e segnalo una fonte pubblica
      </label>
      <label className="flex min-h-10 items-center gap-3 text-sm text-[#334c40]">
        <input type="radio" name="representation_basis" value="self_declared_representative"/>
        Dichiaro di rappresentare l'azienda (da verificare)
      </label>
      <p className="text-xs leading-5 text-[#52615b]">Una dichiarazione non è una prova di ownership. Per rivendicare il profilo aziendale segui il percorso di registrazione e claim previsto dalla piattaforma.</p>
    </fieldset>
    <label className="flex items-start gap-3 text-sm leading-6 text-[#334c40]">
      <input type="checkbox" name="proposal_acknowledged" value="yes" required className="mt-1"/>
      Confermo che la segnalazione contiene solo dati aziendali e riferimenti condivisibili, e comprendo che non modifica la scheda né ne prova la titolarità.
    </label>
    <div className="flex flex-wrap items-center gap-3 border-t border-[#e2ece5] pt-4">
      <PendingSubmitButton className="ui-action ui-action-primary inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold" pendingLabel="Invio…">Invia segnalazione</PendingSubmitButton>
      <Link href="/company-data" className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline">Richiesta di rimozione o diritti sui dati →</Link>
    </div>
  </form>
 </main>;
}
