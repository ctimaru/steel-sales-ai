"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  sendSupplierNegotiationMessage,
  startSupplierQuoteRevision,
} from "@/app/(public)/rfq/respond/[token]/actions";

type NegotiationTarget = {
  line_id: string;
  position: number;
  description: string;
  basis: "eur_t" | "eur_m";
  value: number | string;
  eur_t: number | string;
  eur_m: number | string;
};

type NegotiationMessage = {
  id: string;
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
  created_at: string;
  counter_targets: NegotiationTarget[];
};

export type SupplierNegotiationPayload = {
  valid?: boolean;
  exists?: boolean;
  thread_id?: string | null;
  status?: string;
  active_request_type?: "clarification" | "revision" | "counter_target" | "bafo" | null;
  request_due_at?: string | null;
  round_no?: number;
  reminder_count?: number;
  can_message?: boolean;
  messages?: NegotiationMessage[];
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatNumber(value: number | string, digits: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function requestLabel(value: SupplierNegotiationPayload["active_request_type"]) {
  if (value === "clarification") return "Chiarimento richiesto";
  if (value === "revision") return "Revisione richiesta";
  if (value === "counter_target") return "Counter target condiviso";
  if (value === "bafo") return "Best & Final Offer richiesta";
  return null;
}

export function RfqSupplierNegotiation({
  token,
  negotiation,
  quoteStatus,
}: {
  token: string;
  negotiation: SupplierNegotiationPayload | null;
  quoteStatus: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const messages = negotiation?.messages ?? [];
  const activeLabel = requestLabel(negotiation?.active_request_type ?? null);
  const canMessage = negotiation?.can_message !== false;

  function sendMessage() {
    setFeedback(null);
    startTransition(async () => {
      const result = await sendSupplierNegotiationMessage(token, message);
      if (!result.ok) {
        setFeedback(result.error ?? "Invio non riuscito.");
        return;
      }
      setMessage("");
      setFeedback("Messaggio inviato al buyer.");
      router.refresh();
    });
  }

  function openRevision() {
    setFeedback(null);
    startTransition(async () => {
      const result = await startSupplierQuoteRevision(token);
      if (!result.ok) {
        setFeedback(result.error ?? "Non è stato possibile aprire la revisione.");
        return;
      }
      setFeedback("Nuova revisione aperta. Aggiorna l'offerta qui sotto.");
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-[#cddbd6] bg-white">
      <div className="border-b border-[#e5ebe8] bg-[#f8faf9] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              RFQH6 · Trattativa privata
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
              Chiarimenti e negoziazione
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66736e]">
              Questo thread è visibile solo a te e al buyer che ha inviato la RFQ.
            </p>
          </div>
          <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#173f35]">
            {negotiation?.status ?? "open"}
          </span>
        </div>
      </div>

      {activeLabel ? (
        <div className="border-b border-[#eadfbe] bg-[#fffaf1] px-5 py-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#7b5e2b]">
            {activeLabel}
          </p>
          {negotiation?.request_due_at ? (
            <p className="mt-1 text-sm font-semibold text-[#5f4a25]">
              Risposta entro {formatDateTime(negotiation.request_due_at)}
            </p>
          ) : null}
          {["revision", "counter_target", "bafo"].includes(
            negotiation?.active_request_type ?? "",
          ) ? (
            <div className="mt-3">
              {quoteStatus === "submitted" ? (
                <button
                  type="button"
                  onClick={openRevision}
                  disabled={pending}
                  className="inline-flex min-h-10 items-center rounded-xl bg-[#173f35] px-4 text-xs font-bold text-white disabled:opacity-50"
                >
                  {pending ? "Apertura…" : negotiation?.active_request_type === "bafo" ? "Apri revisione BAFO" : "Apri revisione offerta"}
                </button>
              ) : quoteStatus === "draft" ? (
                <p className="text-xs font-semibold text-[#6d5d2f]">
                  La revisione è già aperta: aggiorna e invia l&apos;offerta nel modulo sotto.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : negotiation?.status === "bafo_received" ? (
        <div className="border-b border-[#cfe1da] bg-[#edf5f2] px-5 py-4 text-sm font-semibold text-[#173f35]">
          Best &amp; Final Offer ricevuta dal buyer. Il thread resta aperto per eventuali chiarimenti.
        </div>
      ) : null}

      <div className="space-y-3 px-4 py-5 sm:px-6">
        {messages.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#d6dedb] px-4 py-5 text-sm text-[#66736e]">
            Nessun messaggio nella trattativa. Puoi scrivere al buyer per chiedere un chiarimento.
          </p>
        ) : (
          messages.map((item) => (
            <article
              key={item.id}
              className={
                "max-w-3xl rounded-2xl border p-4 " +
                (item.sender_role === "buyer"
                  ? "border-[#cfe1da] bg-[#f3f8f6]"
                  : item.sender_role === "supplier"
                    ? "ml-auto border-[#dce2df] bg-white"
                    : "mx-auto border-[#e8e3d6] bg-[#fffaf1]")
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#66736e]">
                  {item.sender_role === "buyer"
                    ? "Buyer"
                    : item.sender_role === "supplier"
                      ? "Tu"
                      : "Sistema"}
                  {" · "}
                  {item.message_type.replaceAll("_", " ")}
                </p>
                <span className="text-[10px] text-[#87908c]">
                  {formatDateTime(item.created_at)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#35423d]">
                {item.body}
              </p>

              {item.counter_targets.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {item.counter_targets.map((target) => (
                    <div
                      key={target.line_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#cfe1da] bg-white px-3 py-2"
                    >
                      <div>
                        <p className="text-[10px] font-bold text-[#1a5144]">
                          Riga {target.position}
                        </p>
                        <p className="text-xs text-[#52615b]">{target.description}</p>
                      </div>
                      <div className="text-right text-xs font-semibold text-[#173f35]">
                        <p>€ {formatNumber(target.eur_t, 2)}/t</p>
                        <p>€ {formatNumber(target.eur_m, 4)}/m</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>

      {canMessage ? (
        <div className="border-t border-[#e5ebe8] bg-[#fbfcfb] px-5 py-5 sm:px-6">
          <label className="text-xs font-semibold text-[#52615b]">
            Scrivi al buyer
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={4000}
              rows={3}
              placeholder="Chiedi un chiarimento o rispondi alla richiesta del buyer…"
              className="mt-2 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 py-2.5 text-sm text-[#1d2824]"
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={sendMessage}
              disabled={pending || !message.trim()}
              className="inline-flex min-h-10 items-center rounded-xl bg-[#173f35] px-4 text-xs font-bold text-white disabled:opacity-50"
            >
              {pending ? "Invio…" : "Invia messaggio"}
            </button>
            {feedback ? (
              <span className="text-xs font-semibold text-[#66736e]">{feedback}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
