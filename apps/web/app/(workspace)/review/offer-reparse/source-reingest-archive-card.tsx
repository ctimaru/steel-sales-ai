"use client";

import { useState, useTransition } from "react";

import { bulkReingestOfferSources } from "./actions";

export function SourceReingestArchiveCard({
  autoReady,
  ambiguous,
}: {
  autoReady: number;
  ambiguous: number;
}) {
  const [archive, setArchive] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-700">
            PA2.30.3b · Bulk archive recovery
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">
            Recupera le sorgenti da un unico archivio ZIP
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Il batch usa solo EML offered con selezione univoca. Nessun fuzzy match:
            {" "}{autoReady} thread sono auto-match; {ambiguous} restano manuali.
          </p>
        </div>
      </div>

      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!archive) {
            setMessage("Seleziona l’archivio ZIP originale.");
            return;
          }
          const formData = new FormData();
          formData.append("archive", archive, archive.name);
          setMessage(null);
          startTransition(async () => {
            const result = await bulkReingestOfferSources(
              { status: "idle", message: "" },
              formData,
            );
            setMessage(result.message);
          });
        }}
      >
        <input
          type="file"
          accept=".zip,application/zip"
          disabled={isPending || autoReady === 0}
          onChange={(event) => setArchive(event.target.files?.[0] ?? null)}
          className="block w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-700"
        />
        <button
          type="submit"
          disabled={isPending || autoReady === 0}
          className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Recovery bulk in corso…" : `Recupera ${autoReady} sorgenti univoche`}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}
