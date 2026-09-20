"use client";

import { useActionState, useId } from "react";
import { correctReviewItem, type ReviewActionState } from "@/app/(workspace)/review/actions";
import type { ReviewCorrectionValues } from "@/lib/commercial-data";

const initialState: ReviewActionState = { status: "idle", message: "" };

function value(v: unknown) {
  return v == null ? "" : String(v);
}

export function ReviewCorrectForm({
  id,
  reviewed,
  current,
}: {
  id: string;
  reviewed: boolean;
  current: ReviewCorrectionValues;
}) {
  const [state, action, pending] = useActionState(correctReviewItem, initialState);
  const messageId = useId();
  const saved = state.status === "success";
  const disabled = pending || reviewed;

  return (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 text-center text-xs font-semibold text-slate-600">
        {saved ? "Correzione applicata" : "Correggi"}
      </summary>
      <form action={action} className="space-y-2 border-t border-slate-100 p-3" aria-busy={pending}>
        <input type="hidden" name="id" value={id} />

        <div className="grid grid-cols-2 gap-2">
          <select name="item_role" defaultValue={value(current.item_role)} disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs">
            <option value="">Ruolo</option>
            <option value="requested">Richiesta</option>
            <option value="offered">Offerta</option>
            <option value="ordered">Ordine</option>
            <option value="delivered">Consegna</option>
          </select>
          <select name="product_type" defaultValue={value(current.product_type)} disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs">
            <option value="">Tipo prodotto</option>
            <option value="round_tube">Tondo</option>
            <option value="square_tube">Quadro</option>
            <option value="rectangular_tube">Rettangolare</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input name="grade" defaultValue={value(current.grade)} placeholder="Qualità" disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
          <input name="standard" defaultValue={value(current.standard)} placeholder="Norma" disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
        </div>

        <input name="material_number" defaultValue={value(current.material_number)} placeholder="Material number" disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />

        <div className="grid grid-cols-2 gap-2">
          <input name="outer_diameter_mm" inputMode="decimal" defaultValue={value(current.outer_diameter_mm)} placeholder="Ø mm" disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
          <input name="thickness_mm" inputMode="decimal" defaultValue={value(current.thickness_mm)} placeholder="Spessore mm" disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
          <input name="width_mm" inputMode="decimal" defaultValue={value(current.width_mm)} placeholder="Larghezza mm" disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
          <input name="height_mm" inputMode="decimal" defaultValue={value(current.height_mm)} placeholder="Altezza mm" disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
          <input name="length_mm" inputMode="decimal" defaultValue={value(current.length_mm)} placeholder="Lunghezza mm" disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
          <input name="quantity" inputMode="decimal" defaultValue={value(current.quantity)} placeholder="Quantità" disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <input name="quantity_unit" defaultValue={value(current.quantity_unit)} placeholder="Q.tà unità" disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
          <input name="price_value" inputMode="decimal" defaultValue={value(current.price_value)} placeholder="Prezzo" disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
          <input name="price_unit" defaultValue={value(current.price_unit)} placeholder="Unità prezzo" disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <input name="currency" defaultValue={value(current.currency)} placeholder="Valuta" disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
          <input name="discount_percentage" inputMode="decimal" defaultValue={value(current.discount_percentage)} placeholder="Sconto %" disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
          <input name="availability_status" defaultValue={value(current.availability_status)} placeholder="Disponibilità" disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
        </div>

        <textarea name="note" placeholder="Nota della revisione" rows={2} disabled={disabled} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />

        <button type="submit" disabled={pending || saved || reviewed} className="w-full rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "Applicazione…" : saved ? "Applicata" : reviewed ? "Già revisionata" : "Applica correzione"}
        </button>
        <p id={messageId} role={state.status === "error" ? "alert" : "status"} aria-atomic="true" className={`text-xs ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>
          {pending ? "Applicazione della correzione…" : state.message}
        </p>
      </form>
    </details>
  );
}
