import Link from "next/link";

import { canWriteWorkspace } from "@/lib/access-policy";
import { appRoutes } from "@/lib/routes";
import { formatHubDate } from "@/lib/rfq-hub-overview";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Distinte salvate · RFQ Hub", robots: privateNoIndexRobots };

const PAGE_SIZE = 25;
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
}: { searchParams: Promise<{ page?: string }> }) {
  const { page: rawPage } = await searchParams;
  const page = pageNumber(rawPage);
  const context = await getWorkspaceContext();
  const supabase = await createClient();
  const { data, error, count } = await supabase.from("buyer_distintas")
    .select("id,title,owner_user_id,created_at,line_count,total_tonnes", { count: "exact" })
    .eq("organization_id", context.organizationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
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
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-primary)]">Archivio aziendale · sola lettura</p>
          <h1 className="mt-1 text-xl font-extrabold text-[var(--brand-deep)]">Distinte salvate</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Snapshot autorizzati per l'azienda attiva. Non include le bozze temporanee del browser.
          </p>
        </div>
        {canWriteWorkspace(context.role) ? (
          <Link href={appRoutes.rfqHub.createDistinta} className="platform-primary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-bold">
            + Nuova distinta
          </Link>
        ) : null}
      </header>
      <section className="rounded-xl border border-[var(--border)] bg-white p-4">
        {error ? (
          <p role="status" className="py-4 text-sm text-[var(--text-secondary)]">Archivio temporaneamente non disponibile. Riprova più tardi.</p>
        ) : !data?.length ? (
          <p className="py-5 text-sm text-[var(--text-secondary)]">
            {page > 1 ? "Nessuna distinta in questa pagina: torna alla pagina precedente." : "Nessuna distinta salvata ancora visibile."}
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {data.map((draft) => (
              <Link key={draft.id} href={appRoutes.rfqHub.savedDistinta(draft.id)}
                className="flex min-h-16 items-center justify-between gap-3 py-2.5 focus-visible:outline-[var(--brand-primary)]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--brand-deep)]">{draft.title || "Distinta"}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{draft.line_count} righe · {formatTonnes(draft.total_tonnes)} t · {formatHubDate(draft.created_at)}</p>
                </div>
                <span aria-hidden="true" className="text-[var(--brand-primary)]">→</span>
              </Link>
            ))}
          </div>
        )}
        {!error ? (
          <nav aria-label="Pagine distinte salvate" className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
            <span className="text-xs text-[var(--text-secondary)]">Pagina {page} di {pages} · {count ?? "—"} distinte accessibili</span>
            <div className="flex items-center gap-2">
              {page > 1 ? <Link href={appRoutes.rfqHub.savedDistinte + "?page=" + (page - 1)} className="app-secondary inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-bold">← Precedente</Link> : null}
              {page < pages ? <Link href={appRoutes.rfqHub.savedDistinte + "?page=" + (page + 1)} className="app-secondary inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-bold">Successiva →</Link> : null}
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
