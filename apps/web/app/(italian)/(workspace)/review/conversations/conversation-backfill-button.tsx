"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { applyConversationBackfill, type ConversationBackfillCandidate } from "./actions";

export function ConversationBackfillButton({
  candidate,
}: {
  candidate: ConversationBackfillCandidate;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await applyConversationBackfill(
              candidate.entity_type,
              candidate.entity_id,
              candidate.candidate_conversation_id,
            );

            if (!result.ok) {
              setMessage(result.error ?? "Backfill bloccato.");
              return;
            }

            setMessage(
              result.status === "already_applied" || result.status === "already_linked"
                ? "Conversation già collegata."
                : "Conversation collegata.",
            );
            router.refresh();
          });
        }}
        className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Collegamento…" : "Collega Conversation"}
      </button>
      {message ? <span className="text-xs font-medium text-slate-600">{message}</span> : null}
    </div>
  );
}
