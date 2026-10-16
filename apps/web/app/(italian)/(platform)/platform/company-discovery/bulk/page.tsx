import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {getPlatformAccessContext,requirePlatformPermission} from "@/lib/platform-admin";
import {grantLicensedSource,importLicensedDataset,revokeLicensedSource,suppressLicensedDomain} from "./actions";

type BulkSource={source_id:string;name:string;url:string;approved:boolean;
 grant_active:boolean;expiry:string|null;imported:number};
type BulkBatch={id:string;campaign:string;received:number;added:number;
 duplicate:number;skipped:number;at:string};
type Status={contract?:string;sources?:BulkSource[];recent_batches?:BulkBatch[];
 total_feed_entities?:number};
type Cordis={contract?:string;source?:{id?:string;status?:string;rights_active?:boolean};
 research_only?:number;website_evidence?:number;recent_runs?:Array<{month:string;status:string;scanned:number;new_research:number;new_unconfirmed:number}>};

export default async function BulkDiscoveryPage({
 searchParams,
}:{searchParams:Promise<{message?:string;error?:string}>}){
 await requirePlatformPermission("discovery.read");
 const context=await getPlatformAccessContext();
 const canReview=context?.permissions.includes("discovery.governance_review")??false;
 const canImport=context?.permissions.includes("discovery.enrich")??false;
 const params=await searchParams;
 const supabase=await createClient();
 const [{data,error},{data:cordisData}]=await Promise.all([
  supabase.rpc("netfast3_source_status"),supabase.rpc("netfast3b_status"),
 ]);
 const cordis=(cordisData as Cordis|null)?.contract==="netfast3b-cordis-status-v1" ? cordisData as Cordis : null;
 const status=data as Status|null;
 const sources=status?.contract==="netfast3-status-v1"?status.sources??[]:[];
 const approved=sources.filter(s=>s.approved);
 const usable=approved.filter(s=>s.grant_active);
 return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
  <Link href="/platform/company-discovery/sources" className="text-sm font-semibold underline">← Registro fonti</Link>
  <header className="space-y-2">
   <p className="platform-kicker">NET-FAST3 · Network acquisition</p>
   <h1 className="text-3xl font-semibold">Importazione massiva aziende</h1>
   <p className="text-sm leading-6 text-[#52615b]">Fino a 1.000 aziende per lotto da una fonte strutturata autorizzata una sola volta. Le nuove schede diventano visibili nel Network Free come <strong>Da confermare</strong>. Non è una verifica commerciale e non avvia crawler su siti aziendali.</p>
  </header>
  {params.message ? <p role="status" className="rounded-xl border border-emerald-200 p-4 text-sm text-emerald-800">{params.message}</p>:null}
  {params.error||error ? <p role="alert" className="rounded-xl border border-rose-200 p-4 text-sm text-rose-800">{params.error??"Impossibile leggere le fonti."}</p>:null}
  <div className="grid gap-3 sm:grid-cols-3">
   <div className="rounded-xl border bg-white p-4"><p className="text-xs text-[#52615b]">Feed approvati attivi</p><p className="mt-1 text-2xl font-bold">{usable.length}</p></div>
   <div className="rounded-xl border bg-white p-4"><p className="text-xs text-[#52615b]">Schede da feed nel database</p><p className="mt-1 text-2xl font-bold">{status?.total_feed_entities??0}</p></div>
   <div className="rounded-xl border bg-white p-4"><p className="text-xs text-[#52615b]">Dimensione per lotto</p><p className="mt-1 text-2xl font-bold">1.000</p></div>
  </div>
  <section className="space-y-2 rounded-2xl border bg-white p-4">
    <h2 className="text-lg font-semibold">NET-FAST3B · CORDIS Horizon Europe</h2>
    <p className="text-sm leading-6 text-[#52615b]">
      Aggiornamento automatico mensile il 5 del mese. Il feed raccoglie i record delle organizzazioni
      italiane private e for-profit, ma <strong>senza sito ufficiale non crea profili Network</strong>.
      Il diritto di redistribuzione deve essere approvato una sola volta nella sezione fonti.
    </p>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border p-3"><p className="text-xs text-[#52615b]">Organizzazioni da arricchire</p><p className="mt-1 text-xl font-bold">{cordis?.research_only??"—"}</p></div>
      <div className="rounded-lg border p-3"><p className="text-xs text-[#52615b]">Con evidenza sito</p><p className="mt-1 text-xl font-bold">{cordis?.website_evidence??"—"}</p></div>
      <div className="rounded-lg border p-3"><p className="text-xs text-[#52615b]">Licenza feed</p><p className="mt-1 text-sm font-semibold">{cordis?.source?.rights_active?"Autorizzata": "Da verificare"}</p></div>
    </div>
    <p className="text-xs text-[#52615b]">
      Ultima esecuzione: {cordis?.recent_runs?.[0] ? `${cordis.recent_runs[0].month} · ${cordis.recent_runs[0].status} · ${cordis.recent_runs[0].scanned} record` : "Nessuna esecuzione di importazione autorizzata"}
    </p>
    <div className="flex flex-wrap gap-4 text-sm">
      <Link href="/platform/company-discovery/sources" className="font-semibold underline">Revisiona fonte e licenza →</Link>
      <a href="https://github.com/ctimaru/steel-sales-ai/actions/workflows/netfast3b-cordis-monthly.yml" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Log import mensile ↗</a>
    </div>
  </section>
  <section className="space-y-3 rounded-2xl border bg-white p-4">
   <h2 className="text-lg font-semibold">1. Fonte e diritti di riutilizzo</h2>
   <p className="text-sm leading-6">Registra e revisiona prima una fonte di tipo <code>licensed_search</code> o <code>curated_public_source</code> nel <Link className="font-semibold underline" href="/platform/company-discovery/sources">Registro fonti</Link>, lasciando il crawler disattivato. Poi conferma una sola volta il diritto di riutilizzare e visualizzare le schede aziendali in un SaaS commerciale. Una licenza per analisi interne non basta.</p>
   {sources.length ? <div className="space-y-2">{sources.map(s=>
    <div key={s.source_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
     <div><p className="font-semibold">{s.name}</p><p className="break-all text-xs text-[#52615b]">{s.url}</p></div>
     <span className="text-xs font-semibold">{s.grant_active?"Import abilitato":s.approved?"Fonte revisionata · manca licenza di visualizzazione":"Fonte non revisionata"}</span>
    </div>)}</div>:<p className="text-sm text-[#52615b]">Non risultano fonti strutturate candidate. Nessuna licenza viene presunta.</p>}
   {canReview&&approved.length ? <form action={grantLicensedSource} className="grid gap-3 border-t pt-4 sm:grid-cols-2">
    <label className="grid gap-1 text-sm">Fonte già approvata<select name="source_id" required className="min-h-11 rounded-lg border px-3">{approved.map(s=><option value={s.source_id} key={s.source_id}>{s.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm">Scadenza licenza<input required name="expires_at" type="date" className="min-h-11 rounded-lg border px-3"/></label>
    <label className="grid gap-1 text-sm sm:col-span-2">URL della licenza o contratto per redistribuzione<input required name="license_url" type="url" placeholder="https://..." className="min-h-11 rounded-lg border px-3"/></label>
    <label className="grid gap-1 text-sm sm:col-span-2">Evidenza dell'ambito commerciale (minimo 60 caratteri)<textarea name="note" required minLength={60} maxLength={3000} rows={3} className="rounded-lg border p-3"/></label>
    <label className="flex gap-2 text-sm sm:col-span-2"><input name="attested" type="checkbox" required value="yes"/>Attesto che questo specifico dataset consente riuso, pubblicazione dei profili e distribuzione nell'applicazione, senza dati personali.</label>
    <button className="min-h-11 rounded-lg bg-[#173f35] px-4 font-semibold text-white sm:col-span-2">Autorizza questo dataset una sola volta</button>
   </form>:null}
  </section>
  <section className="space-y-3 rounded-2xl border bg-white p-4">
   <h2 className="text-lg font-semibold">2. Importa il lotto · nessuna review per azienda</h2>
   <p className="text-sm">Carica un CSV/TSV o incolla le righe da Excel. Colonne: <code>name</code>, <code>domain</code>, <code>record_id</code>, <code>role</code>. Il ruolo è facoltativo: <code>unknown</code> resta una classificazione da confermare. Record senza contatti personali, fino a 450 KB e 1.000 righe.</p>
   {canImport&&usable.length ? <form action={importLicensedDataset} className="grid gap-3">
    <label className="grid gap-1 text-sm">Fonte attiva<select required name="source_id" className="min-h-11 rounded-lg border px-3">{usable.map(s=><option key={s.source_id} value={s.source_id}>{s.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm">Nome campagna<input required name="campaign" minLength={3} maxLength={80} placeholder="Italia · metalmeccanica · lotto 1" className="min-h-11 rounded-lg border px-3"/></label>
    <label className="grid gap-1 text-sm">File CSV / TSV<input name="file" type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" className="rounded-lg border p-3"/></label>
    <label className="grid gap-1 text-sm">Oppure incolla da Excel<textarea name="rows" rows={6} placeholder={"name\tdomain\trecord_id\trole\nEsempio Industriale SRL\tesempio-industriale.it\tID-001\tunknown"} className="rounded-lg border p-3 font-mono text-xs"/></label>
    <button className="min-h-11 rounded-xl bg-[#173f35] px-4 font-semibold text-white">Importa e rendi visibili come Da confermare</button>
   </form>:<p className="text-sm text-[#52615b]">Quando una fonte strutturata avrà il diritto di visualizzazione approvato, comparirà qui. Nessuna azienda viene inventata per popolare la directory.</p>}
  </section>
  <section className="grid gap-4 sm:grid-cols-2">
   {canReview ? <form action={revokeLicensedSource} className="space-y-3 rounded-xl border p-4">
     <h2 className="font-semibold">Revoca una fonte</h2>
     <select required name="source_id" className="min-h-11 w-full rounded-lg border px-3">{sources.map(s=><option key={s.source_id} value={s.source_id}>{s.name}</option>)}</select>
     <input required name="reason" minLength={15} maxLength={1000} placeholder="Motivo della revoca" className="min-h-11 w-full rounded-lg border px-3"/>
     <button className="min-h-11 rounded-lg border px-4 text-sm font-semibold">Revoca e nascondi tutte le schede del feed</button>
   </form>:null}
   {canReview ? <form action={suppressLicensedDomain} className="space-y-3 rounded-xl border p-4">
     <h2 className="font-semibold">Rimuovi un'azienda scoperta</h2>
     <input required name="domain" placeholder="azienda.it" className="min-h-11 w-full rounded-lg border px-3"/>
     <input required name="reason" minLength={15} maxLength={1000} placeholder="Motivo o richiesta della società" className="min-h-11 w-full rounded-lg border px-3"/>
     <button className="min-h-11 rounded-lg border px-4 text-sm font-semibold">Escludi il dominio dai successivi import</button>
   </form>:null}
  </section>
  <section className="rounded-xl border p-4">
   <h2 className="font-semibold">Ultimi lotti</h2>
   {status?.recent_batches?.length ? <div className="mt-3 space-y-2">{status.recent_batches.map(b=>
    <p className="text-sm" key={b.id}><strong>{b.campaign}</strong> · {b.received} righe · {b.added} nuove · {b.duplicate} duplicate · {b.skipped} scartate</p>)}</div>:
    <p className="mt-2 text-sm text-[#52615b]">Nessun lotto importato; primo risultato non ancora disponibile.</p>}
  </section>
 </main>;
}
