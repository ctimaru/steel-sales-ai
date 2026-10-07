"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  launchBuyerRfq,
  retryFailedBuyerRfq,
  sendBuyerRfqReminders,
} from "@/app/(workspace)/marketplace/rfq-hub/actions";

type SupplierState = {
  id: string;
  status: string;
  hasEmail: boolean;
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
    setFeedback(null);
    startLaunchTransition(async () => {
      const dueIso = deadline ? new Date(deadline).toISOString() : null;
      const result = await launchBuyerRfq({
        rfqId,
        dueAt: dueIso,
        buyerMessage: message,
      });

      if (!result.ok) {
        setFeedback(result.error ?? "Invio RFQ non riuscito.");
        return;
      }

      setFeedback(
        "RFQ avviata: " +
          String(result.sentCount ?? 0) +
          " invii effettuati" +
          ((result.failedCount ?? 0) > 0
            ? ", " + String(result.failedCount) + " falliti."
            : "."),
      );
      router.refresh();
    });
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
            RFQH3 · Governed Dispatch
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
            {isDraft ? "Invia la RFQ ai fornitori selezionati." : "Tracking inviti fornitori."}
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
              onChange={(event) => setDeadline(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
            />
          </label>

          <label className="text-xs font-semibold text-[#52615b]">
            Messaggio ai fornitori
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Es. Vi chiediamo la vostra migliore offerta e disponibilità."
              className="mt-1.5 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 py-2.5 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
            />
          </label>

          <button
            type="button"
            onClick={launch}
            disabled={launchPending || suppliers.length < 1 || missingEmail > 0}
            className="platform-primary inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {launchPending
              ? "Invio in corso…"
              : "Invia RFQ a " + String(suppliers.length) + " fornitori"}
          </button>
        </div>
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
