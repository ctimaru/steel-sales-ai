"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateSupplierProfile } from "@/app/(workspace)/marketplace/suppliers/actions";

export function Rfqh11SupplierProfileEditor({
  profileId,
  preferred,
  tags,
  notes,
}: {
  profileId: string;
  preferred: boolean;
  tags: string[];
  notes: string | null;
}) {
  const router = useRouter();
  const [isPreferred, setIsPreferred] = useState(preferred);
  const [tagInput, setTagInput] = useState(tags.join(", "));
  const [noteInput, setNoteInput] = useState(notes ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateSupplierProfile({
        profileId,
        preferred: isPreferred,
        tags: tagInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes: noteInput,
      });

      if (!result.ok) {
        setFeedback(result.error ?? "Aggiornamento non riuscito.");
        return;
      }

      setFeedback("Salvato.");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="supplier-notes" className="rounded-xl border border-[var(--border)] bg-white p-3 sm:p-4" data-testid="supplier-card-notes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="supplier-notes" className="text-sm font-bold text-[var(--brand-deep)]">Note e preferenze</h2>
        <label className="flex items-center gap-2 text-xs font-semibold text-[var(--brand-deep)]">
          <input type="checkbox" checked={isPreferred} onChange={(event) => setIsPreferred(event.target.checked)} />
          Fornitore preferito
        </label>
      </div>

      <label className="mt-2 block text-[11px] font-semibold text-[var(--text-secondary)]">
        Gruppi
        <input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="es. strategico, tubi, S355"
          className="mt-1 h-10 w-full min-w-0 rounded-lg border border-[#d6e5db] bg-white px-2.5 text-sm text-[var(--brand-deep)]" />
        <span className="mt-0.5 block font-normal">Fino a 10, separati da virgola. Puoi cercarli nella rubrica.</span>
      </label>

      <label className="mt-2 block text-[11px] font-semibold text-[var(--text-secondary)]">
        Note private
        <textarea value={noteInput} onChange={(event) => setNoteInput(event.target.value)} rows={3} maxLength={4000}
          placeholder="Qualità del servizio, condizioni, cose da ricordare…"
          className="mt-1 w-full min-w-0 rounded-lg border border-[#d6e5db] bg-white px-2.5 py-2 text-sm text-[var(--brand-deep)]" />
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={pending}
          className="inline-flex min-h-9 items-center rounded-lg bg-[#175640] px-3 text-xs font-bold text-white hover:bg-[#104632] disabled:opacity-50">
          {pending ? "Salvataggio…" : "Salva"}
        </button>
        {feedback ? <span role="status" className="text-xs font-semibold text-[var(--text-secondary)]">{feedback}</span> : null}
      </div>
    </section>
  );
}
