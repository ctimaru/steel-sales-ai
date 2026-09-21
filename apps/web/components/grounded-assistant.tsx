"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import {
  askP1Assistant,
  type P1AssistantEvidence,
  type P1AssistantObservation,
  type P1AssistantState,
} from "@/app/(workspace)/assistant/p1-actions";

const initialState: P1AssistantState = { status: "idle", message: "", context: null, turns: [] };

const suggestions = [
  "Qual è l'ultimo prezzo del P265GH 406,4x6,3?",
  "Cosa dicono le email sul P265GH 406,4x6,3?",
  "Mostrami lo storico prezzi del P265GH 406,4x6,3",
  "Quali offerte sono senza ordine?",
];

function evidenceTarget(evidence: P1AssistantEvidence) {
  if (evidence.source_uri && /^https?:\/\//i.test(evidence.source_uri)) {
    return { href: evidence.source_uri, external: true };
  }
  const threadId = evidence.source_locator?.thread_id;
  if (typeof threadId === "string" && threadId) {
    return { href: `/conversations/${threadId}`, external: false };
  }
  return null;
}

function locationLabel(evidence: P1AssistantEvidence) {
  const parts: string[] = [];
  if (evidence.page_start) {
    parts.push(
      evidence.page_end && evidence.page_end !== evidence.page_start
        ? `pagine ${evidence.page_start}–${evidence.page_end}`
        : `pagina ${evidence.page_start}`,
    );
  }
  if (evidence.section_path?.length) parts.push(evidence.section_path.join(" › "));
  return parts.join(" · ");
}

function AnswerWithCitations({
  text,
  evidence,
  onOpen,
}: {
  text: string;
  evidence: P1AssistantEvidence[];
  onOpen: (item: P1AssistantEvidence) => void;
}) {
  const byId = new Map(evidence.map((item) => [item.citation_id, item]));
  return (
    <p className="mt-2 whitespace-pre-wrap text-base font-medium leading-7 text-slate-900">
      {text.split(/(\[S\d+\])/g).map((part, index) => {
        const match = part.match(/^\[(S\d+)\]$/);
        if (!match) return <span key={`${index}-${part.slice(0, 12)}`}>{part}</span>;
        const item = byId.get(match[1]);
        if (!item) return <span key={`${index}-${part}`}>{part}</span>;
        return (
          <button
            key={`${index}-${part}`}
            type="button"
            onClick={() => onOpen(item)}
            className="mx-0.5 inline-flex rounded-md bg-indigo-100 px-1.5 py-0.5 align-baseline text-xs font-bold text-indigo-700 transition hover:bg-indigo-200"
            aria-label={`Apri evidence ${item.citation_id}`}
          >
            {part}
          </button>
        );
      })}
    </p>
  );
}

function formatObservation(row: P1AssistantObservation) {
  const parts = [row.grade, row.standard];
  if (row.outer_diameter_mm !== null && row.outer_diameter_mm !== undefined) parts.push(`Ø ${row.outer_diameter_mm}`);
  if (row.thickness_mm !== null && row.thickness_mm !== undefined) parts.push(`t ${row.thickness_mm}`);
  if (row.length_mm !== null && row.length_mm !== undefined) parts.push(`L ${row.length_mm}`);
  return parts.filter(Boolean).join(" · ") || "Osservazione commerciale";
}

function EvidenceDrawer({ item, onClose }: { item: P1AssistantEvidence | null; onClose: () => void }) {
  if (!item) return null;
  const target = evidenceTarget(item);
  const location = locationLabel(item);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" role="dialog" aria-modal="true" aria-label="Evidence drawer">
      <button className="absolute inset-0 cursor-default" type="button" aria-label="Chiudi evidence" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white">[{item.citation_id}]</span>
              {item.source_class ? <span className="text-xs font-semibold text-slate-500">{item.source_class}</span> : null}
            </div>
            <h2 className="mt-3 text-lg font-semibold text-slate-950">
              {item.title || item.filename || item.source_name || "Evidence"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {[item.document_type, location].filter(Boolean).join(" · ") || "Fonte Commercial Memory"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Chiudi
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Snippet originale</p>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            {item.content || "Snippet non disponibile."}
          </div>
          <dl className="mt-6 grid gap-3 text-sm">
            {item.filename ? <div><dt className="text-xs font-semibold text-slate-400">File</dt><dd className="mt-1 text-slate-700">{item.filename}</dd></div> : null}
            {item.source_name ? <div><dt className="text-xs font-semibold text-slate-400">Fonte</dt><dd className="mt-1 text-slate-700">{item.source_name}</dd></div> : null}
          </dl>
        </div>
        <div className="border-t border-slate-200 p-5 sm:p-6">
          {target ? (
            target.external ? (
              <a href={target.href} target="_blank" rel="noreferrer" className="block rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white">
                Apri fonte originale ↗
              </a>
            ) : (
              <Link href={target.href} className="block rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white">
                Apri thread originale →
              </Link>
            )
          ) : (
            <p className="text-center text-xs text-slate-500">La fonte è verificabile nel knowledge layer ma non espone un link diretto.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

export function GroundedAssistant() {
  const [state, formAction, pending] = useActionState(askP1Assistant, initialState);
  const [query, setQuery] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<P1AssistantEvidence | null>(null);

  useEffect(() => {
    if (state.turns.length) setQuery("");
  }, [state.turns.length]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-950 px-5 py-5 text-white sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">Assistente con fonti</p>
          <h2 className="mt-2 text-xl font-semibold">Chiedi alla tua Commercial Memory</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Le risposte restano collegate alle fonti usate. Tocca una citazione [S#] per vedere il passaggio e aprire il documento o la conversazione originale.
          </p>
        </div>
        <form action={formAction} className="space-y-4 p-5 sm:p-6">
          <textarea
            name="query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Es. Qual è l'ultimo prezzo del P265GH 406,4x6,3 e da quale offerta arriva?"
            className="w-full resize-none rounded-2xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
          />
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => setQuery(suggestion)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white">
                {suggestion}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500">Usa l’assistente per approfondire lo storico; per ricerche dirette usa Cerca o Storico prodotti.</p>
            <button type="submit" disabled={pending || query.trim().length < 2} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {pending ? "Cerco nelle fonti..." : state.turns.length ? "Continua" : "Chiedi"}
            </button>
          </div>
        </form>
      </section>

      {state.turns.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-semibold text-slate-700">Le risposte compariranno qui con le relative fonti.</p>
          <p className="mt-1 text-xs text-slate-500">Se le fonti non bastano, l'assistente lo dichiara senza completare i dati mancanti.</p>
        </section>
      ) : (
        <section className="space-y-5">
          {state.turns.map((turn, turnIndex) => {
            const payload = turn.payload;
            const evidence = payload?.evidence ?? [];
            const observations = payload?.observations ?? [];
            return (
              <div key={`${turnIndex}-${turn.query}`} className="space-y-3">
                <div className="flex justify-end">
                  <div className="max-w-3xl rounded-2xl rounded-br-md bg-slate-950 px-4 py-3 text-sm font-medium leading-6 text-white">{turn.query}</div>
                </div>
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="p-5 sm:p-6">
                    <div className={turn.status === "error" ? "rounded-2xl bg-rose-50 p-5" : "rounded-2xl bg-indigo-50 p-5"}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Steel Sales AI</span>
                        {payload?.grounding?.status ? <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">{payload.grounding.status}</span> : null}
                        {payload?.access?.membership_verified ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Accesso verificato</span> : null}
                      </div>
                      <AnswerWithCitations text={turn.message} evidence={evidence} onOpen={setSelectedEvidence} />
                    </div>

                    {evidence.length ? (
                      <div className="mt-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-950">Fonti</h3>
                            <p className="mt-1 text-xs text-slate-500">Passaggi e documenti usati per costruire la risposta.</p>
                          </div>
                          <span className="text-xs font-semibold text-slate-400">{evidence.length} fonti</span>
                        </div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          {evidence.slice(0, 6).map((item) => (
                            <button key={item.citation_id} type="button" onClick={() => setSelectedEvidence(item)} className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-indigo-300 hover:shadow-sm">
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-indigo-600 px-2 py-1 text-[11px] font-bold text-white">[{item.citation_id}]</span>
                                <span className="truncate text-xs font-semibold text-slate-500">{item.source_class || item.document_type || "source"}</span>
                              </div>
                              <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-950">{item.title || item.filename || item.source_name || "Evidence"}</p>
                              <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{item.content}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : payload?.grounding?.status === "insufficient_evidence" ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Fonti insufficienti: nessun documento viene presentato come conferma.</div>
                    ) : null}
                  </div>

                  {observations.length ? (
                    <div className="border-t border-slate-100 px-5 py-5 sm:px-6">
                      <h3 className="text-sm font-semibold text-slate-950">Dati commerciali usati</h3>
                      <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        {observations.slice(0, 6).map((row, index) => {
                          const body = (
                            <div className="rounded-2xl border border-slate-200 p-3">
                              <p className="text-sm font-semibold text-slate-900">{formatObservation(row)}</p>
                              {row.source_filename ? <p className="mt-1 text-xs text-slate-500">{row.source_filename}</p> : null}
                            </div>
                          );
                          return row.thread_id ? <Link key={`${row.id ?? index}-${row.thread_id}`} href={`/conversations/${row.thread_id}`}>{body}</Link> : <div key={`${row.id ?? index}-no-thread`}>{body}</div>;
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <EvidenceDrawer item={selectedEvidence} onClose={() => setSelectedEvidence(null)} />
    </div>
  );
}
