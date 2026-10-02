import Link from "next/link";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";

import {
  getPlatformKnowledgeQuality,
  getPlatformKnowledgeQueue,
} from "@/lib/platform-knowledge";
import {
  getPlatformAccessContext,
  requirePlatformPermission,
} from "@/lib/platform-admin";

const FILTERS = [
  ["all", "Tutti"],
  ["draft", "Bozze"],
  ["in_review", "In revisione"],
  ["changes_requested", "Da correggere"],
  ["approved", "Approvati"],
] as const;

function workflowBadge(status: string) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "in_review") return "bg-cyan-50 text-cyan-800";
  if (status === "changes_requested") return "bg-amber-50 text-amber-800";
  return "bg-[#eef5f6] text-[#1b4c5d]";
}

export default async function PlatformKnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; message?: string; error?: string }>;
}) {
  await requirePlatformPermission("knowledge.read_drafts");
  const access = await getPlatformAccessContext();
  const permissions = access?.permissions ?? [];
  const canEdit = permissions.includes("knowledge.edit");
  const canReview = permissions.includes("knowledge.review");
  const canPublish = permissions.includes("knowledge.publish");
  const canQuality = permissions.includes("knowledge.quality_audit");
  const params = await searchParams;
  const activeStatus =
    params.status &&
    ["draft", "in_review", "changes_requested", "approved"].includes(
      params.status,
    )
      ? params.status
      : null;

  const [queue, quality] = await Promise.all([
    getPlatformKnowledgeQueue(activeStatus),
    canQuality ? getPlatformKnowledgeQuality() : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="platform-surface rounded-3xl p-6 sm:p-8">
        <p className="platform-kicker">SA7 · Knowledge Operations</p>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#18263d] sm:text-4xl">
              Knowledge Operations
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66736e]">
              Governa bozze, fonti, quality review e pubblicazione del layer
              Knowledge. La copia pubblica resta separata dalla bozza editoriale
              fino a una pubblicazione esplicita.
            </p>
          </div>
          <Link
            href="/knowledge"
            className="platform-secondary inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
          >
            Apri Knowledge pubblico ↗
          </Link>
        </div>
      </section>

      {params.message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {params.message}
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
          {params.error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Totale editoriali", queue.total],
          ["Bozze", queue.draft],
          ["In revisione", queue.inReview],
          ["Approvati", queue.approved],
          ["Live pubblici", queue.published],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-[#dce2df] bg-white p-4"
          >
            <p className="text-2xl font-semibold text-[#1d2824]">
              {String(value)}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#8fa1a9]">
              {label}
            </p>
          </div>
        ))}
      </section>

      {quality ? (
        <section className="rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
                Quality gate
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
                Qualità editoriale e SEO
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66736e]">
                K8 continua a controllare la qualità della copia live; SA7 aggiunge
                readiness e stato del workflow sulle bozze.
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 text-center sm:min-w-[280px] sm:w-auto">
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xl font-semibold text-emerald-800">
                  {quality.workflow.ready_drafts}
                </p>
                <p className="text-[11px] font-semibold uppercase text-emerald-700">
                  Draft ready
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-xl font-semibold text-amber-900">
                  {quality.workflow.blocked_drafts}
                </p>
                <p className="text-[11px] font-semibold uppercase text-amber-800">
                  Draft blocked
                </p>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {quality.live_quality.map((row) => (
              <div
                key={row.content_type}
                className="rounded-xl border border-[#e6ecf4] bg-[#f8fafd] p-4"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                  {row.content_type}
                </p>
                <p className="mt-2 text-sm font-semibold text-[#34445c]">
                  {row.indexable_rows}/{row.total_rows} indexable
                </p>
                <p className="mt-1 text-xs text-[#7a899d]">
                  Fonti mancanti {row.missing_sources} · SEO {row.missing_seo} ·
                  stale {row.stale_rows} · struttura {row.structural_issues}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#dce2df] bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7a899d]">
          Autorità effettiva
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ["Edit", canEdit],
            ["Review", canReview],
            ["Publish", canPublish],
            ["Quality audit", canQuality],
          ].map(([label, enabled]) => (
            <span
              key={String(label)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-semibold",
                enabled
                  ? "bg-[#e1ece8] text-[#1a5144]"
                  : "bg-[#f1f4f8] text-[#87938e]",
              ].join(" ")}
            >
              {label}: {enabled ? "abilitato" : "no"}
            </span>
          ))}
        </div>
      </section>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtri Knowledge">
        {FILTERS.map(([value, label]) => {
          const selected = (activeStatus ?? "all") === value;
          return (
            <Link
              key={value}
              href={
                value === "all"
                  ? "/platform/knowledge"
                  : `/platform/knowledge?status=${value}`
              }
              className={[
                "shrink-0 rounded-full border px-4 py-2.5 text-xs font-semibold",
                selected
                  ? "platform-selected-solid"
                  : "border-[#d7dfdb] bg-white text-[#43524c] hover:border-[#b8d2c8] hover:bg-[#f0f4f2] hover:text-[#1a5144]",
              ].join(" ")}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {!canEdit && !canReview && !canPublish ? (
        <div className="rounded-2xl border border-[#d7dfdb] bg-[#f8fafd] p-4 text-sm text-[#66736e]">
          Accesso operativo in sola lettura: puoi ispezionare bozze e quality
          audit, ma non modificare, revisionare o pubblicare contenuti.
        </div>
      ) : null}

      <section className="space-y-3">
        {queue.items.length === 0 ? (
          <FirstUseEmptyState
            eyebrow={activeStatus ? "Filtro senza risultati" : "Coda editoriale"}
            title="Nessun contenuto in questa vista"
            description={
              activeStatus
                ? "Rimuovi il filtro per tornare all’intero workflow editoriale."
                : "Non ci sono bozze o contenuti editoriali da gestire in questo momento."
            }
            primaryAction={{
              href: "/platform/knowledge",
              label: activeStatus ? "Mostra tutti i contenuti" : "Aggiorna la coda",
            }}
            secondaryAction={{
              href: "/knowledge",
              label: "Apri Knowledge pubblico",
            }}
          />
        ) : (
          queue.items.map((item) => (
            <Link
              key={`${item.content_type}-${item.page_id}`}
              href={`/platform/knowledge/${item.content_type}/${item.page_id}`}
              className="block rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:border-[#b8d2c8] hover:shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#e1ece8] px-2.5 py-1 text-[11px] font-bold uppercase text-[#1a5144]">
                      {item.content_type}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${workflowBadge(
                        item.workflow_status,
                      )}`}
                    >
                      {item.workflow_status.replaceAll("_", " ")}
                    </span>
                    <span className="rounded-full bg-[#f1f4f8] px-2.5 py-1 text-[11px] font-bold text-[#66736e]">
                      live: {item.page_status}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-[#1d2824]">
                    {item.label}
                  </h2>
                  <p className="mt-1 text-sm text-[#66736e]">
                    {item.subtitle || item.slug}
                  </p>
                  {!item.ready ? (
                    <p className="mt-2 text-xs text-amber-800">
                      Blocker: {item.blockers.join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-xs text-[#87938e]">
                  <p>
                    Draft v{item.draft_version} · Live v{item.live_version}
                  </p>
                  <p className="mt-1 font-semibold text-[#43524c]">
                    Apri editoriale →
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
