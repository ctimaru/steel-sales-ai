"use client";

import { useState, useTransition } from "react";

import type { SourceReingestItem } from "./actions";
import { reingestOfferSource } from "./actions";

export function SourceReingestCard({ item }: { item: SourceReingestItem }) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const recovered = item.action_status === "recovered";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-600">
            PA2.30.3 · Source recovery
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">
            {item.subject || "Thread senza oggetto"}
          </h3>
          <p className="mt-1 break-all text-xs text-slate-400">{item.thread_id}</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>Run invalidato: #{item.invalidated_run_id ?? "—"}</div>
          <div>Successor: #{item.successor_run_id ?? "—"}</div>
        </div>
      </div>

      {item.expected_source_filenames?.length ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">EML attesi per questo thread</p>
          <ul className="mt-2 space-y-1">
            {item.expected_source_filenames.map((name) => (
              <li key={name} className="break-all">{name.split("/").pop()}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {recovered ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Sorgente recuperata e legata al thread. Il successor reparse è stato creato senza promuovere observation.
        </div>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!file) {
              setMessage("Seleziona il file EML originale.");
              return;
            }
            const formData = new FormData();
            formData.append("thread_id", item.thread_id);
            formData.append("file", file, file.name);
            setMessage(null);
            startTransition(async () => {
              const result = await reingestOfferSource(
                { status: "idle", message: "" },
                formData,
              );
              setMessage(result.message);
            });
          }}
        >
          <div>
            <label className="block text-xs font-semibold text-slate-600">
              File EML originale
            </label>
            <input
              type="file"
              accept=".eml,message/rfc822"
              disabled={isPending || item.action_status === "uploading"}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-2 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            />
          </div>
          <button
            type="submit"
            disabled={isPending || item.action_status === "uploading"}
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Recupero in corso…" : "Re-ingest sorgente originale"}
          </button>
        </form>
      )}

      {item.error ? (
        <p className="mt-3 text-xs text-rose-700">Ultimo errore: {item.error}</p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-1">source-only</span>
        <span className="rounded-full bg-slate-100 px-2 py-1">thread-bound</span>
        <span className="rounded-full bg-slate-100 px-2 py-1">sha-256</span>
        <span className="rounded-full bg-slate-100 px-2 py-1">no auto-promotion</span>
      </div>
    </div>
  );
}
