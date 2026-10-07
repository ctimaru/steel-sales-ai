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

      setFeedback("Profilo supplier aggiornato.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-[#dce2df] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
            Rubrica buyer
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">
            Preferenza, gruppi e note
          </h2>
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-[#d7dfdb] bg-[#f7f9f8] px-3 py-2 text-xs font-semibold text-[#52615b]">
          <input
            type="checkbox"
            checked={isPreferred}
            onChange={(event) => setIsPreferred(event.target.checked)}
          />
          Supplier preferito
        </label>
      </div>

      <label className="mt-4 block text-xs font-semibold text-[#52615b]">
        Tag / gruppi
        <input
          value={tagInput}
          onChange={(event) => setTagInput(event.target.value)}
          placeholder="strategico, tubi, s355"
          className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm outline-none focus:border-[#438d7a]"
        />
        <span className="mt-1 block text-[10px] font-normal text-[#87908c]">
          Massimo 10 tag, separati da virgola.
        </span>
      </label>

      <label className="mt-4 block text-xs font-semibold text-[#52615b]">
        Note private
        <textarea
          value={noteInput}
          onChange={(event) => setNoteInput(event.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Preferenze commerciali, qualità del servizio, annotazioni buyer…"
          className="mt-1.5 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#438d7a]"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex min-h-10 items-center rounded-xl bg-[#173f35] px-4 text-xs font-bold text-white disabled:opacity-50"
        >
          {pending ? "Salvo…" : "Salva profilo supplier"}
        </button>
        {feedback ? (
          <span className="text-xs font-semibold text-[#66736e]">{feedback}</span>
        ) : null}
      </div>
    </section>
  );
}
