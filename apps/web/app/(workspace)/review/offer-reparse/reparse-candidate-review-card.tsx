"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  adoptOfferReparseCandidate,
  rejectOfferReparseCandidate,
  type ReparseCandidateReviewItem,
} from "./actions";

function valueLabel(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ReparseCandidateReviewCard({ item }: { item: ReparseCandidateReviewItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [targetId, setTargetId] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const target = useMemo(
    () => item.target_observations.find((row) => String(row.observation_id) === targetId) ?? null,
    [item.target_observations, targetId],
  );

  const terminal = item.review_status !== "pending_review";

  function toggleField(field: string) {
    setSelectedFields((current) =>
      current.includes(field) ? current.filter((value) => value !== field) : [...current, field],
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
              candidate #{item.candidate_id}
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
              {item.review_status}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
              {item.item_role ?? "unknown role"}
            </span>
          </div>

          <p className="mt-3 text-sm font-semibold text-slate-950">
            Thread {item.thread_id}
          </p>
          <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm italic leading-6 text-slate-600">
            “{item.source_text ?? "Nessun source text disponibile"}”
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries(item.candidate_evidence)
              .filter(([key]) => !["source_text", "metadata"].includes(key))
              .map(([key, value]) => (
                <div key={key} className="rounded-lg border border-slate-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{key}</p>
                  <p className="mt-1 break-words text-xs font-medium text-slate-700">{valueLabel(value)}</p>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          {terminal ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Decisione</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {item.decision?.decision ?? item.review_status}
              </p>
              {item.decision?.target_observation_id ? (
                <p className="mt-1 text-xs text-slate-500">
                  Observation #{item.decision.target_observation_id} · {item.decision.selected_fields.join(", ")}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Target esplicito
              </p>
              <select
                value={targetId}
                disabled={pending}
                onChange={(event) => {
                  setTargetId(event.target.value);
                  setSelectedFields([]);
                  setMessage(null);
                }}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="">Seleziona observation target…</option>
                {item.target_observations.map((row) => (
                  <option key={row.observation_id} value={row.observation_id}>
                    Observation #{row.observation_id} · {row.adoptable_fields.length} campi adottabili
                  </option>
                ))}
              </select>

              {target ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Campi adottabili</p>
                    {target.adoptable_fields.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {target.adoptable_fields.map((field) => (
                          <label
                            key={field}
                            className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
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
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">Nessun campo NULL recuperabile per questo target.</p>
                    )}
                  </div>

                  {target.conflicting_fields.length ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-900">Conflitti non adottabili in PA2.29</p>
                      <p className="mt-1 text-xs leading-5 text-amber-800">
                        {target.conflicting_fields.join(", ")}
                      </p>
                    </div>
                  ) : null}

                  <textarea
                    value={note}
                    disabled={pending}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Nota opzionale sulla decisione"
                    className="min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || !target || !selectedFields.length}
                  onClick={() => {
                    if (!target) return;
                    setMessage(null);
                    startTransition(async () => {
                      const result = await adoptOfferReparseCandidate({
                        candidateId: item.candidate_id,
                        targetObservationId: target.observation_id,
                        selectedFields,
                        note,
                      });
                      setMessage(
                        result.ok
                          ? result.status === "already_decided"
                            ? "Candidate già decisa."
                            : "Candidate adottata tramite correction loop."
                          : result.error ?? "Adozione non riuscita.",
                      );
                      if (result.ok) router.refresh();
                    });
                  }}
                  className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pending ? "Elaborazione…" : "Adotta campi selezionati"}
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setMessage(null);
                    startTransition(async () => {
                      const result = await rejectOfferReparseCandidate({
                        candidateId: item.candidate_id,
                        note,
                      });
                      setMessage(
                        result.ok
                          ? result.status === "already_decided"
                            ? "Candidate già decisa."
                            : "Candidate rifiutata."
                          : result.error ?? "Rifiuto non riuscito.",
                      );
                      if (result.ok) router.refresh();
                    });
                  }}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Rifiuta candidate
                </button>
              </div>

              {message ? <p className="mt-3 text-xs font-medium text-slate-600">{message}</p> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
