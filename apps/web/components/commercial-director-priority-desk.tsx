import Link from "next/link";

import {
  commercialDirectorAttentionCount,
  commercialDirectorResumeLabel,
  selectCommercialDirectorResumeItem,
} from "@/lib/commercial-director-priorities";
import { commercialHref, type CommercialView, type UnifiedCommercialData } from "@/lib/commercial-unified-data";
import { appRoutes } from "@/lib/routes";

type ActionableRfq = { rfq_id: string; headline?: string };

export function CommercialDirectorPriorityDesk({
  canWrite, attentionTotal, actionableRfqs, procurementAvailable, data, view,
}: {
  canWrite: boolean;
  attentionTotal: unknown;
  actionableRfqs: ActionableRfq[];
  procurementAvailable: boolean;
  data: UnifiedCommercialData;
  view: CommercialView;
}) {
  const count = procurementAvailable && canWrite ? commercialDirectorAttentionCount(attentionTotal) : null;
  // A partial/inconsistent RPC response must never be displayed as a reliable
  // zero or authoritative count. The RFQ links themselves are RLS-scoped.
  const confirmedCount = count !== null && count >= actionableRfqs.length ? count : null;
  // No verified action should consume the same visual space as a real alert.
  const zeroAttention = confirmedCount === 0 && actionableRfqs.length === 0;
  const resume = selectCommercialDirectorResumeItem(data, view);
  const resumeHref = resume
    ? commercialHref("all", "", resume.key).replace("#commercial-worklist", "#commercial-detail")
    : null;

  return (
    <section id="commercial-today" aria-labelledby="commercial-today-heading"
      data-testid="commercial-compact-actions"
      className={"scroll-mt-28 rounded-xl border border-[#dce8df] bg-white px-3 " + (zeroAttention ? "py-1.5" : "py-2")}>
      <div className={"flex min-w-0 flex-col lg:flex-row lg:items-center lg:gap-3 " + (zeroAttention ? "gap-1" : "gap-2")}>
        <div className="flex min-w-0 items-center justify-between gap-3 lg:w-[175px] lg:shrink-0">
          <h2 id="commercial-today-heading" className="text-xs font-bold text-[#173f35]">
            Cosa richiede attenzione
          </h2>
          <p className="sr-only">Decisioni da verificare e attività da riprendere, senza automatismi.</p>
          <Link href="#commercial-worklist"
            className="inline-flex min-h-8 shrink-0 items-center text-[11px] font-semibold text-[#175640] hover:underline lg:hidden">
            Le mie trattative →
          </Link>
        </div>
        <div className={"grid min-w-0 flex-1 gap-x-3 sm:grid-cols-2 " + (zeroAttention ? "gap-y-1" : "gap-y-2")}
          data-testid="commercial-compact-attention">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
            data-testid="commercial-director-rfq-priorities">
            <p className={zeroAttention
              ? "sr-only"
              : "shrink-0 text-[10px] font-bold uppercase tracking-[0.05em] text-[#386c55]"}>
              RFQ · Da verificare
            </p>
            {!canWrite ? (
              <p className="min-w-0 text-xs text-[#52685b]">
                Consultazione in sola lettura. Le azioni richiedono un ruolo autorizzato.
              </p>
            ) : !procurementAvailable ? (
              <p role="status" className="min-w-0 text-xs text-[#52685b]">
                Segnalazioni RFQ non disponibili. Controlla direttamente l’inbox.
              </p>
            ) : (
              <>
                <p className={zeroAttention ? "sr-only" : "min-w-0 text-xs text-[#345447]"}
                  data-testid="commercial-director-attention-summary">
                  {confirmedCount === null
                    ? "Controlla le segnalazioni disponibili nell’inbox."
                    : confirmedCount === 0
                      ? "0 da verificare"
                      : `${confirmedCount} ${confirmedCount === 1 ? "elemento segnalato" : "elementi segnalati"} per una verifica.`}
                </p>
                {actionableRfqs.length > 0 ? (
                  <div className="flex min-w-0 flex-wrap gap-1">
                    {actionableRfqs.slice(0, 2).map(item => (
                      <Link key={item.rfq_id} href={appRoutes.rfqHub.campaign(item.rfq_id)}
                        className="inline-flex min-h-8 max-w-full items-center rounded-md bg-[#edf6f0] px-2 text-[11px] font-semibold text-[#175640] hover:bg-[#dceee3]">
                        <span className="max-w-[13rem] truncate">
                          {item.headline?.trim() || "Apri RFQ segnalata"}
                        </span>
                        <span aria-hidden="true" className="ml-1 shrink-0">→</span>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </>
            )}
            <Link href={appRoutes.rfqHub.inbox}
              className="inline-flex min-h-8 shrink-0 items-center text-[11px] font-semibold text-[#175640] hover:underline">
              Apri inbox →
            </Link>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:border-l sm:border-[#e1eae4] sm:pl-3"
            data-testid="commercial-director-resume">
            <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.05em] text-[#386c55]">
              Riprendi il lavoro
            </p>
            {resume && resumeHref ? (
              <>
                <Link href={resumeHref}
                  className="min-w-0 text-xs font-semibold text-[#175640] hover:underline"
                  title={resume.title}>
                  <span className="block max-w-[20rem] truncate">
                    {commercialDirectorResumeLabel(resume)} · {resume.title} →
                  </span>
                </Link>
                <p className="sr-only">Ultima attività acquisti disponibile, non classificata urgente.</p>
              </>
            ) : (
              <p className="min-w-0 text-xs text-[#52685b]">
                {view !== "all" ? "Apri la vista Tutte per riprendere un’attività recente." :
                  data.procurementUnavailable || data.truncated
                    ? "Vista incompleta: usa la ricerca o la lista delle trattative."
                    : "Nessuna attività acquisti recente disponibile in questa vista."}
              </p>
            )}
          </div>
        </div>
        <Link href="#commercial-worklist"
          className="hidden shrink-0 items-center text-xs font-semibold text-[#175640] hover:underline lg:inline-flex">
          Le mie trattative →
        </Link>
      </div>
    </section>
  );
}
