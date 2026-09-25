"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { acknowledgeOperationalAlert, resolveOperationalAlert } from "./actions";

export function OperationalAlertActions({
  alertId,
  status,
}: {
  alertId: number;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (status === "resolved") return null;

  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap gap-2">
        {status === "open" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const result = await acknowledgeOperationalAlert(alertId);
                setMessage(result.ok ? "Alert preso in carico." : result.error ?? "Operazione non riuscita.");
                if (result.ok) router.refresh();
              });
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {pending ? "Aggiornamento…" : "Prendi in carico"}
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Nota di risoluzione obbligatoria"
          className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
        />
        <button
          type="button"
          disabled={pending || !note.trim()}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const result = await resolveOperationalAlert(alertId, note);
              setMessage(result.ok ? "Alert risolto." : result.error ?? "Operazione non riuscita.");
              if (result.ok) {
                setNote("");
                router.refresh();
              }
            });
          }}
          className="h-10 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Salvataggio…" : "Risolvi"}
        </button>
      </div>

      {message ? <p className="text-xs font-medium text-slate-600">{message}</p> : null}
    </div>
  );
}
