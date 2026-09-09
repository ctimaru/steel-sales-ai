"use client";

import { useActionState } from "react";

import {
  uploadCommercialDocument,
  type UploadState,
} from "@/app/(workspace)/uploads/actions";

const initialState: UploadState = {
  status: "idle",
  message: "",
};

export function UploadForm() {
  const [state, formAction, pending] = useActionState(
    uploadCommercialDocument,
    initialState,
  );

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <div>
        <label htmlFor="file" className="text-sm font-semibold text-slate-900">
          Documento commerciale
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".zip,.eml,.pdf,.xls,.xlsx"
          required
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
        />
        <p className="mt-2 text-xs text-slate-500">
          ZIP, EML, PDF o Excel · massimo 25 MB
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Caricamento..." : "Carica documento"}
      </button>

      {state.message ? (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <p>{state.message}</p>
          {state.jobId ? (
            <p className="mt-1 text-xs opacity-80">Job: {state.jobId}</p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
