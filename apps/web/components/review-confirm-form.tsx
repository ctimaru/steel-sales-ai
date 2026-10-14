"use client";

import { useActionState, useId } from "react";
import { confirmReviewItem, type ReviewActionState } from "@/app/(workspace)/review/actions";
import { ActionFeedback } from "@/components/action-feedback";

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
        className="min-h-11 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Salvataggio…" : saved ? "Confermata" : reviewed ? "Già revisionata" : "Conferma"}
      </button>
      <ActionFeedback
        id={messageId}
        status={state.status}
        message={state.message}
        pending={pending}
        pendingMessage="Salvataggio in corso…"
        className="mt-2"
      />
    </form>
  );
}
