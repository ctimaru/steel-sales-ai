"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { appRoutes } from "@/lib/routes";
import { classifyCommercialAiNativeTopic, type CommercialAiNativeTopic } from "@/lib/commercial-ai-native-ui";
import { commercialAiNativeResponse, type CommercialAiNativeHistoryTurn } from "@/app/(italian)/(workspace)/commercial/ai-native-actions";
import type { CommercialAiIntent } from "@/lib/commercial-ai-native-intent";
import type { IndustryLookupResult } from "@/lib/commercial-industry-knowledge";

type Turn = {
  id: number; question: string; topic: CommercialAiNativeTopic;
  intent: CommercialAiIntent | null;
  reply: string; followUp: string | null;
  state: "pending" | "answered" | "error";
  evidenceStatus: "not_connected" | "unverified" | "workflow" | "network" | null;
  industry: IndustryLookupResult | null;
  canPrepareDistinta: boolean;
};
function topicFromIntent(intent: CommercialAiIntent): CommercialAiNativeTopic {
  if (intent === "industry_search") return "network";
  if (intent === "technical_question") return "knowledge";
  if (intent === "distinta_edit" || intent === "rfq_prepare") return "distinta";
  return "general";
}
const MAX_CHARS = 12000;
const shortcuts = [
  "Chi produce tubo S355 Ø608?",
  "Preparami 24 barre Ø608×10 EN 10219, S355J2H, lunghezza 12 m.",
  "Qual è la differenza tra EN 10219 ed EN 10210?",
];
const contextCopy: Record<CommercialAiNativeTopic, { heading: string; description: string; link: string; label: string }> = {
  general: {
    heading: "Il tuo spazio di lavoro",
    description: "Fai una domanda liberamente. Le risposte AI sono orientative: nessuna scrittura o invio viene eseguito automaticamente.",
    link: appRoutes.rfqHub.savedDistinte, label: "Apri le Distinte",
  },
  network: {
    heading: "Ricerca produttori",
    description: "Cerca aziende del Network pubblicato: separiamo ruoli censiti, caratteristiche documentate e dati da confermare. Nessuna ricerca prova stock o capacità effettiva.",
    link: appRoutes.network.directory, label: "Esplora il Network",
  },
  distinta: {
    heading: "Distinta in preparazione",
    description: "Le richieste vengono riconosciute e trasferite solo su tua conferma alla Distinta canonica. Le proposte non vengono approvate automaticamente.",
    link: appRoutes.rfqHub.savedDistinte, label: "Le tue Distinte",
  },
  knowledge: {
    heading: "Conoscenza tecnica",
    description: "L’assistente può spiegare concetti generali, distinguendoli dalle norme verificate. Le fonti ufficiali e le schede della School restano necessarie per confermare requisiti tecnici.",
    link: appRoutes.knowledge.workspace, label: "Consulta la School",
  },
};

function ContextContent({ topic }: { topic: CommercialAiNativeTopic }) {
  const copy = contextCopy[topic];
  return (
    <div className="space-y-4" data-testid="commercial-ai-native-context-content">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#547b65]">Contesto attivo</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#173f35]">{copy.heading}</h2>
        <p className="mt-2 text-sm leading-6 text-[#51675b]">{copy.description}</p>
      </div>

      <Link href={copy.link}
        className="flex min-h-11 items-center justify-between rounded-xl border border-[#c9dbcf] bg-white px-3 py-2.5 text-sm font-semibold text-[#175640] hover:bg-[#eff7f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
        {copy.label} <span aria-hidden="true">↗</span>
      </Link>
      <div className="grid grid-cols-2 gap-2 border-t border-[#e2ebe5] pt-3">
        <Link href={appRoutes.rfqHub.home}
          className="rounded-lg border border-[#dce8e0] px-3 py-3 text-center text-xs font-medium text-[#315641] hover:bg-[#f3f8f4]">Centro RFQ</Link>
        <Link href={appRoutes.commercial.home + "?experience=classic"} data-testid="commercial-ai-native-legacy"
          className="rounded-lg border border-[#dce8e0] px-3 py-3 text-center text-xs font-medium text-[#315641] hover:bg-[#f3f8f4]">Gestione completa</Link>
      </div>
    </div>
  );
}

/**
 * C calls an authenticated read-only server action. Answers are transient and
 * clearly labeled; the only write-capable path remains the explicit canonical
 * Distinta handoff in this browser tab.
 */
export function CommercialAiNativeShell({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeTopic, setActiveTopic] = useState<CommercialAiNativeTopic>("general");
  const [handoffError, setHandoffError] = useState("");
  const nextId = useRef(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const previewTrigger = useRef<HTMLButtonElement>(null);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const threadEnd = useRef<HTMLDivElement>(null);

  useEffect(() => setReady(true), []);
  // Keep the most recent assistant reply visible after an async response,
  // without moving the composer or resetting a reader's earlier history
  // except when a new turn arrives or its pending state resolves.
  const lastTurnState = turns.length ? turns[turns.length - 1].state : null;
  useEffect(() => {
    if (!lastTurnState) return;
    const frame = requestAnimationFrame(() =>
      threadEnd.current?.scrollIntoView({ block: "nearest", behavior: "auto" })
    );
    return () => cancelAnimationFrame(frame);
  }, [turns.length, lastTurnState]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    if (!ready || busy || !question) return;
    const topic = classifyCommercialAiNativeTopic(question);
    const id = ++nextId.current;
    const history: CommercialAiNativeHistoryTurn[] = turns.slice(-3).flatMap((turn) =>
      turn.state !== "answered" ? [] : [
        { role: "user" as const, content: turn.question },
        { role: "assistant" as const, content: turn.reply },
      ]
    );
    setTurns((previous) => [...previous.slice(-24), {
      id, question, topic, intent: null, reply: "", followUp: null,
      state: "pending", evidenceStatus: null, industry: null, canPrepareDistinta: false,
    }]);
    setActiveTopic(topic);
    setBusy(true);
    setDraft("");
    setHandoffError("");
    requestAnimationFrame(() => threadEnd.current?.scrollIntoView({ block: "nearest", behavior: "auto" }));
    try {
      const result = await commercialAiNativeResponse(question, history);
      if (result.ok) {
        const resolvedTopic = topicFromIntent(result.intent);
        setActiveTopic(resolvedTopic);
        setTurns((previous) => previous.map((turn) => turn.id === id ? {
          ...turn, topic: resolvedTopic, intent: result.intent,
          reply: result.answer, followUp: result.followUp,
          evidenceStatus: result.evidenceStatus,
          industry: result.industry ?? null,
          canPrepareDistinta: result.canPrepareDistinta, state: "answered",
        } : turn));
      } else {
        setTurns((previous) => previous.map((turn) => turn.id === id ? {
          ...turn, reply: result.error, state: "error",
        } : turn));
      }
    } catch {
      setTurns((previous) => previous.map((turn) => turn.id === id ? {
        ...turn, reply: "Connessione AI non disponibile. Nessuna azione è stata eseguita; puoi riprovare.", state: "error",
      } : turn));
    } finally {
      setBusy(false);
    }
  }

  function startDistinta(text: string) {
    if (!canWrite || !ready || !text.trim()) return;
    try {
      window.sessionStorage.setItem("sss:commercial-ai-intake-handoff", text.slice(0, MAX_CHARS));
      setHandoffError("");
      router.push(appRoutes.commercial.home + "?compose=1&method=ai#commercial-ai-intake");
    } catch {
      setHandoffError("Il trasferimento non è riuscito. Apri la chat Distinta e incolla il testo manualmente.");
    }
  }

  function chooseShortcut(value: string) {
    setDraft(value);
    composerRef.current?.focus();
  }

  function newChat() {
    if (busy) return;
    setTurns([]);
    setActiveTopic("general");
    setDraft("");
    setHandoffError("");
    composerRef.current?.focus();
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (ready && draft.trim()) event.currentTarget.form?.requestSubmit();
  }

  function openPreview() {
    previewDialog.current?.showModal();
  }

  return (
    <section data-testid="commercial-ai-native-shell" aria-label="Smart Steel Intelligence"
      className="flex h-[calc(100dvh-14rem)] min-h-[360px] min-w-0 scroll-mt-20 flex-col overflow-hidden rounded-2xl border border-[#d5e3da] bg-white shadow-[0_10px_40px_-34px_rgba(13,63,41,0.2)] lg:h-[min(82dvh,780px)] lg:min-h-[500px] lg:rounded-2xl">
      <header className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-[#e2eae4] bg-white px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#175640] text-lg text-white">✦</span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#61816e]">Assistente industriale</p>
            <h1 className="truncate text-sm font-semibold tracking-tight text-[#163b2c] sm:text-lg">Smart Steel Intelligence</h1>
          </div>
        </div>
        <nav className="flex shrink-0 items-center gap-1 sm:gap-2" aria-label="Accesso alle attività commerciali">
          {turns.length > 0 ? (
            <button type="button" onClick={newChat} disabled={busy}
              data-testid="commercial-ai-native-new-chat"
              className="inline-flex min-h-10 items-center rounded-lg px-2.5 text-xs font-semibold text-[#175640] hover:bg-[#eff7f1] disabled:opacity-50">
              <span aria-hidden="true">+</span><span className="hidden sm:inline"> Nuova chat</span><span className="sr-only sm:hidden">Nuova chat</span>
            </button>
          ) : null}
          <button type="button" ref={previewTrigger} onClick={openPreview}
            data-testid="commercial-ai-native-mobile-context"
            aria-label="Strumenti"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-[#d1e2d6] px-2.5 text-xs font-semibold text-[#175640] lg:hidden">
            <span className="text-xl leading-none sm:hidden" aria-hidden="true">⋯</span>
            <span className="hidden sm:inline">Strumenti</span>
          </button>
          <details data-testid="commercial-ai-native-desktop-context" className="group relative hidden lg:block">
            <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1 rounded-lg border border-[#d1e2d6] px-3 text-xs font-semibold text-[#175640] hover:bg-[#eff7f1] [&::-webkit-details-marker]:hidden">
              Strumenti <span aria-hidden="true" className="text-[10px]">▾</span>
            </summary>
            <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[300px] rounded-xl border border-[#d1e2d6] bg-white p-4 shadow-lg">
              <ContextContent topic={activeTopic}/>
            </div>
          </details>
        </nav>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
          <div role="log" aria-label="Messaggi della conversazione" aria-live="polite" aria-relevant="additions"
            data-testid="commercial-ai-native-thread"
            className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4 sm:px-8 sm:py-8">
            {turns.length === 0 ? (
              <div className="mx-auto flex w-full max-w-[760px] flex-col items-start pt-2 sm:pt-10 lg:pt-[7vh]" data-testid="commercial-ai-native-intro">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#387452]">Smart Steel AI</span>
                <h2 className="mt-3 text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-tight tracking-[-0.04em] text-[#173f35]">
                  Di cosa hai bisogno?
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#526a5c]">
                  Cerca aziende, chiarisci una norma o prepara una Distinta.
                </p>
                <div className="mt-4 flex w-full flex-wrap gap-2 sm:mt-7">
                  {shortcuts.map((shortcut, index) => (
                    <button type="button" key={shortcut} onClick={() => chooseShortcut(shortcut)}
                      aria-label={shortcut}
                      className="inline-flex min-h-10 items-center rounded-full border border-[#d5e4da] bg-[#fafcfb] px-3.5 py-2 text-left text-xs font-semibold leading-5 text-[#315a43] hover:border-[#8bb7a0] hover:bg-[#f0f8f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
                      <span aria-hidden="true" className="mr-2 text-[#59866d]">{index === 0 ? "⌕" : index === 1 ? "▤" : "◎"}</span>
                      {index === 0 ? "Cerca produttori" : index === 1 ? "Prepara distinta" : "Chiedi una norma"}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-[800px] space-y-6">
                {turns.map((turn) => (
                  <div key={turn.id} className="space-y-4" data-testid="commercial-ai-native-turn">
                    <div className="flex justify-end">
                      <p className="max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#eaf4ee] px-4 py-3 text-sm leading-6 text-[#173f35]">
                        {turn.question}
                      </p>
                    </div>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#175640] text-white" aria-hidden="true">✦</span>
                      <div className="min-w-0 flex-1 rounded-xl bg-white px-1 py-1 sm:px-3 sm:py-2">
                        {turn.state === "pending" ? (
                          <p role="status" className="text-sm leading-6 text-[#426852]">Sto interpretando la richiesta…</p>
                        ) : (
                          <>
                            <p role={turn.state === "error" ? "alert" : undefined}
                              className="whitespace-pre-wrap break-words text-sm leading-6 text-[#2a4b3a]">{turn.reply}</p>
                            {turn.state === "answered" && turn.evidenceStatus === "unverified" ? (
                              <p data-testid="commercial-ai-native-unverified"
                                className="mt-2 text-xs leading-5 text-[#795a35]">Risposta AI orientativa · Nessuna fonte normativa verificata in questa risposta.</p>
                            ) : null}
                            {turn.state === "answered" && turn.evidenceStatus === "not_connected" ? (
                              <p data-testid="commercial-ai-native-not-connected"
                                className="mt-2 text-xs leading-5 text-[#795a35]">Network temporaneamente non raggiungibile · Nessuna azienda o disponibilità confermata.</p>
                            ) : null}
                            {turn.state === "answered" && turn.evidenceStatus === "network" && turn.industry ? (
                              <section data-testid="commercial-ai-native-industry-results" aria-label="Risultati ricerca industriale"
                                className="mt-4 space-y-3">
                                {turn.industry.restricted ? (
                                  <p data-testid="commercial-ai-native-industry-access-locked"
                                    className="rounded-xl border border-[#d5e2d9] bg-[#f7faf8] p-3 text-xs leading-5 text-[#536a5c]">
                                    Accesso Network necessario · I dettagli tecnici e le schede riservate non sono stati consultati.
                                  </p>
                                ) : (
                                  <>
                                    <p className="text-xs font-semibold text-[#416a51]">
                                      {turn.industry.companies.length} schede da approfondire · {turn.industry.examined} operatori esaminati
                                    </p>
                                    <div className="grid gap-2 md:grid-cols-2">
                                      {turn.industry.companies.map(company => (
                                        <article key={company.id} data-testid="commercial-ai-native-industry-company"
                                          className="min-w-0 rounded-xl border border-[#dce7df] bg-[#fbfdfb] p-3">
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="min-w-0 break-words text-sm font-semibold text-[#184332]">{company.name}</p>
                                            <span className="text-[10px] font-semibold text-[#60786b]">{company.country}</span>
                                          </div>
                                          <p className="mt-1 text-xs text-[#587366]">{company.roleLabel}</p>
                                          <p className="mt-2 text-xs font-semibold text-[#2d6648]">
                                            {company.match === "documented"
                                              ? "Caratteristiche registrate · da confermare"
                                              : "Possibile operatore · specifica non dimostrata"}
                                          </p>
                                          {company.reasons.length > 0 ? (
                                            <ul className="mt-2 space-y-1 text-xs leading-5 text-[#3e5b49]">
                                              {company.reasons.map((reason, i) => (
                                                <li key={i} className="break-words">
                                                  • {reason.label}
                                                  <span className="block text-[10px] text-[#6d8174]">
                                                    {reason.provenance === "platform_verified" ? "Fonte: verificata dalla piattaforma" :
                                                      reason.provenance === "company_declared" ? "Fonte: dichiarata dall’azienda" :
                                                      reason.provenance === "public_web" ? "Fonte: web pubblico" : "Fonte: scheda Network"}
                                                    {reason.verification !== "verified" ? " · non verificata" : ""}
                                                  </span>
                                                </li>
                                              ))}
                                            </ul>
                                          ) : (
                                            <p className="mt-2 text-xs leading-5 text-[#697e70]">
                                              Ruolo aziendale censito; capacità tecnica specifica non documentata.
                                            </p>
                                          )}
                                          {company.missing.length ? (
                                            <p className="mt-2 text-[11px] leading-5 text-[#86633d]">
                                              Da chiarire: {company.missing.join(", ")}.
                                            </p>
                                          ) : null}
                                          <Link href={company.sourceUrl}
                                            className="mt-3 inline-flex min-h-9 items-center text-xs font-semibold text-[#175640] underline underline-offset-4">
                                            Apri la scheda Network ↗
                                          </Link>
                                        </article>
                                      ))}
                                    </div>
                                    {turn.industry.limited ? (
                                      <p className="text-[11px] leading-5 text-[#697d71]">
                                        Risultati parziali: la ricerca non esamina ancora l’intero Network.
                                      </p>
                                    ) : null}
                                    {turn.industry.technicalScopeUnavailable ? (
                                      <p className="text-[11px] leading-5 text-[#86633d]">
                                        Alcuni dati tecnici non erano accessibili: nessun abbinamento mancante è stato presunto.
                                      </p>
                                    ) : null}
                                    <p className="text-[11px] leading-5 text-[#697d71]">
                                      Fonte: schede pubblicate del Network · Data delle singole affermazioni non disponibile ·
                                      Nessuna conferma di produzione, giacenza o disponibilità corrente.
                                    </p>
                                  </>
                                )}
                              </section>
                            ) : null}
                            {turn.followUp && turn.state === "answered" ? (
                              <p className="mt-2 text-xs font-medium leading-5 text-[#426852]">{turn.followUp}</p>
                            ) : null}
                            {turn.canPrepareDistinta && canWrite && turn.state === "answered" ? (
                              <button type="button" onClick={() => startDistinta(turn.question)}
                                data-testid="commercial-ai-native-open-distinta"
                                className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#175640] px-4 text-sm font-semibold text-white hover:bg-[#104632]">
                                Verifica nella chat Distinta ↗
                              </button>
                            ) : null}
                            {turn.topic === "network" ? (
                              <Link href={appRoutes.network.directory} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#175640] underline underline-offset-4">Esplora Network ↗</Link>
                            ) : turn.topic === "knowledge" ? (
                              <Link href={appRoutes.knowledge.workspace} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#175640] underline underline-offset-4">Consulta School ↗</Link>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={threadEnd} aria-hidden="true"/>
              </div>
            )}
          </div>

          <div className="relative z-10 shrink-0 border-t border-[#e4ebe6] bg-white px-3 py-2 sm:px-6 sm:py-3 lg:sticky lg:bottom-0">
            <form onSubmit={submit} data-testid="commercial-ai-native-form"
              aria-label="Scrivi una richiesta per Smart Steel Intelligence"
              className="mx-auto max-w-[800px] rounded-2xl border border-[#bdcfc2] bg-white p-2 shadow-[0_10px_25px_-18px_rgba(16,65,43,0.2)] focus-within:border-[#175640]">
              <label htmlFor="commercial-ai-native-input" className="sr-only">Domanda o richiesta commerciale</label>
              <textarea id="commercial-ai-native-input" ref={composerRef} rows={2} maxLength={MAX_CHARS}
                value={draft} onChange={(event) => setDraft(event.target.value)}
                onKeyDown={keyDown} disabled={!ready || busy}
                placeholder="Scrivi qui la tua domanda o richiesta…"
                className="min-h-14 max-h-40 w-full min-w-0 resize-y rounded-lg bg-white px-2 py-1.5 text-sm leading-6 text-[#183c2c] outline-none placeholder:text-[#7b9184] disabled:opacity-60" />
              <div className="flex items-center justify-between gap-3 px-1">
                <p className="text-[11px] leading-4 text-[#698073]">Invio per continuare · Maiusc+Invio per andare a capo</p>
                <button type="submit" disabled={!ready || busy || !draft.trim()}
                  data-testid="commercial-ai-native-submit"
                  className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-[#175640] px-4 text-sm font-bold text-white hover:bg-[#104632] disabled:cursor-not-allowed disabled:opacity-40">
                  Invia <span aria-hidden="true" className="ml-2">↑</span>
                </button>
              </div>
            </form>
            {handoffError ? <p role="alert" className="mx-auto mt-2 max-w-[740px] text-xs text-[#974621]">{handoffError} <Link className="underline" href={appRoutes.commercial.home + "?compose=1&method=ai#commercial-ai-intake"}>Apri Distinta</Link></p> : null}
            <p className="mx-auto mt-1 max-w-[800px] text-center text-[10px] leading-4 text-[#829187]">
              <span className="sm:hidden">Risposte da verificare · Nessun invio automatico.</span>
              <span className="hidden sm:inline">Le risposte possono richiedere verifica; cronologia solo in questa scheda, nessuna memoria persistente o invio automatico.</span>
            </p>
          </div>
        </div>

      </div>

      <dialog ref={previewDialog} onClose={() => previewTrigger.current?.focus()}
        aria-labelledby="commercial-ai-native-drawer-title"
        data-testid="commercial-ai-native-mobile-drawer"
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-[#cfdfd3] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl backdrop:bg-[#07251b]/50 lg:hidden">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id="commercial-ai-native-drawer-title" className="text-base font-semibold text-[#173f35]">Strumenti</h2>
          <button type="button" onClick={() => previewDialog.current?.close()} aria-label="Chiudi pannello"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#d4e2d8] text-lg text-[#175640]">×</button>
        </div>
        <ContextContent topic={activeTopic}/>
      </dialog>
    </section>
  );
}
