import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPlatformAccessContext, requirePlatformPermission } from "@/lib/platform-admin";
import { addDiscoverySource, reviewDiscoverySourceRegistry, reviewDiscoveredDomain, createGovernedDiscoveryRun, linkApprovedPilotRun, recordFirstPartyPermission, activateConsentedSource, prepareFirstPartyRun, linkApprovedFirstPartyRun, enqueueConsentedDomainLeads } from "./actions";

type Source = { id: string; source_name: string; source_url: string; source_type: string;
 governance_status: string; terms_status: string; database_rights_status: string;
 personal_data_policy: string; enabled_for_discovery: boolean; rights_evidence_url: string | null };
const sourceTypes = ["association","industry_directory","licensed_search","company_submission","curated_public_source"];

export default async function DiscoverySourcesPage({
  searchParams,
}: { searchParams: Promise<{message?:string;error?:string}> }) {
  await requirePlatformPermission("discovery.read");
  const context = await getPlatformAccessContext();
  const canReview = context?.permissions.includes("discovery.governance_review") ?? false;
  const canRun = context?.permissions.includes("discovery.run") ?? false;
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crawl_it2_list_sources");
  const sources = (data ?? []) as Source[];
  const {data: permissionsData}=await supabase.rpc("netcov2b_source_readiness");
  const rights=(permissionsData as {contract?:string;items?:Array<{source_id:string;consented_domains:number;max_sites_per_run:number}>}|null);
  const bySource=new Map(rights?.contract==="netcov2b-source-readiness-v1" ? rights.items?.map(item=>[item.source_id,item]) ?? [] : []);
  const { data: leads, error: leadError } = await supabase.rpc("crawl_it3_list_pending_leads");
  const pendingLeads = (leads ?? []) as Array<{ id:string; domain:string; proposed_url:string; evidence_url:string; source_name:string; created_at:string }>;
  return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
    <Link href="/platform/company-discovery/governance" className="text-sm font-semibold underline">← Governance Discovery</Link>
    <header className="space-y-2">
      <p className="platform-kicker">CRAWL-IT2.1 · Italia</p>
      <h1 className="text-3xl font-semibold">Registro fonti Discovery</h1>
      <p className="text-sm text-[#53637a]">Le fonti richiedono verifica umana di licenza, riutilizzo e privacy. La registrazione non avvia mai un crawl. Per il pilot Wikidata sono previsti al massimo 5 domini per esecuzione e una sola interrogazione, senza visite ai siti delle aziende.</p>
      <div className="rounded-xl border border-[#cbd9d3] bg-[#f6faf8] p-4 text-sm text-[#173f35]">
        <p className="font-semibold">CRAWL-IT6.5 · Prima fonte proposta: Wikidata (CC0)</p>
        <p className="mt-2">I dati strutturati sono CC0, ma la fonte deve essere revisionata dal Platform Owner. La schedulazione Railway resta disabilitata finché non viene attivata separatamente la variabile CRAWL_IT3_ENABLED. L’approvazione di una fonte non pubblica aziende.</p>
        <a className="mt-2 inline-flex min-h-11 items-center underline" href="https://www.wikidata.org/wiki/Wikidata:Licensing" target="_blank" rel="noopener noreferrer">Verifica licenza e diritti Wikidata ↗</a>
        <a className="ml-3 inline-flex min-h-11 items-center underline" href="https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual" target="_blank" rel="noopener noreferrer">Limiti del servizio query ↗</a>
      </div>
    </header>
    {params.message ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-900">{params.message}</p> : null}
    {params.error || error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-900">{params.error ?? "Impossibile leggere il registro delle fonti."}</p> : null}
    {canReview ? <form action={addDiscoverySource} className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2">
      <h2 className="font-semibold sm:col-span-2">Registra una fonte italiana</h2>
      <label className="grid gap-1 text-sm">Nome fonte<input required name="name" minLength={2} maxLength={180} className="min-h-11 rounded-lg border px-3"/></label>
      <label className="grid gap-1 text-sm">URL HTTPS<input required name="url" type="url" pattern="https://.*" className="min-h-11 rounded-lg border px-3"/></label>
      <label className="grid gap-1 text-sm">Tipologia<select name="type" className="min-h-11 rounded-lg border px-3">{sourceTypes.map(type=><option key={type} value={type}>{type.replaceAll("_"," ")}</option>)}</select></label>
      <button className="min-h-11 rounded-xl bg-[#173f35] px-5 font-semibold text-white">Aggiungi come non revisionata</button>
    </form> : null}
    {canRun && pendingLeads.length === 4 ? (
      <form action={linkApprovedPilotRun} className="space-y-2 rounded-2xl border p-4">
        <h2 className="font-semibold">Pilot controllato — collega quattro domini</h2>
        <p className="text-sm">Utilizza soltanto una run già approvata in Governance e di tua proprietà. I collegamenti non approvano candidati e non avviano scansioni.</p>
        <label className="grid gap-1 text-sm">ID della run approvata
          <input name="run_id" required pattern="[0-9a-fA-F-]{36}" className="min-h-11 rounded-lg border px-3" placeholder="UUID run" />
        </label>
        <button type="submit" className="min-h-11 rounded-xl border px-4 font-semibold">Collega quattro lead alla run</button>
      </form>
    ) : null}
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Nuovi domini da valutare ({pendingLeads.length})</h2>
      {leadError ? <p role="alert" className="rounded-xl border p-3 text-sm">Coda dei domini temporaneamente non disponibile.</p> : null}
      {pendingLeads.length===0 && !leadError ? <p className="rounded-xl border p-3 text-sm">Nessun dominio da revisionare.</p> : null}
      {pendingLeads.map(lead => <article key={lead.id} className="rounded-2xl border bg-white p-4">
        <p className="font-semibold">{lead.domain}</p>
        <p className="text-xs text-[#53637a]">Fonte: {lead.source_name}</p>
        <p className="mt-1 text-xs text-[#53637a]">ID lead: <code className="break-all">{lead.id}</code></p>
        <a href={lead.evidence_url} target="_blank" rel="noopener noreferrer" className="block break-all text-xs underline">Evidenza della provenienza</a>
        {canReview ? <form action={reviewDiscoveredDomain} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="lead_id" value={lead.id}/>
          <label className="grid gap-1 text-sm">Decisione
            <select name="decision" className="min-h-11 rounded-lg border px-2">
              <option value="reject">Rifiuta</option><option value="accept">Accetta per analisi crawler</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">Motivazione
            <input name="note" required minLength={12} maxLength={2000} className="min-h-11 rounded-lg border px-3"/>
          </label>
          <button className="min-h-11 rounded-xl border px-4 font-semibold sm:col-span-2">Registra decisione</button>
        </form> : null}
      </article>)}
    </section>
    {canReview && canRun ? <section className="rounded-2xl border bg-white p-4">
      <h2 className="text-lg font-semibold text-[#173f35]">NET-COV2B · collega la run dopo la governance</h2>
      <p className="mt-1 text-xs leading-5">Usa soltanto la run NET-COV2B approvata in Governance. Il collegamento controlla ancora i consensi di ogni dominio. Dopo il collegamento, il workflow GitHub Actions resta manuale.</p>
      <form action={linkApprovedFirstPartyRun} className="mt-3 flex flex-wrap gap-2">
       <input required name="run_id" placeholder="UUID run approvata" className="min-h-11 flex-1 rounded-lg border px-3"/>
       <button className="min-h-11 rounded-xl bg-[#173f35] px-4 font-semibold text-white">Collega run autorizzata</button>
      </form>
     </section>:null}
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Fonti registrate ({sources.length})</h2>
      {sources.length===0 ? <p className="rounded-xl border p-4 text-sm">Nessuna fonte inserita. La scoperta autonoma rimane disattivata.</p> : null}
      {sources.map(s=><article key={s.id} className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap justify-between gap-3">
          <div className="min-w-0"><h3 className="font-semibold">{s.source_name}</h3><p className="break-all text-sm">{s.source_url}</p><p className="text-xs text-[#66736e]">{s.source_type.replaceAll("_"," ")} · Italia</p></div>
          <span className="text-xs font-bold">{s.governance_status} · {s.enabled_for_discovery?"abilitata":"crawl disabilitato"}</span>
        </div>
        {s.rights_evidence_url ? <a href={s.rights_evidence_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm underline">Evidenza licenza e riutilizzo ↗</a> : null}
        {canRun && s.governance_status === "approved" && s.enabled_for_discovery ? (
          <form action={createGovernedDiscoveryRun} className="rounded-xl border border-[#cbd9d3] p-3">
            <input type="hidden" name="source_id" value={s.id}/>
            <p className="mb-2 text-xs text-[#53637a]">Crea una run solo per i domini in attesa di questa fonte. La run nasce non revisionata; nessun crawl o pubblicazione parte automaticamente.</p>
            <button type="submit" className="min-h-11 rounded-xl bg-[#173f35] px-4 font-semibold text-white">Crea run da fonte approvata</button>
          </form>
        ) : null}
        {s.source_type==="company_submission" ? <section className="space-y-3 rounded-xl border border-[#b8d3c4] bg-[#f6faf8] p-4">
          <h4 className="font-semibold text-[#173f35]">NET-COV2B · autorizzazione first-party</h4>
          <p className="text-xs leading-5 text-[#52615b]">
            {bySource.get(s.id)?.consented_domains ?? 0} domini con consenso non scaduto · massimo {bySource.get(s.id)?.max_sites_per_run ?? 10} per run.
            La fonte va revisionata qui come company_submission prima della registrazione dei consensi.
            L'approvazione di un archivio di aziende NON autorizza il crawl dei siti di quelle aziende.
          </p>
          {canReview && s.governance_status==="approved" ? <>
           <form action={recordFirstPartyPermission} className="grid gap-2">
             <input type="hidden" name="source_id" value={s.id}/>
             <label className="grid gap-1 text-xs">Dominio già qualificato NET-COV1
               <input required name="domain" placeholder="azienda.it" className="min-h-11 rounded-lg border px-3"/></label>
             <label className="grid gap-1 text-xs">URL ufficiale della prova di consenso al crawl e riutilizzo
               <input required name="permission_url" type="url" placeholder="https://azienda.it/autorizzazione" className="min-h-11 rounded-lg border px-3"/></label>
             <label className="grid gap-1 text-xs">Scadenza consenso
               <input required name="expires_at" type="date" className="min-h-11 rounded-lg border px-3"/></label>
             <label className="grid gap-1 text-xs">Motivazione verificata (almeno 40 caratteri)
               <textarea name="note" required minLength={40} maxLength={2000} rows={2} className="rounded-lg border p-3"/></label>
             <label className="flex gap-2 text-xs leading-5"><input type="checkbox" name="attested" required className="mt-1"/>
               Attesto un'autorizzazione esplicita dell'azienda, separata dalla pagina prodotto, che copre recupero automatizzato e riutilizzo delle informazioni societarie nel SaaS.
             </label>
             <button className="min-h-11 rounded-xl border px-4 font-semibold">Registra consenso · non avvia crawler</button>
           </form>
           <form action={activateConsentedSource} className="space-y-2 border-t pt-3">
             <input type="hidden" name="source_id" value={s.id}/>
             <label className="flex gap-2 text-xs"><input type="checkbox" name="attested" required/>Confermo esplicitamente licenza, privacy, limiti e permessi aziendali distinti.</label>
             <button className="min-h-11 rounded-xl border border-[#173f35] px-4 font-semibold text-[#173f35]">Abilita fonte con consensi validi</button>
           </form>
          </> : null}
          {canRun && canReview && s.enabled_for_discovery && s.governance_status==="approved" ? <form action={enqueueConsentedDomainLeads} className="space-y-2 border-t pt-3">
             <input type="hidden" name="source_id" value={s.id}/>
             <p className="text-xs">Trasferisci SOLO prospect già qualificati che hanno una prova di consenso attiva per questa fonte. I lead restano in review.</p>
             <label className="grid gap-1 text-xs">Limite per lotto (1-10)
              <input required type="number" name="limit" min={1} max={10} defaultValue={10} className="min-h-11 rounded-lg border px-3"/></label>
             <button className="min-h-11 rounded-xl border px-4 font-semibold">Inoltra soltanto domini autorizzati</button>
          </form>:null}
          {canRun && s.enabled_for_discovery && s.governance_status==="approved" ? <form action={prepareFirstPartyRun} className="space-y-2 border-t pt-3">
             <input type="hidden" name="source_id" value={s.id}/>
             <p className="text-xs">Inserisci gli ID dei lead già qualificati e inoltrati da NET-COV1, separati da virgole. La run richiederà una seconda approvazione in Governance.</p>
             <label className="grid gap-1 text-xs">ID lead (1-10)
              <textarea name="lead_ids" required rows={2} className="rounded-lg border p-3 font-mono text-xs" placeholder="UUID lead, UUID lead"/></label>
             <button className="min-h-11 rounded-xl border px-4 font-semibold">Prepara run non approvata</button>
          </form>:null}
        </section>:null}
        {canReview ? <form action={reviewDiscoverySourceRegistry} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={s.id}/>
          <label className="grid gap-1 text-sm">Decisione<select name="decision" defaultValue="restricted" className="min-h-11 rounded-lg border px-2"><option value="restricted">Limitata</option><option value="blocked">Bloccata</option><option value="approved">Approvata</option></select></label>
          <label className="grid gap-1 text-sm">Condizioni d’uso<select name="terms" defaultValue={s.terms_status} className="min-h-11 rounded-lg border px-2">{["not_checked","allows_reuse","allows_limited_reuse","restricts_reuse","unknown"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Diritti banca dati<select name="rights" defaultValue={s.database_rights_status} className="min-h-11 rounded-lg border px-2">{["not_assessed","low_risk","licensed","restricted","unknown"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Dati personali<select name="personal_data" defaultValue={s.personal_data_policy} className="min-h-11 rounded-lg border px-2">{["not_assessed","company_data_only","exclude_personal_data","legal_review_required"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label className="grid gap-1 text-sm sm:col-span-2">URL evidenza diritti<input name="evidence_url" type="url" defaultValue={s.rights_evidence_url ?? ""} className="min-h-11 rounded-lg border px-3"/></label>
          <label className="grid gap-1 text-sm sm:col-span-2">Motivazione review<textarea name="note" required minLength={10} maxLength={4000} rows={2} className="rounded-lg border p-3"/></label>
          {s.source_url === "https://query.wikidata.org/sparql" ? (
            <label className="flex min-h-11 items-start gap-3 text-sm sm:col-span-2">
              <input type="checkbox" name="enable" className="mt-1 h-4 w-4 accent-[#173f35]" />
              Abilita esclusivamente questa fonte nel registro dopo la decisione &quot;Approvata&quot;.
              Questo NON accende la schedulazione Railway.
            </label>
          ) : null}
          {s.source_url === "https://query.wikidata.org/sparql" ? (
            <label className="flex min-h-11 items-start gap-3 text-sm sm:col-span-2">
              <input type="checkbox" name="activation_attested" className="mt-1 h-4 w-4 accent-[#173f35]" />
              Ho verificato personalmente licenza CC0, limiti WDQS, riuso di soli dati societari e budget massimo di cinque domini per run.
            </label>
          ) : null}
          <button className="min-h-11 rounded-xl border border-[#173f35] px-5 font-semibold text-[#173f35] sm:col-span-2">Registra decisione · nessuna scansione avviata</button>
        </form> : null}
      </article>)}
    </section>
  </main>;
}
