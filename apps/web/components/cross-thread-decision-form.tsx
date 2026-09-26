"use client";

import { useActionState, useId } from "react";

import {
  decideCrossThreadRelationship,
  type CrossThreadCandidate,
  type CrossThreadDecisionState,
} from "@/app/(workspace)/commercial/conversion/relationships/actions";

const initialState: CrossThreadDecisionState = { status: "idle", message: "" };

export function CrossThreadDecisionForm({
  candidate,
}: {
  candidate: CrossThreadCandidate;
}) {
  const [state, action, pending] = useActionState(decideCrossThreadRelationship, initialState);
  const messageId = useId();
  const completed = state.status === "success";

  return (
    <form action={action} aria-busy={pending} className="space-y-2">
      <input type="hidden" name="relationship_type" value={candidate.relationship_type} />
      <input type="hidden" name="source_entity_id" value={candidate.source_entity_id} />
      <input type="hidden" name="target_entity_id" value={candidate.target_entity_id} />

      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Nota decisione
        <input
          name="note"
          disabled={pending || completed}
          placeholder="Opzionale"
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-slate-400 disabled:bg-slate-100"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="submit"
          name="decision"
          value="accepted"
          disabled={pending || completed}
          className="rounded-lg bg-[#1b4c5d] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Salvataggio…" : "Accetta relazione"}
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending || completed}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Rifiuta candidato
        </button>
      </div>

      <p
        id={messageId}
        role={state.status === "error" ? "alert" : "status"}
        className={`text-xs leading-5 ${
          state.status === "error" ? "text-red-700" : "text-emerald-700"
        }`}
      >
        {state.message}
      </p>
    </form>
  );
}
