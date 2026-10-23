import Link from "next/link";
import { redirect } from "next/navigation";

import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";
import { RightsDecisionForm } from "./rights-decision-form";

export const dynamic = "force-dynamic";

const USES = [
  ["discovery", "Discovery"],
  ["factual_profile", "Profilo aziendale"],
  ["excerpt_republication", "Estratti"],
  ["ai_retrieval", "AI retrieval"],
  ["ai_training", "AI training"],
  ["bulk_redistribution", "Redistribuzione"],
  ["paid_network", "Network a pagamento"],
] as const;

const FILTERS = [
  ["all", "Tutte"],
  ["unassessed", "Da valutare"],
  ["hold", "Hold"],
  ["blocked", "Bloccate"],
  ["reviewed", "Revisionate"],
] as const;

type EvidenceRow = {
  kind: string; id: string; source_url: string | null;
  source_date: string | null; candidate_governance: string | null;
  run_governance: string | null; rights_evidence_url: string | null;
  state: string; decision_id: string | null;
  reviewed_at: string | null; valid_until: string | null;
};
type CompanyRow = {
  id: string; name: string; status: string; source_count: number;
  hold_count: number; use_state: string; reviewed: number;
  allowed: number; blocked: number;
};
type Selected = {
  id: string; name: string; country: string; publication_status: string;
  company_use_state: string; source_count: number; hold_count: number;
  evidence: EvidenceRow[];
  history: Array<{decision: string; scope: string; basis: string | null;
    evidence_url: string | null; terms_version: string | null;
    note: string | null; reviewed_at: string | null;
    valid_until: string | null; recorded_at: string;}>;
};
type Queue = {
  contract: string; total: number; limit: number; offset: number;
  decision_count: number; items: CompanyRow[]; selected: Selected | null;
};
type Params = {scope?: string; filter?: string; offset?: string;
  company?: string; evidence?: string; kind?: string; saved?: string; error?: string};
const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

function route(input: {scope: string; filter: string; offset?: number;
  company?: string; evidence?: string; kind?: string}) {
  const params = new URLSearchParams();
  params.set("scope", input.scope);
  if (input.filter !== "all") params.set("filter", input.filter);
  if (input.offset) params.set("offset", String(input.offset));
  if (input.company) params.set("company", input.company);
  if (input.evidence) params.set("evidence", input.evidence);
  if (input.kind) params.set("kind", input.kind);
  return "/platform/network-trust/source-rights?" + params.toString();
}
function safeUrl(raw: string | null) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null;
  } catch { return null; }
}
function date(value: string | null) {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleDateString("it-IT") : "—";
}
function tone(state: string) {
  if (state === "allowed") return "bg-emerald-50 text-emerald-800";
  if (state === "limited" || state === "hold_review" || state === "not_assessed") return "bg-amber-50 text-amber-800";
  if (state === "blocked" || state === "revoked") return "bg-rose-50 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

export default async function RightsConsolePage({searchParams}: {
  searchParams: Promise<Params>;
}) {
  await requirePlatformSuperadmin();
  const params = await searchParams;
  const scope = USES.some(v=>v[0]===params.scope) ? params.scope! : "paid_network";
  const filter = FILTERS.some(v=>v[0]===params.filter) ? params.filter! : "all";
  const offset = Math.max(0,Math.min(50000,Number(params.offset)||0));
  const company = params.company && UUID.test(params.company) ? params.company : null;
  const evidence = params.evidence && UUID.test(params.evidence) ? params.evidence : null;
  const kind = ["discovery_candidate","source_assessment","data_assertion","canonical_evidence"].includes(params.kind||"")
    ? params.kind! : null;

  const supabase = await createClient();
  const {data,error} = await supabase.rpc("trust_c2g3_rights_console", {
    p_scope:scope,p_filter:filter,p_limit:25,p_offset:offset,
    p_company_id:company,p_evidence_id:evidence,p_evidence_kind:kind,
  });
  if (error?.code === "42501") redirect("/platform");
  if (error) throw new Error("La coda dei diritti non è attualmente disponibile.");
  const queue = data as Queue;
  if (queue?.contract !== "trust-c2g3-rights-console-v1") throw new Error("Contratto della coda diritti non valido.");
  const selected = queue.selected;
  const selectedEvidence = selected?.evidence.find(e=>e.id===evidence && e.kind===kind)
    ?? selected?.evidence[0] ?? null;
  const returnPath = route({scope,filter,offset,company:selected?.id,evidence:selectedEvidence?.id,kind:selectedEvidence?.kind});
  return (
    <main className="mx-auto max-w-[1440px] space-y-4 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/platform/network-trust" className="text-xs font-semibold text-[#286451] hover:underline">← Network Trust</Link>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#3c8067]">TRUST-C2G.3 · Platform Owner only</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#1b3028]">Source Rights</h1>
          <p className="mt-1 text-xs text-[#61746a]">Evidenze, utilizzi, decisioni e scadenze. Nessuna approvazione automatica.</p>
        </div>
        <div className="rounded-xl border border-[#d5e3db] bg-white px-4 py-3 text-right">
          <p className="text-xl font-semibold tabular-nums text-[#254b3d]">{queue.total}</p>
          <p className="text-[11px] text-[#61746a]">Aziende filtrate · {queue.decision_count} decisioni</p>
        </div>
      </div>

      {(params.saved==="1"||params.error) && (
        <p role="status" className={`rounded-xl border px-4 py-2 text-xs font-medium ${params.error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {params.error ? "Decisione non registrata. Ricarica la fonte e verifica autorizzazioni, prova e scadenza." : "Decisione registrata nel ledger. Nessuna attivazione automatica dei servizi."}
        </p>
      )}

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-2xl border border-[#dce6df] bg-white p-3">
        <label className="flex-1 min-w-[180px] text-[11px] font-semibold text-[#547064]">Utilizzo
          <select name="scope" defaultValue={scope} className="mt-1 h-9 w-full rounded-lg border border-[#cfddd3] bg-white px-3 text-xs text-[#203d32]">
            {USES.map(([id,label])=><option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="min-w-[150px] flex-1 text-[11px] font-semibold text-[#547064]">Stato
          <select name="filter" defaultValue={filter} className="mt-1 h-9 w-full rounded-lg border border-[#cfddd3] bg-white px-3 text-xs text-[#203d32]">
            {FILTERS.map(([id,label])=><option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-lg bg-[#205b49] px-4 text-xs font-semibold text-white hover:bg-[#174537]">Applica filtri</button>
      </form>

      <div className="grid gap-3 lg:grid-cols-[minmax(360px,0.88fr)_minmax(440px,1.12fr)]">
        <section aria-label="Aziende e stato dei diritti" className="min-w-0 overflow-hidden rounded-2xl border border-[#dce6df] bg-white">
          <div className="flex items-center justify-between border-b border-[#e8eee9] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#234738]">Aziende</h2>
            <span className="text-[11px] text-[#6f8276]">{offset+1}–{Math.min(offset+queue.items.length,queue.total)} di {queue.total}</span>
          </div>
          <div className="max-h-[740px] overflow-y-auto">
            <table className="w-full table-fixed text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[#f7faf8] text-[10px] uppercase tracking-wide text-[#647a6e]">
                <tr><th className="w-[47%] px-3 py-2">Azienda</th><th className="w-[17%] px-2 py-2">Fonti</th><th className="px-2 py-2">Diritti</th></tr>
              </thead>
              <tbody className="divide-y divide-[#ecf1ed]">
                {queue.items.map(item=>(
                  <tr key={item.id} className={item.id===selected?.id?"bg-[#eef6f0]":"hover:bg-[#f9fbf9]"}>
                    <td className="px-3 py-2.5 align-middle">
                      <Link href={route({scope,filter,offset,company:item.id})}
                        className="block truncate font-semibold text-[#244c3e] hover:underline" title={item.name}>{item.name}</Link>
                      <span className="text-[10px] text-[#87968e]">{item.status}</span>
                    </td>
                    <td className="px-2 py-2 tabular-nums text-[#405a4c]">
                      {item.source_count} {item.hold_count>0&&<span className="ml-1 rounded bg-rose-50 px-1 py-0.5 text-[10px] text-rose-700">Hold {item.hold_count}</span>}
                    </td>
                    <td className="px-2 py-2"><span className={`inline-block rounded-md px-1.5 py-1 text-[10px] font-semibold ${tone(item.use_state)}`}>{item.use_state.replaceAll("_"," ")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {queue.items.length===0&&<p className="p-6 text-xs text-[#64766b]">Nessuna azienda per questo filtro.</p>}
          </div>
          <nav aria-label="Pagine aziende" className="flex justify-between border-t border-[#e8eee9] p-3 text-xs">
            {offset>0?<Link className="font-semibold text-[#1e5e47]" href={route({scope,filter,offset:Math.max(0,offset-25)})}>← Precedenti</Link>:<span/>}
            {offset+25<queue.total?<Link className="font-semibold text-[#1e5e47]" href={route({scope,filter,offset:offset+25})}>Successive →</Link>:<span/>}
          </nav>
        </section>

        <section aria-label="Evidenze e decisioni" className="min-w-0 space-y-3">
          {!selected?<div className="rounded-2xl border border-[#dce6df] bg-white p-5 text-sm text-[#607467]">Seleziona un'azienda.</div>:<>
            <div className="rounded-2xl border border-[#dce6df] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-[#1c3c2e]">{selected.name}</h2>
                  <p className="text-[11px] text-[#6b8072]">{selected.country} · {selected.publication_status} · {selected.source_count} evidenze</p>
                </div>
                <span className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${tone(selected.company_use_state)}`}>{selected.company_use_state.replaceAll("_"," ")}</span>
              </div>
              {selected.hold_count>0&&<p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] font-medium text-rose-800">Hold aperti: {selected.hold_count}. Non è consentito registrare nuove concessioni.</p>}
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {selected.evidence.map(e=>(
                  <Link key={e.kind+e.id}
                    href={route({scope,filter,offset,company:selected.id,evidence:e.id,kind:e.kind})}
                    title={e.kind}
                    className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${selectedEvidence?.id===e.id&&selectedEvidence?.kind===e.kind?"border-[#28684e] bg-[#e5f0e8] text-[#194c35]":"border-[#e0e7e1] text-[#5e7566] hover:bg-[#f4f8f5]"}`}>
                    {e.kind.replaceAll("_"," ")} · {e.state.replaceAll("_"," ")}
                  </Link>
                ))}
              </div>
            </div>

            {selectedEvidence&&<>
              <div className="rounded-2xl border border-[#dce6df] bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#387459]">Fonte selezionata</p>
                <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                  <div><p className="text-[#7a8c80]">Tipo</p><p className="mt-1 font-semibold text-[#284635]">{selectedEvidence.kind.replaceAll("_"," ")}</p></div>
                  <div><p className="text-[#7a8c80]">Stato per questo uso</p><p className="mt-1 font-semibold text-[#284635]">{selectedEvidence.state.replaceAll("_"," ")}</p></div>
                  <div><p className="text-[#7a8c80]">Candidatura / run</p><p className="mt-1 text-[#536a5a]">{selectedEvidence.candidate_governance||"—"} / {selectedEvidence.run_governance||"—"}</p></div>
                  <div><p className="text-[#7a8c80]">Acquisizione</p><p className="mt-1 text-[#536a5a]">{date(selectedEvidence.source_date)}</p></div>
                </div>
                {safeUrl(selectedEvidence.source_url)&&<a href={safeUrl(selectedEvidence.source_url)!} target="_blank" rel="noopener noreferrer" className="mt-2 block truncate text-xs font-semibold text-[#1f694d] underline" title={selectedEvidence.source_url||""}>Apri fonte originale ↗</a>}
                {safeUrl(selectedEvidence.rights_evidence_url)&&<a href={safeUrl(selectedEvidence.rights_evidence_url)!} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-[#1f694d] underline">Prova diritti registrata ↗</a>}
                <p className="mt-2 text-[11px] text-[#79887f]">La sola esistenza di un URL o un run approvato non autorizza il riuso.</p>
              </div>
              <RightsDecisionForm
                evidence={selectedEvidence} scope={scope}
                companyId={selected.id} hasHold={selected.hold_count>0}
                returnPath={returnPath}
              />
              <div className="rounded-2xl border border-[#dce6df] bg-white p-4">
                <h3 className="text-xs font-semibold text-[#31513f]">Cronologia append-only</h3>
                {!evidence&&<p className="mt-2 text-[11px] text-[#79887f]">Seleziona una fonte per visualizzare la cronologia.</p>}
                {evidence&&selected.history.length===0&&<p className="mt-2 text-xs text-[#79887f]">Nessuna decisione registrata.</p>}
                {selected.history.map((h,i)=><div key={i} className="mt-2 border-t border-[#edf1ed] pt-2 text-xs">
                  <div className="flex justify-between"><span className="font-semibold text-[#314b3d]">{h.decision} · {h.scope}</span><time className="text-[#85988b]">{date(h.recorded_at)}</time></div>
                  <p className="mt-1 text-[#61766a]">{h.note||"Senza nota"}</p>
                  {safeUrl(h.evidence_url)&&<a href={safeUrl(h.evidence_url)!} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[#1f694d] underline">Prova documentale ↗</a>}
                </div>)}
              </div>
            </>}
          </>}
        </section>
      </div>
    </main>
  );
}
