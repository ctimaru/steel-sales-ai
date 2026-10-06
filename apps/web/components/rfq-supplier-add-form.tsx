"use client";

import { useState, useTransition } from "react";

import { addSupplierToBuyerRfq } from "@/app/(workspace)/marketplace/rfq-hub/actions";

export function RfqSupplierAddForm({ rfqId }: { rfqId: string }) {
  const [supplierName, setSupplierName] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await addSupplierToBuyerRfq({
        rfqId,
        supplierName,
        supplierEmail,
      });
      if (!result.ok) {
        setMessage(result.error ?? "Aggiunta non riuscita.");
        return;
      }
      setSupplierName("");
      setSupplierEmail("");
      setMessage("Fornitore aggiunto.");
    });
  }

  return (
    <div className="rounded-2xl border border-[#dce2df] bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
        Aggiungi fornitore
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end">
        <label className="text-xs font-semibold text-[#52615b]">
          Nome fornitore
          <input
            value={supplierName}
            onChange={(event) => setSupplierName(event.target.value)}
            placeholder="Es. Acciai Rossi"
            className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
          />
        </label>
        <label className="text-xs font-semibold text-[#52615b]">
          Email *
          <input
            type="email"
            value={supplierEmail}
            onChange={(event) => setSupplierEmail(event.target.value)}
            placeholder="offerte@fornitore.it"
            className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !supplierEmail.trim()}
          className="platform-primary inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Aggiunta…" : "Aggiungi"}
        </button>
      </div>
      {message ? (
        <p className="mt-3 text-xs font-semibold text-[#52615b]">{message}</p>
      ) : null}
      <p className="mt-3 text-[11px] leading-5 text-[#718078]">
        In RFQH1 il targeting parte dall&apos;email. Nel prossimo blocco collegheremo direttamente anche aziende e contatti del Network.
      </p>
    </div>
  );
}
