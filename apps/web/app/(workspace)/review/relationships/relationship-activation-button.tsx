"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { activateRelationship, type RelationshipCandidate } from "./actions";

function label(type: RelationshipCandidate["relationship_type"]) {
  if (type === "offer_rfq") return "Collega Offer → RFQ";
  if (type === "order_offer") return "Collega Order → Offer";
  return "Collega Order → RFQ";
}

export function RelationshipActivationButton({ candidate }: { candidate: RelationshipCandidate }) {
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
            const result = await activateRelationship(
              candidate.relationship_type,
              candidate.source_entity_id,
              candidate.target_entity_id,
            );
            if (!result.ok) {
              setMessage(result.error ?? "Relazione bloccata.");
              return;
            }
            setMessage(result.status === "already_applied" ? "Relazione già attiva." : "Relazione attivata.");
            router.refresh();
          });
        }}
        className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Attivazione…" : label(candidate.relationship_type)}
      </button>
      {message ? <span className="text-xs font-medium text-slate-600">{message}</span> : null}
    </div>
  );
}
