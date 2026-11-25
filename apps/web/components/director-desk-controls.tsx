"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { assignDeskDeal, decideDeskApproval } from "@/app/(workspace)/commercial/direzione/actions";

// DIR-DESK1 — controlli della Scrivania della Direzione: «Assegna a…» e
// Approva / Rifiuta. Il server ricontrolla tutto: qui solo invio e feedback.

export type DeskAssignee = { userId: string; label: string; office: string };

export function DeskAssignSelect({ kind, id, title, assignees }: {
  kind: string; id: string; title: string; assignees: readonly DeskAssignee[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function assign(userId: string) {
    if (!userId) return;
    setError(null);
    start(async () => {
      const result = await assignDeskDeal({ kind, id, userId });
      if (!result.ok) { setError(result.error); return; }
      setDone(assignees.find((a) => a.userId === userId)?.label ?? "assegnata");
      router.refresh();
    });
  }

  if (done) return <p role="status" className="text-xs font-semibold text-[#1f5e45]">✓ Assegnata a {done}</p>;
  return (
    <div className="min-w-0">
      <label className="sr-only" htmlFor={"assign-" + id}>Assegna «{title}» a</label>
      <select id={"assign-" + id} defaultValue="" disabled={pending || !assignees.length}
        onChange={(event) => assign(event.target.value)}
        className="h-9 w-full max-w-[240px] rounded-lg border border-[#bfd0c5] bg-white px-2 text-xs font-semibold text-[#173f35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60">
        <option value="" disabled>{pending ? "Assegnazione…" : "Assegna a…"}</option>
        {assignees.map((a) => <option key={a.userId} value={a.userId}>{a.label} · {a.office}</option>)}
      </select>
      {error ? <p role="alert" className="mt-1 text-[11px] font-semibold text-[#9a3412]">{error}</p> : null}
    </div>
  );
}

export function DeskApprovalButtons({ rfqId, approvalId, ownRequest }: {
  rfqId: string; approvalId: string; ownRequest: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  function decide(decision: "approved" | "rejected") {
    setError(null);
    start(async () => {
      const result = await decideDeskApproval({ rfqId, approvalId, decision });
      if (!result.ok) { setError(result.error); return; }
      setDone(decision);
      router.refresh();
    });
  }

  if (done) return <p role="status" className="text-xs font-semibold text-[#1f5e45]">✓ {done === "approved" ? "Approvata" : "Rifiutata"}</p>;
  if (ownRequest) return <p className="text-[11px] leading-4 text-[#6b4a07]">L&apos;hai chiesta tu: serve un&apos;altra persona.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => decide("approved")} disabled={pending}
        className="inline-flex min-h-9 items-center rounded-lg bg-[#175640] px-3 text-xs font-bold text-white hover:bg-[#104632] disabled:opacity-60">
        {pending ? "…" : "Approva"}
      </button>
      <button type="button" onClick={() => decide("rejected")} disabled={pending}
        className="inline-flex min-h-9 items-center rounded-lg border border-[#bfd0c5] bg-white px-3 text-xs font-semibold text-[#9a3412] hover:bg-[#fff6f1] disabled:opacity-60">
        Rifiuta
      </button>
      {error ? <p role="alert" className="w-full text-[11px] font-semibold text-[#9a3412]">{error}</p> : null}
    </div>
  );
}
