import Link from "next/link";
import { notFound } from "next/navigation";

import { RfqHubCreateFromSnapshot } from "@/components/rfq-hub-create-from-snapshot";
import { canWriteWorkspace } from "@/lib/access-policy";
import { formatBuyerDocumentRequirements, normalizeBuyerDocumentRequirements } from "@/lib/buyer-distinta-documents";
import { appRoutes } from "@/lib/routes";
import { formatHubDate } from "@/lib/rfq-hub-overview";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Distinta salvata · RFQ Hub", robots: privateNoIndexRobots };

function formatNumber(value: number | null | undefined, digits = 2) {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" :
    value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default async function SavedBuyerDistintaPage({
  params,
}: { params: Promise<{ distintaId: string }> }) {
  const { distintaId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(distintaId)) notFound();

  const context = await getWorkspaceContext();
  const supabase = await createClient();
  // Critical: both current org and existing Supabase RLS must authorize reads.
  const { data: snapshot, error } = await supabase.from("buyer_distintas")
    .select("id,title,line_count,total_meters,total_tonnes,target_total_eur,created_at,owner_user_id,document_requirements")
    .eq("id", distintaId).eq("organization_id", context.organizationId).maybeSingle();
  if (error || !snapshot) notFound();

  const [{ data: lines, error: lineError }, { data: relatedCampaigns, error: campaignError }] = await Promise.all([
    supabase.from("buyer_distinta_lines")
      .select("id,line_position,description,standard_code,grade_code,finish_code,quantity_mode,quantity,bar_length_m,weight_kg_m,line_meters,line_tonnes,target_eur_t,note")
      .eq("distinta_id", snapshot.id).order("line_position", { ascending: true }).limit(500),
    supabase.from("buyer_rfq_campaigns")
      .select("id,title,status,created_at")
      .eq("source_distinta_id", snapshot.id).eq("organization_id", context.organizationId)
      .order("created_at", { ascending: false }).limit(15),
  ]);

  const documents = formatBuyerDocumentRequirements(normalizeBuyerDocumentRequirements(snapshot.document_requirements));
  const canCreateRfq = canWriteWorkspace(context.role) && snapshot.owner_user_id === context.userId &&
    !campaignError && (relatedCampaigns?.length ?? 0) === 0;

  return (
    <div className="space-y-4 pb-10">
      <nav aria-label="Percorso RFQ Hub" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
        <Link href={appRoutes.rfqHub.home} className="hover:underline">RFQ Hub</Link>
        <span aria-hidden="true">/</span><span>Distinte</span><span aria-hidden="true">/</span>
        <span className="text-[var(--brand-deep)]">Snapshot salvato</span>
      </nav>
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-white p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-primary)]">Archivio RFQ Hub · snapshot in sola lettura</p>
          <h1 className="mt-1 break-words text-xl font-extrabold text-[var(--brand-deep)]">{snapshot.title || "Distinta"}</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Salvata {formatHubDate(snapshot.created_at)} · {snapshot.line_count} righe · {formatNumber(Number(snapshot.total_tonnes), 3)} t</p>
        </div>
        {canCreateRfq ? <RfqHubCreateFromSnapshot distintaId={snapshot.id} /> :
          <Link href={appRoutes.rfqHub.home} className="app-secondary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Torna alle RFQ</Link>}
      </header>

      {relatedCampaigns?.length ? (
        <section className="rounded-xl border border-[var(--border)] bg-white p-4">
          <h2 className="text-sm font-bold text-[var(--brand-deep)]">Campagne RFQ collegate</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {relatedCampaigns.map((rfq) => (
              <Link key={rfq.id} href={appRoutes.rfqHub.campaign(rfq.id)}
                className="inline-flex min-h-11 items-center rounded-lg bg-[var(--brand-primary-soft)] px-3 text-xs font-bold text-[var(--brand-deep)]">
                {rfq.title} → 
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {documents ? (
        <section className="rounded-xl border border-[var(--border)] bg-white p-4">
          <h2 className="text-sm font-bold text-[var(--brand-deep)]">Documentazione generale della distinta</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{documents}</p>
        </section>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[var(--brand-deep)]">Articoli salvati</h2>
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Totale {formatNumber(Number(snapshot.total_meters))} m · {formatNumber(Number(snapshot.total_tonnes), 3)} t</span>
        </div>
        {lineError ? (
          <p role="status" className="text-sm text-[var(--text-secondary)]">Impossibile leggere le righe salvate. Riprova più tardi.</p>
        ) : !lines?.length ? (
          <p className="text-sm text-[var(--text-secondary)]">Le righe non sono disponibili.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {lines.map((line) => (
              <div key={line.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--brand-deep)]">{line.line_position}. {line.description}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {[line.standard_code, line.grade_code, line.finish_code].filter(Boolean).join(" · ")}
                    {" · "}{formatNumber(Number(line.weight_kg_m), 3)} kg/m
                    {line.note ? " · Nota: " + line.note : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-[var(--brand-deep)] sm:justify-end">
                  <span>{formatNumber(Number(line.quantity))} {line.quantity_mode === "bars" ? "barre" : line.quantity_mode === "meters" ? "m" : "t"}</span>
                  {line.quantity_mode === "bars" ? <span>Barra {formatNumber(Number(line.bar_length_m))} m</span> : null}
                  <span>{formatNumber(Number(line.line_tonnes), 3)} t</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="text-xs leading-5 text-[var(--text-secondary)]">
        Lo snapshot è immutabile: per una nuova richiesta utilizza
        {" "}<Link href={appRoutes.rfqHub.createDistinta} className="font-bold underline">Nuova distinta</Link>.
        Le campagne RFQ e gli eventuali ordini sono gestiti nelle rispettive sezioni private.
      </p>
    </div>
  );
}
