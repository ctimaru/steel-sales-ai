import Link from "next/link";
import { SavedDistintaActions } from "@/components/saved-distinta-actions";

import { canWriteWorkspace } from "@/lib/access-policy";
import { appRoutes } from "@/lib/routes";
import { formatHubDate } from "@/lib/rfq-hub-overview";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Distinte salvate · RFQ Hub", robots: privateNoIndexRobots };

const PAGE_SIZE = 25;
function archiveUrl(query:string,mode:"active"|"archived",page=1) {
  const params=new URLSearchParams();
  if(query) params.set("q",query);
  if(mode==="archived") params.set("view","archived");
  if(page>1) params.set("page",String(page));
  return appRoutes.rfqHub.savedDistinte+(params.toString()?"?"+params.toString():"");
}
function pageNumber(raw: unknown): number {
  if (typeof raw !== "string" || !/^[1-9]\d{0,3}$/.test(raw)) return 1;
  const parsed = Number(raw);
  return Math.min(parsed, 1000);
}
function formatTonnes(value: number | null): string {
  return value === null ? "—" : Number(value).toLocaleString("it-IT", {
    minimumFractionDigits: 3, maximumFractionDigits: 3,
  });
}

export default async function RfqSavedDistinteArchive({
  searchParams,
}: { searchParams: Promise<{ page?: string; q?: string; view?: string }> }) {
  const { page: rawPage,q:rawQuery,view } = await searchParams;
  const page = pageNumber(rawPage);
  const query=typeof rawQuery==="string"?rawQuery.trim().slice(0,80):"";
  const mode=view==="archived"?"archived":"active";
  const context = await getWorkspaceContext();
  const supabase = await createClient();
  let request=supabase.from("buyer_distintas")
    .select("id,title,owner_user_id,created_at,line_count,total_tonnes,archived_at", { count: "exact" })
    .eq("organization_id", context.organizationId);
  if(mode==="active") request=request.is("archived_at",null);
  else request=request.not("archived_at","is",null);
  if(query) request=request.ilike("title","%"+query.replace(/[%_]/g,"")+"%");
  const {data,error,count}=await request
    .order("created_at",{ascending:false})
    .order("id",{ascending:false})
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const pages = count === null ? 1 : Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-4 pb-10">
      <nav aria-label="Percorso RFQ Hub" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
        <Link href={appRoutes.rfqHub.home} className="hover:underline">RFQ Hub</Link>
        <span aria-hidden="true">/</span><span className="text-[var(--brand-deep)]">Distinte salvate</span>
      </nav>
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-white p-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-primary)]">Archivio aziendale · privato</p>
          <h1 className="mt-1 text-xl font-extrabold text-[var(--brand-deep)]">Distinte salvate</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Distinte private dell'azienda. Rinomina, duplica o archivia senza alterare articoli e RFQ.
          </p>
        </div>
        {canWriteWorkspace(context.role) ? (
          <Link href={appRoutes.rfqHub.createDistinta} className="platform-primary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-bold">
            + Nuova distinta
          </Link>
        ) : null}
      </header>
      <section data-dist4-archive className="rounded-xl border border-[var(--border)] bg-white p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <form method="get" action={appRoutes.rfqHub.savedDistinte} role="search"
            className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
            <label className="min-w-[10rem] max-w-sm flex-1 text-xs font-bold text-[var(--brand-deep)]">
              Cerca per nome
              <input name="q" type="search" defaultValue={query} maxLength={80}
                placeholder="Es. Commessa tubolari"
                className="mt-1 h-11 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm text-[var(--brand-deep)]"/>
            </label>
            {mode==="archived"?<input type="hidden" name="view" value="archived"/>:null}
            <button type="submit" className="platform-primary min-h-11 rounded-lg px-3 text-xs font-bold">Cerca</button>
            {query?<Link href={archiveUrl("",mode)} className="app-secondary inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold">Azzera</Link>:null}
          </form>
          <nav aria-label="Filtra archivio" className="flex flex-wrap gap-1.5">
            <Link data-dist4-active-tab href={archiveUrl(query,"active")}
              aria-current={mode==="active"?"page":undefined}
              className={"inline-flex min-h-11 items-center rounded-lg border px-3 text-xs font-bold "+(mode==="active"?"border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-deep)]":"border-[var(--border)] text-[var(--text-secondary)]")}>Attive</Link>
            <Link data-dist4-archived-tab href={archiveUrl(query,"archived")}
              aria-current={mode==="archived"?"page":undefined}
              className={"inline-flex min-h-11 items-center rounded-lg border px-3 text-xs font-bold "+(mode==="archived"?"border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-deep)]":"border-[var(--border)] text-[var(--text-secondary)]")}>Archiviate</Link>
          </nav>
        </div>
        {error ? (
          <p role="status" className="py-4 text-sm text-[var(--text-secondary)]">Archivio temporaneamente non disponibile. Riprova più tardi.</p>
        ) : !data?.length ? (
          <p className="py-5 text-sm text-[var(--text-secondary)]">
            {page>1?"Nessuna distinta in questa pagina.":query?"Nessuna distinta corrisponde alla ricerca.":mode==="archived"?"Nessuna distinta archiviata.":"Nessuna distinta salvata ancora visibile."}
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {data.map((draft) => (
              <article key={draft.id} data-dist4-row
                className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
                <Link href={appRoutes.rfqHub.savedDistinta(draft.id)}
                  className="group flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--brand-deep)] group-hover:underline">{draft.title || "Distinta"}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{draft.line_count} righe · {formatTonnes(draft.total_tonnes)} t · {formatHubDate(draft.created_at)}</p>
                  </div>
                  <span aria-hidden="true" className="text-[var(--brand-primary)]">→</span>
                </Link>
                {canWriteWorkspace(context.role)&&draft.owner_user_id===context.userId?
                  <SavedDistintaActions id={draft.id} title={draft.title} archived={Boolean(draft.archived_at)} compact/>:null}
              </article>
            ))}
          </div>
        )}
        {!error ? (
          <nav aria-label="Pagine distinte salvate" className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
            <span className="text-xs text-[var(--text-secondary)]">Pagina {page} di {pages} · {count ?? "—"} distinte accessibili</span>
            <div className="flex items-center gap-2">
              {page > 1 ? <Link href={archiveUrl(query,mode,page-1)} className="app-secondary inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-bold">← Precedente</Link> : null}
              {page < pages ? <Link href={archiveUrl(query,mode,page+1)} className="app-secondary inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-bold">Successiva →</Link> : null}
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
