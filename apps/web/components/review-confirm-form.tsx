"use client";

import { useActionState, useId } from "react";
import { confirmReviewItem, type ReviewActionState } from "@/app/(workspace)/review/actions";

const initialState: ReviewActionState = { status: "idle", message: "" };

export function ReviewConfirmForm({ id, reviewed }: { id: string; reviewed: boolean }) {
  const [state, action, pending] = useActionState(confirmReviewItem, initialState);
  const messageId = useId();
  const saved = state.status === "success";

  return (
    <form action={action} aria-busy={pending}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending || saved || reviewed}
        aria-describedby={state.message ? messageId : undefined}
        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Salvataggio…" : saved ? "Confermata" : reviewed ? "Già revisionata" : "Conferma"}
      </button>
      <p
        id={messageId}
        role={state.status === "error" ? "alert" : "status"}
        aria-atomic="true"
        className={`mt-2 text-xs leading-5 ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}
      >
        {pending ? "Salvataggio in corso…" : state.message}
      </p>
    </form>
  );
}
