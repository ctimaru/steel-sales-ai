import Link from "next/link";

import { commercialDirectorAttentionCount } from "@/lib/commercial-director-priorities";
import type { CommercialView, UnifiedCommercialData } from "@/lib/commercial-unified-data";
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

  // Nessun avviso verificato = nessuno spazio occupato: la pagina resta sulle trattative.
  if (!canWrite || !procurementAvailable || (actionableRfqs.length === 0 && !(confirmedCount && confirmedCount > 0))) {
    return <h2 id="commercial-today-heading" className="sr-only">Cosa richiede attenzione: nessuna segnalazione da verificare</h2>;
  }

  return (
    <section id="commercial-today" aria-labelledby="commercial-today-heading"
      data-testid="commercial-compact-actions"
      className="scroll-mt-28 rounded-xl border border-[#e2c27a] bg-[#fff8e6] px-3 py-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1" data-testid="commercial-director-rfq-priorities">
        <h2 id="commercial-today-heading" className="shrink-0 text-xs font-bold text-[#6b4a07]">Da verificare</h2>
        <p className="min-w-0 text-xs text-[#5a4410]" data-testid="commercial-director-attention-summary">
          {confirmedCount === null
            ? "Controlla le segnalazioni disponibili nell’inbox."
            : `${confirmedCount} ${confirmedCount === 1 ? "elemento segnalato" : "elementi segnalati"} per una verifica.`}
        </p>
        {actionableRfqs.slice(0, 2).map(item => (
          <Link key={item.rfq_id} href={appRoutes.rfqHub.campaign(item.rfq_id)}
            className="inline-flex min-h-8 max-w-full items-center rounded-md bg-white px-2 text-[11px] font-semibold text-[#175640] ring-1 ring-[#e2c27a] hover:bg-[#fffdf5]">
            <span className="max-w-[13rem] truncate">{item.headline?.trim() || "Apri RFQ segnalata"}</span>
            <span aria-hidden="true" className="ml-1 shrink-0">→</span>
          </Link>
        ))}
        <Link href={appRoutes.rfqHub.inbox}
          className="inline-flex min-h-8 shrink-0 items-center text-[11px] font-semibold text-[#175640] hover:underline">
          Apri inbox →
        </Link>
      </div>
    </section>
  );
}
