"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  postBuyerRfqNegotiation,
  sendBuyerNegotiationReminder,
  type BuyerNegotiationMessageType,
} from "@/app/(workspace)/marketplace/rfq-hub/[rfqId]/negotiation-actions";

type BuyerNegotiationTarget = {
  id: string;
  message_id: string;
  rfq_line_id: string;
  target_basis: "eur_t" | "eur_m";
  target_value: number | string;
  normalized_eur_t: number | string;
  normalized_eur_m: number | string;
};

type BuyerNegotiationMessage = {
  id: string;
  thread_id: string;
  sender_role: "buyer" | "supplier" | "system";
  message_type:
    | "message"
    | "clarification"
    | "revision_request"
    | "counter_target"
    | "bafo_request"
    | "reminder"
    | "system";
  round_no: number;
  body: string;
  request_due_at: string | null;
  notification_status: string;
  created_at: string;
  targets: BuyerNegotiationTarget[];
};

export type BuyerNegotiationThread = {
  id: string;
  supplier_id: string;
  status: string;
  active_request_type: "clarification" | "revision" | "counter_target" | "bafo" | null;
  request_due_at: string | null;
  round_no: number;
  reminder_count: number;
  last_message_at: string | null;
  messages: BuyerNegotiationMessage[];
};

type Supplier = {
  id: string;
  name: string | null;
  email: string | null;
  status: string;
};

type Line = {
  id: string;
  position: number;
  description: string;
  targetEurT: number | string | null;
  targetEurM: number | string | null;
};

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function number(value: number | string | null, digits: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return parsed.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function actionLabel(value: BuyerNegotiationMessageType) {
  if (value === "clarification") return "Richiedi chiarimento";
  if (value === "revision_request") return "Richiedi revisione";
  if (value === "counter_target") return "Invia counter target";
  if (value === "bafo_request") return "Richiedi BAFO";
  return "Invia messaggio";
}

function BuyerSupplierNegotiationCard({
  rfqId,
  supplier,
  lines,
  thread,
}: {
  rfqId: string;
  supplier: Supplier;
  lines: Line[];
  thread: BuyerNegotiationThread | null;
}) {
  const router = useRouter();
  const [messageType, setMessageType] =
    useState<BuyerNegotiationMessageType>("clarification");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [targetValues, setTargetValues] = useState<
    Record<string, { basis: "eur_t" | "eur_m"; value: string }>
  >({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showTargets =
    messageType === "counter_target" || messageType === "bafo_request";
  const showDue = messageType !== "message";

  function submit() {
    setFeedback(null);

    const targets = showTargets
      ? lines
          .map((line) => {
            const target = targetValues[line.id];
            if (!target?.value.trim()) return null;
            return {
              lineId: line.id,
              basis: target.basis,
              value: target.value.trim(),
            };
          })
          .filter(
            (
              target,
            ): target is {
              lineId: string;
              basis: "eur_t" | "eur_m";
              value: string;
            } => Boolean(target),
          )
      : [];

    const dueIso = dueAt ? new Date(dueAt).toISOString() : null;

    startTransition(async () => {
      const result = await postBuyerRfqNegotiation({
        rfqId,
        supplierId: supplier.id,
        messageType,
        body,
        dueAt: dueIso,
        counterTargets: targets,
      });

      if (!result.ok) {
        setFeedback(result.error ?? "Aggiornamento trattativa non riuscito.");
        return;
      }

      setBody("");
      setDueAt("");
      setTargetValues({});
      setFeedback(
        result.warning
          ? "Trattativa aggiornata. " + result.warning
          : "Trattativa aggiornata e notifica inviata.",
      );
      router.refresh();
    });
  }

  function reminder() {
    if (!thread) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await sendBuyerNegotiationReminder({
        rfqId,
        threadId: thread.id,
      });
      if (!result.ok) {
        setFeedback(result.error ?? "Promemoria non riuscito.");
        return;
      }
      setFeedback(
        result.warning
          ? "Promemoria registrato. " + result.warning
          : "Promemoria inviato.",
      );
      router.refresh();
    });
  }

  const requestPending =
    thread?.active_request_type &&
    ["awaiting_supplier", "bafo_requested"].includes(thread.status);

  return (
    <details className="rounded-2xl border border-[#dce2df] bg-white" open={Boolean(thread)}>
      <summary className="cursor-pointer list-none px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#1d2824]">
              {supplier.name || supplier.email || "Fornitore"}
            </p>
            <p className="mt-1 text-xs text-[#718078]">
              {supplier.email || "Canale piattaforma"} · {supplier.status}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {thread ? (
              <>
                <span className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-[10px] font-bold uppercase text-[#173f35]">
                  {thread.status.replaceAll("_", " ")}
                </span>
                <span className="rounded-full bg-[#f7f9f8] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]">
                  Round {thread.round_no}
                </span>
              </>
            ) : (
              <span className="rounded-full bg-[#f7f9f8] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]">
                Nessun thread
              </span>
            )}
          </div>
        </div>
      </summary>

      <div className="border-t border-[#edf0ee] px-4 py-4 sm:px-5">
        {requestPending ? (
          <div className="mb-4 rounded-xl border border-[#eadfbe] bg-[#fffaf1] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7b5e2b]">
              In attesa del fornitore · {thread?.active_request_type?.replaceAll("_", " ")}
            </p>
            {thread?.request_due_at ? (
              <p className="mt-1 text-xs font-semibold text-[#5f4a25]">
                Deadline {dateTime(thread.request_due_at)}
              </p>
            ) : null}
            <p className="mt-1 text-[10px] text-[#7b6b4b]">
              Promemoria {thread?.reminder_count ?? 0}/2
            </p>
          </div>
        ) : null}

        {thread?.messages.length ? (
          <div className="max-h-[380px] space-y-2 overflow-y-auto rounded-2xl bg-[#f8faf9] p-3">
            {thread.messages.map((message) => (
              <div
                key={message.id}
                className={
                  "rounded-xl border px-3 py-3 " +
                  (message.sender_role === "buyer"
                    ? "ml-6 border-[#cfe1da] bg-white"
                    : message.sender_role === "supplier"
                      ? "mr-6 border-[#dce2df] bg-[#f4f6f5]"
                      : "mx-8 border-[#e8e3d6] bg-[#fffaf1]")
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#718078]">
                    {message.sender_role === "buyer"
                      ? "Buyer"
                      : message.sender_role === "supplier"
                        ? "Supplier"
                        : "Sistema"}
                    {" · "}
                    {message.message_type.replaceAll("_", " ")}
                  </p>
                  <span className="text-[9px] text-[#87908c]">
                    {dateTime(message.created_at)}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-[#3e4b46]">
                  {message.body}
                </p>

                {message.targets.length > 0 ? (
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {message.targets.map((target) => {
                      const line = lines.find((item) => item.id === target.rfq_line_id);
                      return (
                        <div
                          key={target.id}
                          className="rounded-lg border border-[#cfe1da] bg-[#fbfdfc] px-2.5 py-2"
                        >
                          <p className="text-[9px] font-bold text-[#1a5144]">
                            Riga {line?.position ?? "—"} · {line?.description ?? "Articolo"}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-[#173f35]">
                            € {number(target.normalized_eur_t, 2)}/t · €{" "}
                            {number(target.normalized_eur_m, 4)}/m
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {message.sender_role === "buyer" ? (
                  <p className="mt-2 text-[9px] text-[#87908c]">
                    Notifica: {message.notification_status.replaceAll("_", " ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-[#d6dedb] px-4 py-4 text-xs text-[#718078]">
            Avvia un chiarimento o una negoziazione con questo fornitore.
          </p>
        )}

        <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr]">
          <label className="text-xs font-semibold text-[#52615b]">
            Azione
            <select
              value={messageType}
              onChange={(event) =>
                setMessageType(event.target.value as BuyerNegotiationMessageType)
              }
              className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-xs"
            >
              <option value="message">Messaggio</option>
              <option value="clarification">Chiarimento</option>
              <option value="revision_request">Richiedi revisione</option>
              <option value="counter_target">Counter target</option>
              <option value="bafo_request">Best &amp; Final Offer</option>
            </select>
          </label>

          <label className="text-xs font-semibold text-[#52615b]">
            Messaggio
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Scrivi il messaggio che vedrà solo questo fornitore…"
              className="mt-1.5 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 py-2.5 text-sm"
            />
          </label>
        </div>

        {showDue ? (
          <label className="mt-3 block max-w-xs text-xs font-semibold text-[#52615b]">
            Deadline risposta {messageType === "bafo_request" ? "· obbligatoria" : "· opzionale"}
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-xs"
            />
          </label>
        ) : null}

        {showTargets ? (
          <div className="mt-4 rounded-2xl border border-[#dce2df] bg-[#fbfcfb] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#1a5144]">
              Counter target da condividere
            </p>
            <p className="mt-1 text-[10px] leading-4 text-[#718078]">
              Compila solo le righe che vuoi negoziare. Questi valori saranno visibili al fornitore;
              il Target originario della distinta resta privato.
            </p>

            <div className="mt-3 space-y-2">
              {lines.map((line) => {
                const target = targetValues[line.id] ?? {
                  basis: "eur_t" as const,
                  value: "",
                };
                return (
                  <div
                    key={line.id}
                    className="grid gap-2 rounded-xl border border-[#e2e7e4] bg-white p-3 sm:grid-cols-[1fr_100px_150px]"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[#1d2824]">
                        Riga {line.position} · {line.description}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#87908c]">
                        Target interno: € {number(line.targetEurT, 2)}/t · €{" "}
                        {number(line.targetEurM, 4)}/m
                      </p>
                    </div>
                    <select
                      value={target.basis}
                      onChange={(event) =>
                        setTargetValues((current) => ({
                          ...current,
                          [line.id]: {
                            ...target,
                            basis: event.target.value as "eur_t" | "eur_m",
                          },
                        }))
                      }
                      className="h-9 rounded-lg border border-[#d9e0dd] bg-white px-2 text-xs"
                    >
                      <option value="eur_t">€/t</option>
                      <option value="eur_m">€/m</option>
                    </select>
                    <input
                      value={target.value}
                      onChange={(event) =>
                        setTargetValues((current) => ({
                          ...current,
                          [line.id]: { ...target, value: event.target.value },
                        }))
                      }
                      inputMode="decimal"
                      placeholder="Valore"
                      className="h-9 rounded-lg border border-[#d9e0dd] bg-white px-3 text-xs"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={pending || (messageType === "message" && !body.trim())}
            className="inline-flex min-h-10 items-center rounded-xl bg-[#173f35] px-4 text-xs font-bold text-white disabled:opacity-50"
          >
            {pending ? "Invio…" : actionLabel(messageType)}
          </button>

          {requestPending && (thread?.reminder_count ?? 0) < 2 ? (
            <button
              type="button"
              onClick={reminder}
              disabled={pending}
              className="inline-flex min-h-10 items-center rounded-xl border border-[#b8d2c8] bg-white px-4 text-xs font-bold text-[#173f35] disabled:opacity-50"
            >
              Invia promemoria
            </button>
          ) : null}

          {feedback ? (
            <span className="text-xs font-semibold text-[#66736e]">{feedback}</span>
          ) : null}
        </div>
      </div>
    </details>
  );
}

export function RfqBuyerNegotiationPanel({
  rfqId,
  suppliers,
  lines,
  threads,
}: {
  rfqId: string;
  suppliers: Supplier[];
  lines: Line[];
  threads: BuyerNegotiationThread[];
}) {
  const threadBySupplier = useMemo(
    () => new Map(threads.map((thread) => [thread.supplier_id, thread])),
    [threads],
  );

  const eligibleSuppliers = suppliers.filter(
    (supplier) =>
      !["declined", "cancelled", "bounced", "complained"].includes(supplier.status),
  );

  return (
    <section className="rounded-3xl border border-[#cddbd6] bg-[#f8faf9] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            RFQH6 · Clarifications, Revisions &amp; Negotiation
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
            Trattative private per fornitore
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
            Ogni thread è isolato. Puoi chiedere chiarimenti o revisioni, condividere un
            counter-target esplicito e richiedere una Best &amp; Final Offer con deadline.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#173f35]">
          {threads.length} thread attivi
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {eligibleSuppliers.map((supplier) => (
          <BuyerSupplierNegotiationCard
            key={supplier.id}
            rfqId={rfqId}
            supplier={supplier}
            lines={lines}
            thread={threadBySupplier.get(supplier.id) ?? null}
          />
        ))}
      </div>

      <p className="mt-4 text-[10px] leading-4 text-[#718078]">
        Counter-target e BAFO vengono condivisi solo con il singolo fornitore selezionato.
        Nessun messaggio o valore negoziale è visibile agli altri supplier invitati.
      </p>
    </section>
  );
}
