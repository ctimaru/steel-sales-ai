"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { expandStructuredConversation, type ConversationCoverageCandidate } from "./actions";

export function ConversationExpansionButton({
  candidate,
}: {
  candidate: ConversationCoverageCandidate;
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
            const result = await expandStructuredConversation(candidate.commercial_thread_id);
            if (!result.ok) {
              setMessage(result.error ?? "Espansione bloccata.");
              return;
            }
            setMessage(result.status === "already_normalized" ? "Conversation già normalizzata." : "Conversation creata.");
            router.refresh();
          });
        }}
        className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Espansione…" : "Crea Conversation"}
      </button>
      {message ? <span className="text-xs font-medium text-slate-600">{message}</span> : null}
    </div>
  );
}
