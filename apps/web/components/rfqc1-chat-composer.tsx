"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  postBuyerRfqNegotiation,
  type BuyerNegotiationMessageType,
  type BuyerNegotiationTargetInput,
} from "@/app/(workspace)/marketplace/rfq-hub/[rfqId]/negotiation-actions";

type Line = { id: string; position: number; description: string };

const choices: { value: BuyerNegotiationMessageType; label: string }[] = [
  { value: "message", label: "Messaggio" },
  { value: "clarification", label: "Chiarimento" },
  { value: "revision_request", label: "Richiesta revisione" },
  { value: "counter_target", label: "Counter target" },
  { value: "bafo_request", label: "Best & Final Offer (BAFO)" },
];

export function Rfqc1ChatComposer({
  rfqId, supplierId, supplierName, lines, disabled,
}: {
  rfqId: string;
  supplierId: string;
  supplierName: string;
  lines: readonly Line[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState<BuyerNegotiationMessageType>("message");
  const [message, setMessage] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [targets, setTargets] = useState<Record<string, { basis: "eur_t" | "eur_m"; value: string }>>({});
  const [confirm, setConfirm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sendLock = useRef(false);
  const hasTargets = type === "counter_target" || type === "bafo_request";
  const hasDue = type !== "message";

  const counterTargets: BuyerNegotiationTargetInput[] = hasTargets
    ? lines.flatMap(line => {
        const target = targets[line.id];
        return target?.value.trim()
          ? [{ lineId: line.id, basis: target.basis, value: target.value.trim() }]
          : [];
      })
    : [];

  const canConfirm = !disabled && !pending && !sendLock.current &&
    (message.trim().length > 0 || type !== "message") &&
    (type !== "bafo_request" || Boolean(dueAt)) &&
    (type !== "counter_target" || counterTargets.length > 0) &&
    counterTargets.every(item => Number(String(item.value).replace(",", ".")) > 0);

  function post() {
    if (!confirm || !canConfirm || sendLock.current) return;
    sendLock.current = true;
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await postBuyerRfqNegotiation({
          rfqId, supplierId, messageType: type, body: message,
          dueAt: hasDue && dueAt ? dueAt : null,
          counterTargets,
        });
        if (!result.ok) {
          setFeedback(result.error || "Non è stato possibile inviare il messaggio.");
        } else {
          setFeedback(result.warning || "Messaggio inviato e registrato nel filo.");
          setMessage("");
          setDueAt("");
          setTargets({});
          setType("message");
          router.refresh();
        }
      } catch {
        setFeedback("Errore di invio. Controlla la trattativa prima di riprovare.");
      } finally {
        sendLock.current = false;
        setConfirm(false);
      }
    });
  }

  return (
    <section aria-label={"Scrivi a " + supplierName} data-testid="rfqc1-composer" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={"rfqc1-type-" + supplierId} className="text-xs font-bold text-[#234938]">
          Scrivi a {supplierName}
        </label>
        <select id={"rfqc1-type-" + supplierId} value={type} disabled={disabled || pending}
          onChange={event => { setType(event.target.value as BuyerNegotiationMessageType); setFeedback(null); }}
          className="min-h-10 max-w-full rounded-lg border border-[#b9cec3] bg-white px-3 text-xs font-semibold text-[#244a3b]">
          {choices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <textarea aria-label="Messaggio al fornitore" rows={2} value={message}
        onChange={event => setMessage(event.target.value)}
        disabled={disabled || pending} maxLength={4000}
        placeholder={disabled ? "Conversazione in sola lettura" : "Scrivi un messaggio privato al fornitore selezionato…"}
        className="w-full resize-y rounded-xl border border-[#d5e0d8] bg-white p-3 text-sm text-[#243e32] placeholder:text-[#7a8980] focus:border-[#358264] focus:outline-none disabled:bg-[#f6f7f6]" />
      {hasDue && (
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#566a5e]">
          Scadenza {type === "bafo_request" ? "(obbligatoria)" : "(facoltativa)"}
          <input type="datetime-local" value={dueAt}
            disabled={disabled || pending} onChange={event => setDueAt(event.target.value)}
            className="min-h-10 w-full max-w-sm rounded-lg border border-[#cddbd2] px-3 text-sm text-[#284d3b]" />
        </label>
      )}
      {hasTargets && (
        <fieldset className="space-y-2 rounded-xl border border-[#d8e6dc] bg-[#f6faf7] p-3">
          <legend className="px-1 text-xs font-bold text-[#2a513e]">
            Counter target privati · solo per {supplierName}
          </legend>
          {lines.map(line => (
            <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_70px_110px] items-center gap-2">
              <span className="truncate text-xs text-[#365443]">{line.position}. {line.description}</span>
              <select aria-label={"Unità riga " + line.position}
                disabled={disabled || pending}
                value={targets[line.id]?.basis || "eur_t"}
                onChange={event => setTargets(current => ({ ...current, [line.id]: {
                  basis: event.target.value as "eur_t" | "eur_m", value: current[line.id]?.value || "",
                } }))}
                className="min-h-10 rounded-lg border border-[#cbdbd1] bg-white px-1 text-xs">
                <option value="eur_t">€/t</option><option value="eur_m">€/m</option>
              </select>
              <input aria-label={"Target riga " + line.position} type="text" inputMode="decimal"
                placeholder="—" disabled={disabled || pending}
                value={targets[line.id]?.value || ""}
                onChange={event => setTargets(current => ({ ...current, [line.id]: {
                  basis: current[line.id]?.basis || "eur_t", value: event.target.value,
                } }))}
                className="min-h-10 min-w-0 rounded-lg border border-[#cbdbd1] bg-white px-2 text-sm tabular-nums" />
            </div>
          ))}
        </fieldset>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-[#6f7b72]">Nessun invio automatico.</p>
        <button type="button" disabled={!canConfirm}
          onClick={() => setConfirm(true)}
          className="min-h-11 rounded-xl bg-[#174b3d] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#a5b6ae]">
          Verifica invio
        </button>
      </div>
      {feedback && <p role="status" className="rounded-lg bg-[#f1f7f3] p-2 text-xs text-[#285840]">{feedback}</p>}
      {confirm && (
        <div role="dialog" aria-modal="true" aria-labelledby="rfqc1-confirm-title"
          className="rounded-xl border-2 border-[#b3d0bd] bg-white p-4 shadow-lg">
          <h3 id="rfqc1-confirm-title" className="text-sm font-extrabold text-[#193f31]">Conferma l'invio privato</h3>
          <p className="mt-2 text-sm text-[#345744]">
            Il messaggio «{choices.find(option => option.value === type)?.label}» sarà inviato soltanto a <strong>{supplierName}</strong>.
          </p>
          {counterTargets.length > 0 && <p className="mt-2 text-xs font-semibold text-[#6b4a23]">
            {counterTargets.length} counter target · visibili esclusivamente a questo fornitore.
          </p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirm(false)} disabled={pending}
              className="min-h-10 rounded-lg border border-[#bdd0c5] px-3 text-xs font-semibold">Annulla</button>
            <button type="button" onClick={post} disabled={!canConfirm}
              className="min-h-10 rounded-lg bg-[#174b3d] px-4 text-xs font-bold text-white disabled:opacity-50">
              {pending ? "Invio…" : "Confermo e invio"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
