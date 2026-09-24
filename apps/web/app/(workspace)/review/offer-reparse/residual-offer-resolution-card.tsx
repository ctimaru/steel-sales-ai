"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  resolveOfferRecoveryResidualCandidate,
  type ResidualOfferResolutionItem,
} from "./actions";

export function ResidualOfferResolutionCard({
  item,
}: {
  item: ResidualOfferResolutionItem;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>(
    item.adoptable_fields.filter((field) =>
      ["length_mm", "quantity", "quantity_unit"].includes(field),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);

  function toggleField(field: string) {
    setSelectedFields((current) =>
      current.includes(field)
        ? current.filter((value) => value !== field)
        : [...current, field],
    );
  }

  const ready = item.status === "source_provenance_target_ready";

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
            PA2.30.14 · Controlled Residual Offer Candidate Resolution
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              candidate #{item.candidate_id}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              remediation #{item.remediation_queue_id}
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
              target #{item.target_observation_id}
            </span>
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Candidate source
          </p>
          <p className="mt-2 rounded-xl bg-white p-3 text-sm italic leading-6 text-slate-700">
            “{item.candidate_source_text}”
          </p>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Observation target ancorata
          </p>
          <p className="mt-2 rounded-xl bg-white p-3 text-sm leading-6 text-slate-700">
            {item.target_source_text}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
              same source file
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
              candidate text contained
            </span>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-800">
              PA2.30.8 guard eligible
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Conferma esplicita
          </p>

          {ready ? (
            <>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Il target è determinato dalla provenienza testuale, non dalla sola geometria.
                Conferma i campi da adottare; la remediation non verrà chiusa automaticamente.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {item.adoptable_fields.map((field) => (
                  <label
                    key={field}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field)}
                      disabled={pending}
                      onChange={() => toggleField(field)}
                    />
                    {field}
                  </label>
                ))}
              </div>

              <textarea
                value={note}
                disabled={pending}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Nota obbligatoria sulla conferma del target sorgente"
                className="mt-4 min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              />

              <button
                type="button"
                disabled={
                  pending ||
                  !note.trim() ||
                  !["length_mm", "quantity", "quantity_unit"].every((field) =>
                    selectedFields.includes(field),
                  )
                }
                onClick={() => {
                  setMessage(null);
                  startTransition(async () => {
                    const result = await resolveOfferRecoveryResidualCandidate({
                      candidateId: item.candidate_id,
                      targetObservationId: item.target_observation_id,
                      selectedFields,
                      note,
                    });
                    setMessage(
                      result.ok
                        ? result.status === "already_decided"
                          ? "Candidate già decisa."
                          : "Candidate adottata sul target ancorato alla sorgente."
                        : result.error ?? "Risoluzione non riuscita.",
                    );
                    if (result.ok) router.refresh();
                  });
                }}
                className="mt-3 w-full rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Conferma…" : "Conferma target e adotta campi"}
              </button>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Candidate non pronta: {item.reason ?? item.status}
            </p>
          )}

          {message ? <p className="mt-3 text-xs font-medium text-slate-700">{message}</p> : null}
        </div>
      </div>
    </div>
  );
}
