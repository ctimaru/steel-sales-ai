"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import {
  launchBuyerRfq,
  retryFailedBuyerRfq,
  sendBuyerRfqReminders,
} from "@/app/(workspace)/marketplace/rfq-hub/actions";

type SupplierState = {
  id: string;
  status: string;
  hasEmail: boolean;
  name: string | null;
  email: string | null;
  deliveryChannel: string | null;
};

export function RfqDispatchPanel({
  rfqId,
  campaignStatus,
  dueAt,
  buyerMessage,
  suppliers,
  canExecute = true,
}: {
  rfqId: string;
  campaignStatus: string;
  dueAt: string | null;
  buyerMessage: string | null;
  suppliers: SupplierState[];
  canExecute?: boolean;
}) {
  const router = useRouter();
  const [deadline, setDeadline] = useState(
    dueAt ? new Date(dueAt).toISOString().slice(0, 16) : "",
  );
  const [message, setMessage] = useState(buyerMessage ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const launchLock = useRef(false);
  const [launchPending, startLaunchTransition] = useTransition();
  const [retryPending, startRetryTransition] = useTransition();
  const [reminderPending, startReminderTransition] = useTransition();

  const isDraft = campaignStatus === "draft" || campaignStatus === "ready";
  const missingEmail = suppliers.filter((supplier) => !supplier.hasEmail).length;
  const failed = suppliers.filter((supplier) => supplier.status === "failed").length;
  const reminderCandidates = suppliers.filter((supplier) =>
    ["sent", "delivered", "opened"].includes(supplier.status),
  ).length;

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    suppliers.forEach((supplier) => {
      counts.set(supplier.status, (counts.get(supplier.status) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [suppliers]);

  function launch() {
    if (!confirmOpen || !confirmChecked || !isDraft || !canExecute ||
        suppliers.length < 1 || missingEmail > 0 || launchLock.current) return;
    launchLock.current = true;
    setFeedback(null);
    startLaunchTransition(async () => {
      try {
        const dueIso = deadline ? new Date(deadline).toISOString() : null;
        const result = await launchBuyerRfq({
          rfqId,
          dueAt: dueIso,
          buyerMessage: message,
          expectedSupplierIds: suppliers.map(supplier => supplier.id),
        });
        if (!result.ok) {
          setConfirmOpen(false);
          setConfirmChecked(false);
          setFeedback(result.error ?? "Invio RFQ non riuscito. Controlla i destinatari e riprova.");
          return;
        }
        setConfirmOpen(false);
        setConfirmChecked(false);
        setFeedback(
          "RFQ avviata: " + String(result.sentCount ?? 0) + " invii effettuati" +
          ((result.failedCount ?? 0) > 0 ? ", " + String(result.failedCount) + " falliti." : "."),
        );
        router.refresh();
      } catch {
        setConfirmOpen(false);
        setConfirmChecked(false);
        setFeedback("Impossibile verificare l'esito dell'invio. Controlla lo stato della RFQ prima di riprovare.");
        router.refresh();
      } finally {
        launchLock.current = false;
      }
    });
  }

  function reviewRecipients() {
    if (!isDraft || !canExecute || launchPending || suppliers.length < 1 || missingEmail > 0) return;
    setConfirmChecked(false);
    setConfirmOpen(true);
    setFeedback(null);
  }

  function retry() {
    setFeedback(null);
    startRetryTransition(async () => {
      const result = await retryFailedBuyerRfq(rfqId);
      if (!result.ok) {
        setFeedback(result.error ?? "Retry non riuscito.");
        return;
      }
      setFeedback(
        "Retry completato: " +
          String(result.sentCount ?? 0) +
          " inviati, " +
          String(result.failedCount ?? 0) +
          " ancora falliti.",
      );
      router.refresh();
    });
  }

  function remind() {
    setFeedback(null);
    startReminderTransition(async () => {
      const result = await sendBuyerRfqReminders(rfqId);
      if (!result.ok) {
        setFeedback(result.error ?? "Promemoria non riuscito.");
        return;
      }

      setFeedback(
        "Promemoria: " +
          String(result.sentCount ?? 0) +
          " inviati, " +
          String(result.skippedCount ?? 0) +
          " non ancora eleggibili" +
          ((result.failedCount ?? 0) > 0
            ? ", " + String(result.failedCount) + " falliti."
            : "."),
      );
      router.refresh();
    });
  }

  return (
    <section className="rounded-3xl border border-[#b8d2c8] bg-[#f5faf8] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            {isDraft ? "2 · Verifica e invia" : "Tracciamento inviti"}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
            {isDraft ? "Invia la richiesta ai fornitori scelti" : "Tracking inviti fornitori."}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Ogni fornitore riceve un&apos;email separata con link personale. Gli altri destinatari non sono visibili.
            Il Target €/t e il Target €/m restano dati interni del buyer e non vengono inviati.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {statusCounts.map(([status, count]) => (
            <span
              key={status}
              className="rounded-full border border-[#d5dfdb] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#52615b]"
            >
              {status} · {count}
            </span>
          ))}
        </div>
      </div>

      {isDraft && canExecute ? (
        <div className="mt-5 grid gap-4 border-t border-[#dce7e2] pt-5 lg:grid-cols-[260px_1fr_auto] lg:items-end">
          <label className="text-xs font-semibold text-[#52615b]">
            Scadenza offerta
            <input
              type="datetime-local"
              value={deadline}
              onChange={(event) => { setDeadline(event.target.value); setConfirmOpen(false); setConfirmChecked(false); }}
              className="mt-1.5 h-11 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
            />
          </label>

          <label className="text-xs font-semibold text-[#52615b]">
            Messaggio ai fornitori
            <textarea
              value={message}
              onChange={(event) => { setMessage(event.target.value); setConfirmOpen(false); setConfirmChecked(false); }}
              rows={3}
              maxLength={4000}
              placeholder="Es. Vi chiediamo la vostra migliore offerta e disponibilità."
              className="mt-1.5 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 py-2.5 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
            />
          </label>

          <button
            type="button"
            onClick={reviewRecipients}
            disabled={launchPending || suppliers.length < 1 || missingEmail > 0}
            className="platform-primary inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {launchPending
              ? "Invio in corso…"
              : "Controlla " + String(suppliers.length) + " destinatari →"}
          </button>
        </div>
      ) : null}

      {isDraft && canExecute && confirmOpen ? (
        <div role="region" aria-label="Conferma finale invio RFQ"
          className="mt-4 rounded-2xl border-2 border-[#174b3d] bg-white p-4 sm:p-5">
          <h3 className="text-base font-extrabold text-[#173f35]">Conferma l&apos;invio a {suppliers.length} fornitori</h3>
          <p className="mt-1 text-xs leading-5 text-[#52615b]">
            Partiranno email separate, una per indirizzo, con il link personale alla richiesta.
            Il Marketplace non verrà pubblicato e i prezzi target interni non saranno condivisi.
          </p>
          <ul className="mt-3 max-h-60 space-y-2 overflow-y-auto rounded-xl border border-[#e1e8e4] bg-[#f9fbfa] p-3">
            {suppliers.map((supplier, index) => (
              <li key={supplier.id} className="flex min-w-0 flex-col gap-1 border-b border-[#e4eae6] pb-2 text-xs last:border-0 last:pb-0 sm:flex-row sm:justify-between">
                <span className="font-bold text-[#173f35]">{index + 1}. {supplier.name || "Fornitore"}</span>
                <span className="break-all text-[#52615b]">{supplier.email || "Email mancante"}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 text-xs leading-5 text-[#52615b]">
            <p><strong>Canale effettivo:</strong> email individuali, non messaggio interno alla piattaforma.</p>
            <p><strong>Scadenza offerta:</strong> {deadline ? new Date(deadline).toLocaleString("it-IT") : "non specificata"}</p>
            <p><strong>Messaggio:</strong> {message.trim() || "Nessun messaggio aggiuntivo"}</p>
          </div>
          <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-2 rounded-lg bg-[#f0f8f3] p-3 text-xs font-semibold text-[#173f35]">
            <input type="checkbox" checked={confirmChecked} onChange={(event) => setConfirmChecked(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#174b3d]" />
            Ho verificato destinatari e indirizzi. Confermo l&apos;invio reale delle email.
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={launch} disabled={!confirmChecked || launchPending || missingEmail > 0}
              className="platform-primary min-h-11 rounded-xl px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">
              {launchPending ? "Invio in corso…" : "Conferma e invia a " + suppliers.length + " fornitori"}
            </button>
            <button type="button" onClick={() => { setConfirmOpen(false); setConfirmChecked(false); }}
              disabled={launchPending} className="min-h-11 rounded-xl border border-[#c3d5cb] bg-white px-4 text-sm font-semibold text-[#174b3d] disabled:opacity-50">
              Annulla, modifica la RFQ
            </button>
          </div>
        </div>
      ) : null}

      {isDraft && canExecute && suppliers.length === 0 ? (
        <p role="status" className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#47675c]">
          Seleziona almeno un fornitore qui sopra prima dell&apos;invio. Nessuna email parte finché non premi «Invia RFQ».
        </p>
      ) : null}

      {missingEmail > 0 && isDraft && canExecute ? (
        <p className="mt-3 rounded-xl border border-[#ead9c0] bg-[#fffaf1] px-4 py-3 text-xs font-semibold text-[#7b5e2b]">
          {missingEmail} fornitore/i non hanno ancora un indirizzo email utilizzabile. RFQH3 blocca il launch finché tutti i destinatari non sono inviabili.
        </p>
      ) : null}

      {!isDraft && canExecute ? (
        <div className="mt-5 flex flex-wrap gap-3 border-t border-[#dce7e2] pt-5">
          {failed > 0 ? (
            <button
              type="button"
              onClick={retry}
              disabled={retryPending}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#b8d2c8] bg-white px-5 text-sm font-bold text-[#173f35] disabled:opacity-50"
            >
              {retryPending ? "Retry in corso…" : "Riprova " + String(failed) + " invii falliti"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={remind}
            disabled={reminderPending || reminderCandidates < 1}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#b8d2c8] bg-white px-5 text-sm font-bold text-[#173f35] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reminderPending
              ? "Promemoria in corso…"
              : "Invia promemoria governato"}
          </button>

          <p className="w-full text-xs leading-5 text-[#718078]">
            I promemoria partono solo dopo 24 ore dall&apos;invio precedente, massimo 2 per fornitore.
            Risposte, decline, bounce e complaint vengono esclusi automaticamente.
          </p>
        </div>
      ) : null}

      {!canExecute ? (
        <p className="mt-4 rounded-xl border border-[#dce2df] bg-white px-4 py-3 text-xs font-semibold text-[#66736e]">
          Modalità consultazione: launch, retry e reminder restano azioni dell&apos;owner RFQ.
        </p>
      ) : null}

      {feedback ? (
        <p className="mt-4 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-[#52615b]">
          {feedback}
        </p>
      ) : null}
    </section>
  );
}
