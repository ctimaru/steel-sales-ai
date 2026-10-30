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
  const resume = selectCommercialDirectorResumeItem(data, view);
  const resumeHref = resume
    ? commercialHref("all", "", resume.key).replace("#commercial-worklist", "#commercial-detail")
    : null;

  return (
    <section id="commercial-today" aria-labelledby="commercial-today-heading"
      data-testid="commercial-compact-actions"
      className="scroll-mt-28 rounded-2xl border border-[#dce8df] bg-[#f8fbf9] px-3 py-2 sm:px-4 sm:py-1">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id="commercial-today-heading" className="text-sm font-semibold text-[#173f35]">
            Cosa richiede attenzione
          </h2>
          <p className="sr-only">Decisioni da verificare e attività da riprendere, senza automatismi.</p>
        </div>
        <Link href="#commercial-worklist" className="inline-flex min-h-9 items-center text-xs font-semibold text-[#175640] underline-offset-2 hover:underline sm:min-h-0">
          Le mie trattative →
        </Link>
      </div>
      <div className="grid min-w-0 gap-1.5 sm:grid-cols-2 sm:gap-1" data-testid="commercial-compact-attention">
        <div className="min-w-0 rounded-xl border border-[#d7e5dc] bg-white px-2.5 py-1.5 sm:py-1" data-testid="commercial-director-rfq-priorities">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#386c55]">RFQ · Da verificare</p>
            <Link href={appRoutes.rfqHub.inbox} className="inline-flex min-h-8 items-center text-xs font-semibold text-[#175640] hover:underline">
              Apri inbox →
            </Link>
          </div>
          {!canWrite ? (
            <p className="mt-0.5 text-xs leading-4 text-[#52685b]">Consultazione in sola lettura. Le azioni richiedono un ruolo autorizzato.</p>
          ) : !procurementAvailable ? (
            <p role="status" className="mt-0.5 text-xs leading-4 text-[#52685b]">Segnalazioni RFQ non disponibili. Controlla direttamente l’inbox.</p>
          ) : (
            <>
              <p className="mt-0.5 text-xs leading-4 text-[#345447]" data-testid="commercial-director-attention-summary">
                {confirmedCount === null
                  ? "Controlla le segnalazioni disponibili nell’inbox."
                  : confirmedCount === 0
                    ? "Nessuna RFQ segnalata per una verifica."
                    : `${confirmedCount} ${confirmedCount === 1 ? "elemento segnalato" : "elementi segnalati"} per una verifica.`}
              </p>
              {actionableRfqs.length > 0 ? (
                <div className="mt-0.5 flex min-w-0 flex-wrap gap-1">
                  {actionableRfqs.slice(0, 2).map(item => (
                    <Link key={item.rfq_id} href={appRoutes.rfqHub.campaign(item.rfq_id)}
                      className="inline-flex min-h-8 max-w-full items-center rounded-md border border-[#c9e0d2] bg-[#f4faf6] px-2 py-0.5 text-[11px] font-semibold text-[#175640] hover:border-[#8bb49b]">
                      <span className="max-w-[14rem] truncate">{item.headline?.trim() || "Apri RFQ segnalata"}</span>
                      <span aria-hidden="true" className="ml-1.5 shrink-0">→</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="min-w-0 rounded-xl border border-[#d7e5dc] bg-white px-2.5 py-1.5 sm:py-1" data-testid="commercial-director-resume">
          <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#386c55]">Riprendi il lavoro</p>
          {resume && resumeHref ? (
            <>
              <Link href={resumeHref}
                className="mt-0.5 block min-h-8 min-w-0 rounded-md py-0.5 text-xs font-semibold text-[#175640] hover:underline"
                title={resume.title}>
                <span className="block truncate">{commercialDirectorResumeLabel(resume)} · {resume.title} →</span>
              </Link>
              <p className="text-[10px] leading-3 text-[#61766a]">Ultima attività acquisti disponibile, non classificata urgente.</p>
            </>
          ) : (
            <p className="mt-0.5 text-xs leading-4 text-[#52685b]">
              {view !== "all" ? "Apri la vista Tutte per riprendere un’attività recente." :
                data.procurementUnavailable || data.truncated
                  ? "Vista incompleta: usa la ricerca o la lista delle trattative."
                  : "Nessuna attività acquisti recente disponibile in questa vista."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
