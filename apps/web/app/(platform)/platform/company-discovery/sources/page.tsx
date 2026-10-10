import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPlatformAccessContext, requirePlatformPermission } from "@/lib/platform-admin";
import { addDiscoverySource, reviewDiscoverySourceRegistry } from "./actions";

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
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crawl_it2_list_sources");
  const sources = (data ?? []) as Source[];
  return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
    <Link href="/platform/company-discovery/governance" className="text-sm font-semibold underline">← Governance Discovery</Link>
    <header className="space-y-2">
      <p className="platform-kicker">CRAWL-IT2.1 · Italia</p>
      <h1 className="text-3xl font-semibold">Registro fonti Discovery</h1>
      <p className="text-sm text-[#53637a]">Le fonti richiedono verifica dei diritti prima della scansione. Il motore di scoperta periodica non è attivo e nessuna registrazione avvia un crawl.</p>
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
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Fonti registrate ({sources.length})</h2>
      {sources.length===0 ? <p className="rounded-xl border p-4 text-sm">Nessuna fonte inserita. La scoperta autonoma rimane disattivata.</p> : null}
      {sources.map(s=><article key={s.id} className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap justify-between gap-3">
          <div className="min-w-0"><h3 className="font-semibold">{s.source_name}</h3><p className="break-all text-sm">{s.source_url}</p><p className="text-xs text-[#66736e]">{s.source_type.replaceAll("_"," ")} · Italia</p></div>
          <span className="text-xs font-bold">{s.governance_status} · {s.enabled_for_discovery?"abilitata":"crawl disabilitato"}</span>
        </div>
        {canReview ? <form action={reviewDiscoverySourceRegistry} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={s.id}/>
          <label className="grid gap-1 text-sm">Decisione<select name="decision" defaultValue="restricted" className="min-h-11 rounded-lg border px-2"><option value="restricted">Limitata</option><option value="blocked">Bloccata</option><option value="approved">Approvata</option></select></label>
          <label className="grid gap-1 text-sm">Condizioni d’uso<select name="terms" defaultValue={s.terms_status} className="min-h-11 rounded-lg border px-2">{["not_checked","allows_reuse","allows_limited_reuse","restricts_reuse","unknown"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Diritti banca dati<select name="rights" defaultValue={s.database_rights_status} className="min-h-11 rounded-lg border px-2">{["not_assessed","low_risk","licensed","restricted","unknown"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Dati personali<select name="personal_data" defaultValue={s.personal_data_policy} className="min-h-11 rounded-lg border px-2">{["not_assessed","company_data_only","exclude_personal_data","legal_review_required"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label className="grid gap-1 text-sm sm:col-span-2">URL evidenza diritti<input name="evidence_url" type="url" defaultValue={s.rights_evidence_url ?? ""} className="min-h-11 rounded-lg border px-3"/></label>
          <label className="grid gap-1 text-sm sm:col-span-2">Motivazione review<textarea name="note" required minLength={10} maxLength={4000} rows={2} className="rounded-lg border p-3"/></label>
          <button className="min-h-11 rounded-xl border border-[#173f35] px-5 font-semibold text-[#173f35] sm:col-span-2">Registra decisione senza avviare scansioni</button>
        </form> : null}
      </article>)}
    </section>
  </main>;
}
