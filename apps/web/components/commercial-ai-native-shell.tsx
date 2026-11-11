"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { appRoutes } from "@/lib/routes";
import { classifyCommercialAiNativeTopic, type CommercialAiNativeTopic } from "@/lib/commercial-ai-native-ui";

type Turn = { id: number; question: string; topic: CommercialAiNativeTopic };
const MAX_CHARS = 12000;
const shortcuts = [
  "Chi produce tubo S355 Ø608?",
  "Preparami 24 barre Ø608×10 EN 10219, S355J2H, lunghezza 12 m.",
  "Qual è la differenza tra EN 10219 ed EN 10210?",
];
const contextCopy: Record<CommercialAiNativeTopic, { heading: string; description: string; link: string; label: string }> = {
  general: {
    heading: "Il tuo spazio di lavoro",
    description: "Scegli una richiesta. Gli strumenti industriali rimangono disponibili mentre costruiamo le risposte AI complete.",
    link: appRoutes.rfqHub.savedDistinte, label: "Apri le Distinte",
  },
  network: {
    heading: "Ricerca produttori",
    description: "In questa anteprima la ricerca AI delle capacità produttive non è ancora collegata. Usa il Network per verificare direttamente le schede aziendali.",
    link: appRoutes.network.directory, label: "Esplora il Network",
  },
  distinta: {
    heading: "Distinta in preparazione",
    description: "Il testo potrà essere trasferito alla chat Distinta esistente. Le righe proposte resteranno separate da quelle approvate.",
    link: appRoutes.rfqHub.savedDistinte, label: "Le tue Distinte",
  },
  knowledge: {
    heading: "Conoscenza tecnica",
    description: "Le risposte normative AI arriveranno con fonti e verifiche dedicate. La School resta disponibile per le schede e le guide pubblicate.",
    link: appRoutes.knowledge.workspace, label: "Consulta la School",
  },
};

function ContextContent({
  topic, canWrite, question, onStartDistinta,
}: {
  topic: CommercialAiNativeTopic;
  canWrite: boolean;
  question: string;
  onStartDistinta: (text: string) => void;
}) {
  const copy = contextCopy[topic];
  return (
    <div className="space-y-4" data-testid="commercial-ai-native-context-content">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#547b65]">Contesto attivo</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#173f35]">{copy.heading}</h2>
        <p className="mt-2 text-sm leading-6 text-[#51675b]">{copy.description}</p>
      </div>
      <div className="rounded-xl border border-[#dce8e0] bg-[#f8faf8] p-3">
        <p className="text-xs font-semibold text-[#264d3b]">Nessuna azione automatica</p>
        <p className="mt-1 text-xs leading-5 text-[#66786d]">
          Le ricerche non confermano stock o disponibilità. Nessuna Distinta o RFQ viene creata senza una tua azione esplicita.
        </p>
      </div>
      {topic === "distinta" && canWrite && question ? (
        <button type="button" onClick={() => onStartDistinta(question)}
          data-testid="commercial-ai-native-context-distinta"
          className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#175640] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#104632] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
          Analizza nella chat Distinta
        </button>
      ) : null}
      <Link href={copy.link}
        className="flex min-h-11 items-center justify-between rounded-xl border border-[#c9dbcf] bg-white px-3 py-2.5 text-sm font-semibold text-[#175640] hover:bg-[#eff7f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
        {copy.label} <span aria-hidden="true">↗</span>
      </Link>
      <div className="border-t border-[#e2ebe5] pt-4">
        <p className="text-xs font-semibold text-[#315641]">Attività commerciali</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <Link href={appRoutes.commercial.home + "?experience=classic"}
            className="rounded-lg border border-[#dce8e0] px-3 py-3 text-center font-medium text-[#315641] hover:bg-[#f3f8f4]">Scrivania</Link>
          <Link href={appRoutes.rfqHub.home}
            className="rounded-lg border border-[#dce8e0] px-3 py-3 text-center font-medium text-[#315641] hover:bg-[#f3f8f4]">Centro RFQ</Link>
        </div>
      </div>
    </div>
  );
}

/**
 * B is intentionally UI-only: no LLM call, no fake company matching, no
 * conversational persistence, no RFQ mutation. The single write-capable path
 * reuses the existing explicit Distinta AI intake in the same browser tab.
 */
export function CommercialAiNativeShell({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeTopic, setActiveTopic] = useState<CommercialAiNativeTopic>("general");
  const [handoffError, setHandoffError] = useState("");
  const nextId = useRef(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const previewTrigger = useRef<HTMLButtonElement>(null);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const threadEnd = useRef<HTMLDivElement>(null);

  useEffect(() => setReady(true), []);
  const latestQuestion = [...turns].reverse().find((turn) => turn.topic === "distinta")?.question || "";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    if (!ready || !question) return;
    const topic = classifyCommercialAiNativeTopic(question);
    setTurns((previous) => [...previous, { id: ++nextId.current, question, topic }]);
    setActiveTopic(topic);
    setDraft("");
    setHandoffError("");
    requestAnimationFrame(() => threadEnd.current?.scrollIntoView({ block: "nearest", behavior: "auto" }));
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
      className="min-w-0 overflow-hidden rounded-2xl border border-[#d5e3da] bg-white shadow-[0_14px_55px_-38px_rgba(13,63,41,0.3)] lg:rounded-[24px]">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-[#e2eae4] bg-[#fbfdfb] px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#175640] text-xl text-white">✦</span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4c7961]">Commerciale</p>
            <h1 className="truncate text-base font-semibold tracking-tight text-[#163b2c] sm:text-xl">Smart Steel Intelligence</h1>
          </div>
        </div>
        <nav className="flex items-center gap-2" aria-label="Accesso alle attività commerciali">
          <button type="button" ref={previewTrigger} onClick={openPreview}
            data-testid="commercial-ai-native-mobile-context"
            className="inline-flex min-h-11 items-center rounded-xl border border-[#d1e2d6] px-3 text-xs font-semibold text-[#175640] lg:hidden">
            Contesto
          </button>
          <Link href={appRoutes.commercial.home + "?experience=classic"} data-testid="commercial-ai-native-legacy"
            className="inline-flex min-h-11 items-center rounded-xl border border-[#d1e2d6] bg-white px-3 text-xs font-semibold text-[#175640] hover:bg-[#eff7f1]">
            Attività <span aria-hidden="true" className="ml-1">↗</span>
          </Link>
        </nav>
      </header>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <div className="flex min-h-[min(75dvh,740px)] min-w-0 flex-col bg-white">
          <div role="log" aria-label="Messaggi della conversazione" aria-live="polite" aria-relevant="additions"
            data-testid="commercial-ai-native-thread"
            className="min-w-0 flex-1 space-y-5 overflow-y-auto px-4 py-7 sm:px-8 sm:py-9">
            {turns.length === 0 ? (
              <div className="mx-auto flex max-w-[680px] flex-col items-start pt-3 sm:pt-9" data-testid="commercial-ai-native-intro">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf4ee] text-2xl text-[#175640]" aria-hidden="true">✦</span>
                <h2 className="mt-6 text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-tight tracking-[-0.035em] text-[#173f35]">
                  Di cosa hai bisogno oggi?
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-[#506c5d]">
                  Scrivi una domanda sull’acciaio, cerca un produttore oppure prepara una Distinta. Gli strumenti commerciali sono a portata di conversazione.
                </p>
                <div className="mt-7 grid w-full gap-2 sm:grid-cols-3">
                  {shortcuts.map((shortcut, index) => (
                    <button type="button" key={shortcut} onClick={() => chooseShortcut(shortcut)}
                      className="min-h-20 rounded-xl border border-[#d8e6dd] bg-[#fbfdfb] px-3 py-3 text-left text-xs font-medium leading-5 text-[#2c5640] hover:border-[#8bb7a0] hover:bg-[#f0f8f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#6a8877]">
                        {index === 0 ? "Produttori" : index === 1 ? "Distinta" : "Norme"}
                      </span>
                      {shortcut}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-[740px] space-y-6">
                {turns.map((turn) => (
                  <div key={turn.id} className="space-y-4" data-testid="commercial-ai-native-turn">
                    <div className="flex justify-end">
                      <p className="max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#eaf4ee] px-4 py-3 text-sm leading-6 text-[#173f35]">
                        {turn.question}
                      </p>
                    </div>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#175640] text-white" aria-hidden="true">✦</span>
                      <div className="min-w-0 flex-1 rounded-2xl border border-[#e1eae4] bg-[#fbfdfb] p-3 sm:p-4">
                        {turn.topic === "network" ? (
                          <>
                            <p className="text-sm leading-6 text-[#2a4b3a]">La ricerca conversazionale dei produttori non è ancora collegata. Puoi consultare le aziende nel Network: una scheda censita non dimostra la capacità sulla misura richiesta.</p>
                            <Link href={appRoutes.network.directory} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#175640] underline underline-offset-4">Apri ricerca Network ↗</Link>
                          </>
                        ) : turn.topic === "knowledge" ? (
                          <>
                            <p className="text-sm leading-6 text-[#2a4b3a]">Le risposte tecniche AI con fonti saranno disponibili nella fase successiva. Per ora puoi consultare le guide della School senza ricevere informazioni normative non verificate.</p>
                            <Link href={appRoutes.knowledge.workspace} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#175640] underline underline-offset-4">Apri School ↗</Link>
                          </>
                        ) : turn.topic === "distinta" && canWrite ? (
                          <>
                            <p className="text-sm leading-6 text-[#2a4b3a]">Posso passare questo testo al modulo Distinta già operativo. L’analisi AI proporrà articoli da verificare; nessun salvataggio o invio a fornitori sarà automatico.</p>
                            <button type="button" onClick={() => startDistinta(turn.question)}
                              data-testid="commercial-ai-native-open-distinta"
                              className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#175640] px-4 text-sm font-semibold text-white hover:bg-[#104632]">
                              Analizza nella chat Distinta ↗
                            </button>
                          </>
                        ) : turn.topic === "distinta" ? (
                          <p className="text-sm leading-6 text-[#2a4b3a]">Il tuo profilo è in sola lettura: puoi consultare le Distinte esistenti, ma non crearne o inviarne di nuove.</p>
                        ) : (
                          <p className="text-sm leading-6 text-[#2a4b3a]">Questo è il nuovo spazio conversazionale in anteprima. L’assistente generale sarà attivato nelle prossime fasi; per ora puoi scegliere una Distinta, il Network o la School attraverso gli strumenti disponibili.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={threadEnd} aria-hidden="true"/>
              </div>
            )}
          </div>

          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 border-t border-[#e4ebe6] bg-white px-3 py-3 sm:px-6 md:bottom-0">
            <form onSubmit={submit} data-testid="commercial-ai-native-form"
              aria-label="Scrivi una richiesta per Smart Steel Intelligence"
              className="mx-auto max-w-[740px] rounded-2xl border border-[#bdd5c6] bg-white p-2 shadow-[0_5px_20px_-14px_rgba(16,65,43,0.25)] focus-within:border-[#175640]">
              <label htmlFor="commercial-ai-native-input" className="sr-only">Domanda o richiesta commerciale</label>
              <textarea id="commercial-ai-native-input" ref={composerRef} rows={2} maxLength={MAX_CHARS}
                value={draft} onChange={(event) => setDraft(event.target.value)}
                onKeyDown={keyDown} disabled={!ready}
                placeholder="Chiedi qualcosa sui tubi, sui produttori o prepara una Distinta…"
                className="min-h-14 max-h-40 w-full min-w-0 resize-y rounded-lg bg-white px-2 py-1.5 text-sm leading-6 text-[#183c2c] outline-none placeholder:text-[#7b9184] disabled:opacity-60" />
              <div className="flex items-center justify-between gap-3 px-1">
                <p className="text-[11px] leading-4 text-[#698073]">Invio per continuare · Maiusc+Invio per andare a capo</p>
                <button type="submit" disabled={!ready || !draft.trim()}
                  data-testid="commercial-ai-native-submit"
                  className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-[#175640] px-4 text-sm font-bold text-white hover:bg-[#104632] disabled:cursor-not-allowed disabled:opacity-40">
                  Invia <span aria-hidden="true" className="ml-2">↑</span>
                </button>
              </div>
            </form>
            {handoffError ? <p role="alert" className="mx-auto mt-2 max-w-[740px] text-xs text-[#974621]">{handoffError} <Link className="underline" href={appRoutes.commercial.home + "?compose=1&method=ai#commercial-ai-intake"}>Apri Distinta</Link></p> : null}
            <p className="mx-auto mt-1 max-w-[740px] text-center text-[10px] leading-4 text-[#71857a]">
              Anteprima UI: nessuna risposta AI generalista o cronologia persistente. Il testo resta in questa schermata fino al trasferimento esplicito.
            </p>
          </div>
        </div>

        <aside data-testid="commercial-ai-native-desktop-context" aria-label="Pannello contestuale"
          className="hidden min-w-0 border-l border-[#e1ebe4] bg-[#f9fcfa] px-5 py-7 lg:block">
          <ContextContent topic={activeTopic} canWrite={canWrite} question={latestQuestion} onStartDistinta={startDistinta}/>
        </aside>
      </div>

      <dialog ref={previewDialog} onClose={() => previewTrigger.current?.focus()}
        aria-labelledby="commercial-ai-native-drawer-title"
        data-testid="commercial-ai-native-mobile-drawer"
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-[#cfdfd3] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl backdrop:bg-[#07251b]/50 lg:hidden">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id="commercial-ai-native-drawer-title" className="text-base font-semibold text-[#173f35]">Pannello contestuale</h2>
          <button type="button" onClick={() => previewDialog.current?.close()} aria-label="Chiudi pannello"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#d4e2d8] text-lg text-[#175640]">×</button>
        </div>
        <ContextContent topic={activeTopic} canWrite={canWrite} question={latestQuestion} onStartDistinta={startDistinta}/>
      </dialog>
    </section>
  );
}
