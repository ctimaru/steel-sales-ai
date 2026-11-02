"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import {
  applyNetworkSupplierHandoff,
  previewNetworkSupplierHandoff,
  type HandoffPreview,
} from "@/app/(workspace)/marketplace/rfq-hub/network-handoff-actions";
import {
  networkRfqHandoffKey,
  parseNetworkRfqHandoff,
  type NetworkRfqSupplierHandoff,
} from "@/lib/network-rfq-supplier-handoff";
import { appRoutes } from "@/lib/routes";

/** NET-AUDIT1.3b — shows the suppliers chosen in the Network and adds them to
 * an open RFQ (draft or ready) only after an explicit click. The handoff stays
 * available (max 15 min) until it is used or dismissed, so the buyer can first
 * create a distinta and come back. Nothing is launched or sent from here.
 */
const STATUS_LABEL: Record<string, string> = {
  available: "Contattabile", connected: "Connessa", pending: "Richiesta in corso",
  unavailable: "Non contattabile", not_found: "Non più disponibile",
};

export function RfqNetworkSupplierReceiver({ userId, organizationId }: { userId: string; organizationId: string }) {
  const [handoff, setHandoff] = useState<NetworkRfqSupplierHandoff | null>(null);
  const [preview, setPreview] = useState<HandoffPreview | null>(null);
  const [target, setTarget] = useState("");
  const [outcome, setOutcome] = useState<{ rfqId: string; added: number; failed: Array<{ id: string; error: string }> } | null>(null);
  const [issue, setIssue] = useState("");
  const [pending, startTransition] = useTransition();

  const key = (() => {
    try { return networkRfqHandoffKey(userId, organizationId); } catch { return null; }
  })();
  const clear = () => {
    try { if (key) window.sessionStorage.removeItem(key); } catch { /* storage unavailable */ }
    setHandoff(null); setPreview(null);
  };

  useEffect(() => {
    if (!key) return;
    let raw: string | null = null;
    try { raw = window.sessionStorage.getItem(key); } catch { return; }
    const parsed = parseNetworkRfqHandoff(raw);
    if (!parsed) {
      try { if (raw) window.sessionStorage.removeItem(key); } catch { /* ignore */ }
      return;
    }
    setHandoff(parsed);
    startTransition(async () => {
      const result = await previewNetworkSupplierHandoff(parsed.companyIds).catch(() => null);
      if (!result?.ok) { setIssue(result?.error || "Impossibile verificare i fornitori selezionati."); return; }
      setPreview(result);
      if (result.targets?.length === 1) setTarget(result.targets[0].id);
    });
  }, [key]);

  if (!handoff && !outcome) return null;
  const selectable = preview?.suppliers?.filter((supplier) => supplier.selectable) ?? [];

  const apply = () => {
    if (!handoff || !target || !selectable.length) return;
    setIssue("");
    startTransition(async () => {
      const result = await applyNetworkSupplierHandoff({ rfqId: target, companyIds: selectable.map((s) => s.id) })
        .catch(() => null);
      if (!result) { setIssue("Errore temporaneo. Riprova."); return; }
      if (result.error) { setIssue(result.error); return; }
      setOutcome({ rfqId: target, added: result.added.length, failed: result.failed });
      clear();
    });
  };

  return (
    <section id="network-suppliers" aria-labelledby="network-suppliers-title" data-testid="rfq-network-supplier-receiver"
      className="scroll-mt-28 rounded-xl border-2 border-[var(--brand-primary)] bg-white p-4">
      <h2 id="network-suppliers-title" className="text-base font-bold text-[var(--brand-deep)]">Fornitori selezionati nel Network</h2>
      {outcome ? (
        <div role="status" className="mt-2 space-y-2 text-sm">
          <p className="font-semibold text-[var(--brand-deep)]">
            {outcome.added} {outcome.added === 1 ? "fornitore aggiunto" : "fornitori aggiunti"} alla RFQ. Nessun invio è partito.
          </p>
          {outcome.failed.length ? (
            <ul className="list-disc pl-5 text-xs text-amber-900">
              {outcome.failed.map((item) => <li key={item.id}>{item.error}</li>)}
            </ul>
          ) : null}
          <Link href={appRoutes.rfqHub.campaign(outcome.rfqId)}
            className="platform-primary inline-flex min-h-10 items-center rounded-lg px-4 text-xs font-bold">
            Apri la RFQ e rivedi i destinatari →
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            {handoff?.specSummary ? "Dalla ricerca «" + handoff.specSummary + "». " : ""}
            Verifichiamo di nuovo ogni azienda prima di aggiungerla. Potrai rivedere distinta e destinatari prima dell&apos;invio.
          </p>
          {pending && !preview ? <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">Verifica in corso…</p> : null}
          {preview?.suppliers ? (
            <ul className="mt-3 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
              {preview.suppliers.map((supplier) => (
                <li key={supplier.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className={"truncate " + (supplier.selectable ? "font-semibold text-[var(--brand-deep)]" : "text-[var(--text-secondary)] line-through")}>
                    {supplier.name ?? "Azienda non disponibile"}
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--text-secondary)]">{STATUS_LABEL[supplier.status] ?? supplier.status}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {preview && !preview.canWrite ? (
            <p className="mt-3 text-xs text-[var(--text-secondary)]">Il tuo ruolo consente solo la consultazione delle RFQ.</p>
          ) : preview ? (
            preview.targets?.length ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                  RFQ di destinazione (bozza o pronta)
                  <select value={target} onChange={(event) => setTarget(event.target.value)}
                    className="h-10 rounded-lg border border-[var(--border-strong)] bg-white px-2 text-sm text-[var(--brand-deep)]">
                    <option value="">Scegli una RFQ…</option>
                    {preview.targets.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </label>
                <button type="button" onClick={apply} disabled={pending || !target || !selectable.length}
                  className="platform-primary inline-flex min-h-10 items-center rounded-lg px-4 text-xs font-bold disabled:opacity-50">
                  Aggiungi {selectable.length} {selectable.length === 1 ? "fornitore" : "fornitori"}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[var(--text-secondary)]">
                Non hai RFQ in bozza. <Link href={appRoutes.rfqHub.createDistinta} className="font-bold text-[var(--brand-deep)] underline">Crea una distinta</Link>,
                avvia la RFQ e torna qui entro 15 minuti: la selezione resta disponibile.
              </p>
            )
          ) : null}
          {issue ? <p role="alert" className="mt-2 text-xs text-amber-900">{issue}</p> : null}
          <button type="button" onClick={clear} className="mt-3 text-xs font-semibold text-[var(--text-secondary)] underline">
            Annulla selezione
          </button>
        </>
      )}
    </section>
  );
}
