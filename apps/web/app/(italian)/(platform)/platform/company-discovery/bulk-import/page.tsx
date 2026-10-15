import Link from "next/link";
import { ItalianCompanyBulkImport } from "@/components/italian-company-bulk-import";
import { getPlatformAccessContext, requirePlatformPermission } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

type Source={
 id:string;source_name:string;source_url:string;source_type:string;
 governance_status:string;terms_status:string;database_rights_status:string;
 personal_data_policy:string;
};
type Audit={
 candidate_records?:number;candidate_domains?:number;pending_domains?:number;
 pending_trader_domains?:number;pending_end_user_domains?:number;
 csv_staged_rows?:number;csv_trader_proposals?:number;csv_end_user_proposals?:number;
 published_italian_companies?:number;
};
type Stage={
 id:string;company_name:string;proposed_role:string;province:string|null;
 ateco_code:string|null;status:string;source_name:string;evidence_url:string;created_at:string;
};
export default async function ItalianDiscoveryBulkPage(){
 await requirePlatformPermission("discovery.read");
 const access=await getPlatformAccessContext();
 const canRun=access?.permissions.includes("discovery.run")??false;
 const supabase=await createClient();
 const [sourcesResult,auditResult,queueResult]=await Promise.all([
  supabase.rpc("crawl_it2_list_sources"),
  supabase.rpc("crawl_it66_pipeline_audit"),
  supabase.rpc("crawl_it66_staged_rows")
 ]);
 const sources=((sourcesResult.data??[]) as Source[]).filter(s=>
   s.source_url!=="https://query.wikidata.org/sparql");
 const audit=(auditResult.data??{}) as Audit;
 const queue=(queueResult.data??[]) as Stage[];
 return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
  <Link href="/platform/company-discovery" className="text-sm font-semibold text-[#37576a] underline">
   ← Company Discovery
  </Link>
  <header className="platform-surface rounded-3xl p-6 sm:p-8">
   <p className="platform-kicker">CRAWL-IT6.6a/b · Italia</p>
   <h1 className="mt-2 text-3xl font-semibold text-[#18263d]">Acquisizione aziende a lotti</h1>
   <p className="mt-3 text-sm leading-6 text-[#53637a]">
    Importa aziende commercianti e utilizzatrici in staging, fino a 2.000 righe per CSV.
    Anteprima con deduplicazione prima del salvataggio. Il ruolo è sempre proposto, mai verificato automaticamente.
    Nessun record viene pubblicato nel Network.
   </p>
   <div className="mt-4 flex flex-wrap gap-2">
    <Link href="/platform/company-discovery/sources" className="platform-secondary rounded-xl px-4 py-2 text-sm font-semibold">
      Verifica diritti della fonte →
    </Link>
    <Link href="/platform/company-discovery/governance" className="platform-secondary rounded-xl px-4 py-2 text-sm font-semibold">
      Governance aziende →
    </Link>
   </div>
  </header>
  <section aria-label="Stato pipeline" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
   {[
     ["Domini candidati distinti",audit.candidate_domains??0],
     ["Domini pending",audit.pending_domains??0],
     ["Commercianti pending",audit.pending_trader_domains??0],
     ["Utilizzatori pending",audit.pending_end_user_domains??0],
     ["Righe CSV in staging",audit.csv_staged_rows??0],
     ["Commercianti CSV",audit.csv_trader_proposals??0],
     ["Utilizzatori CSV",audit.csv_end_user_proposals??0],
     ["Aziende pubblicate Italia",audit.published_italian_companies??0],
   ].map(([label,value])=><div key={String(label)} className="platform-surface rounded-2xl p-4">
     <p className="text-xs text-[#52615b]">{label}</p>
     <p className="mt-1 text-2xl font-semibold text-[#18263d]">{value}</p>
   </div>)}
  </section>
  <section className="platform-surface space-y-4 rounded-3xl p-5 sm:p-7">
   <h2 className="text-xl font-semibold text-[#18263d]">RNA — candidati open data senza acquisti</h2>
   <p className="text-sm text-[#53637a]">
     I dati RNA (Registro Nazionale Aiuti di Stato, MIMIT) possono aiutare a trovare società manifatturiere
     e commercianti. La classificazione NACE dell&apos;aiuto è solo un indizio, non dimostra che l&apos;azienda
     acquisti acciaio o tubi. Il workflow GitHub esegue un&apos;<strong>anteprima aggregata, senza CSV pubblici e senza scritture</strong>.
     La fonte rimane da verificare per uso commerciale, attribuzione e tutela dei dati personali.
   </p>
   <div className="flex flex-wrap gap-2">
     <a href="https://www.rna.gov.it/open-data/aiuti" target="_blank" rel="noopener noreferrer"
       className="platform-secondary rounded-xl px-4 py-2 text-sm font-semibold">
       Dataset ufficiali RNA ↗
     </a>
     <a href="https://github.com/ctimaru/steel-sales-ai/actions/workflows/crawl-it66c-rna-corporate-preview.yml"
       target="_blank" rel="noopener noreferrer" className="platform-secondary rounded-xl px-4 py-2 text-sm font-semibold">
       Anteprima aggregata RNA su GitHub ↗
     </a>
   </div>
   <p className="text-xs text-[#53637a]">
     La repository GitHub è pubblica: nei log vedrai solo conteggi aggregati. Nessun CSV o identificativo fiscale
     viene pubblicato come artefatto. Per l&apos;eventuale importazione servono una procedura privata e l&apos;approvazione della fonte.
   </p>
  </section>
  <section className="platform-surface space-y-4 rounded-3xl p-5 sm:p-7">
   <h2 className="text-xl font-semibold text-[#18263d]">Importa CSV</h2>
   <p className="text-sm text-[#53637a]">
    La fonte Telemaco/InfoCamere è stata registrata solo come <strong>proposta, non approvata</strong>.
    L&apos;acquisto di un elenco non dimostra da solo il diritto di riutilizzo o ripubblicazione.
    Per attivare lo staging serve una fonte realmente approvata per questo uso dal Platform Owner.
   </p>
   {!canRun?<p className="rounded-xl border p-4 text-sm">
     Account in sola lettura. Occorre il permesso discovery.run per importare.
    </p>:sourcesResult.error?<p className="text-sm text-rose-800">Impossibile caricare il registro fonti.</p>
    :<ItalianCompanyBulkImport sources={sources}/>}
  </section>
  <section className="platform-surface space-y-4 rounded-3xl p-5 sm:p-7">
   <h2 className="text-xl font-semibold text-[#18263d]">Righe in staging — ultime 80</h2>
   <p className="text-sm text-[#53637a]">
    Candidati non pubblicati, da governare in un passaggio successivo.
    Non sono profili aziendali verificati e non abilitano l&apos;invio di comunicazioni.
   </p>
   {queueResult.error?<p className="text-rose-800 text-sm">Impossibile caricare la coda privata.</p>
   :queue.length===0?<p className="text-sm text-[#53637a]">Nessun record CSV ancora inserito.</p>
   :<div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
    <thead><tr className="border-b border-slate-200">
     <th className="px-2 py-3">Azienda proposta</th><th className="px-2 py-3">Ruolo</th>
     <th className="px-2 py-3">Provincia</th><th className="px-2 py-3">ATECO</th>
     <th className="px-2 py-3">Fonte</th><th className="px-2 py-3">Stato</th>
    </tr></thead>
    <tbody>{queue.map(row=><tr key={row.id} className="border-b border-slate-100">
     <td className="px-2 py-3 font-medium">{row.company_name}</td>
     <td className="px-2 py-3">{row.proposed_role==="end_user"?"Utilizzatore (proposto)":"Commerciante (proposto)"}</td>
     <td className="px-2 py-3">{row.province??"Da verificare"}</td>
     <td className="px-2 py-3">{row.ateco_code??"—"}</td>
     <td className="px-2 py-3">{row.source_name}</td>
     <td className="px-2 py-3">Da revisionare</td>
    </tr>)}</tbody>
   </table></div>}
  </section>
 </main>;
}
