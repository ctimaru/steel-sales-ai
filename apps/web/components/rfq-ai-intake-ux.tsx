"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { consumeCommercialAiTextHandoff } from "@/lib/commercial-ai-intake-handoff";
import { analyzeRfqAiFreeText } from "@/app/(workspace)/rfq-hub/distinta/ai-actions";
import { RfqAiTextReview } from "@/components/rfq-ai-text-review";
import { CommercialRfqConversation, type CommercialRfqTurn } from "@/components/commercial-rfq-conversation";
import type { RfqAiTextDraftResult } from "@/lib/rfq-ai-free-text";
import type { BuyerDistintaDraftLine } from "@/lib/buyer-distinta";
import { parseCommercialRfqLineCorrection, type CommercialRfqLineCorrection } from "@/lib/commercial-rfq-line-correction";

import { appRoutes } from "@/lib/routes";

/**
 * RFQAI2 introduced the four-mode UI. RFQAI3 activates only the private
 * text-mode server action after an explicit click; file/email remain inert.
 * No automatic RFQ save/dispatch occurs from this client component.
 */
export type RfqAiIntakeMode = "manual" | "text" | "file" | "email";
const MAX_TEXT_CHARS = 12_000;
const SAMPLE_RFQ_TEXT = "Cerco 40 tubi quadri 100×100×5 S355J2H EN 10219, lunghezza 6 m ciascuno.";
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".pdf", ".eml"] as const;
const options: { mode: RfqAiIntakeMode; name: string; meta: string }[] = [
  { mode: "manual", name: "Configura", meta: "Subito disponibile" },
  { mode: "text", name: "Scrivi o incolla", meta: "Estrazione AI" },
  { mode: "file", name: "Carica file", meta: "RFQAI4–5 · AI" },
  { mode: "email", name: "Email", meta: "RFQAI9–10" },
];

export function RfqAiIntakeUx({
  mode, focused = false, onModeChange, workspace, authenticated, children, onInsertTextLines, onPreviewChange,
}: {
  mode: RfqAiIntakeMode;
  focused?: boolean;
  onModeChange: (mode: RfqAiIntakeMode) => void;
  /** Can only be true on the route guarded by requireWorkspaceWriteRole. */
  workspace: boolean;
  authenticated: boolean;
  onInsertTextLines: (lines: BuyerDistintaDraftLine[]) => boolean;
  /** UI-only suggestions; never persisted before explicit human approval. */
  onPreviewChange?: (result: RfqAiTextDraftResult | null) => void;
  children: ReactNode;
}) {
  const panelId = useId();
  const [textDraft, setTextDraft] = useState("");
  const [textPending, setTextPending] = useState(false);
  const [textError, setTextError] = useState("");
  const [textResult, setTextResult] = useState<RfqAiTextDraftResult | null>(null);
  // UX2.B transcript is private in-memory UI state; the server action sees
  // only the currently submitted message, never the conversation history.
  const [conversationTurns, setConversationTurns] = useState<CommercialRfqTurn[]>([]);
  const [pendingCorrection, setPendingCorrection] = useState<CommercialRfqLineCorrection | null>(null);
  const correctionSerial = useRef(0);
  const conversationSerial = useRef(0);
  function appendConversationTurn(role: CommercialRfqTurn["role"], content: string, state?: CommercialRfqTurn["state"]) {
    const id = ++conversationSerial.current;
    setConversationTurns((previous) => [...previous.slice(-48), { id, role, content, state }]);
  }
  const extractionVersion = useRef(0);
  useEffect(() => {
    if (!workspace || mode !== "text") return;
    const draft = consumeCommercialAiTextHandoff(MAX_TEXT_CHARS);
    if (!draft) return;
    extractionVersion.current += 1;
    setTextDraft(draft);
    setTextResult(null);
    setPendingCorrection(null);
    onPreviewChange?.(null);
    setTextError("");
  }, [workspace, mode]);
  async function analyzeText() {
    const submitted = textDraft.trim();
    if (textPending || !workspace || submitted.length < 3) return;
    if (textResult && focused) {
      // The existing proposals remain mounted; only an explicit numbered
      // correction may change a pending row. No history is sent to the model.
      appendConversationTurn("user", submitted);
      const correction = parseCommercialRfqLineCorrection(submitted, textResult.candidates.length);
      if (!correction.ok) {
        appendConversationTurn("assistant", correction.reason);
        return;
      }
      const target = textResult.candidates[correction.index];
      setPendingCorrection({
        serial: ++correctionSerial.current,
        candidateId: target.candidateId,
        patch: correction.patch,
      });
      setTextDraft("");
      appendConversationTurn("assistant", correction.confirmation +
        ". Ricontrolla i dati e conferma esplicitamente la riga: non è ancora in Distinta.");
      return;
    }
    if (textResult) return;
    if (focused && submitted.length < 12) {
      // A bare short measure such as "100x100x5" should not be a dead-end:
      // ask for missing context locally rather than guessing a section or
      // sending text that the validated AI server action cannot accept.
      appendConversationTurn("user", submitted);
      appendConversationTurn("assistant",
        "Aggiungi qualche dettaglio per preparare la distinta: tipo di tubo, quantità e lunghezza delle barre. " +
        "Puoi completare il testo qui sotto; nessuna misura è stata ancora confermata.");
      return;
    }
    if (submitted.length < 12) return;
    const version = ++extractionVersion.current;
    if (focused) appendConversationTurn("user", submitted);
    setTextPending(true);
    setTextError("");
    setPendingCorrection(null);
    setTextResult(null);
    onPreviewChange?.(null);
    try {
      // IMPORTANT: no chat history or candidate is sent as context; each
      // message is a separate explicit request to the existing AI parser.
      const response = await analyzeRfqAiFreeText(submitted);
      if (extractionVersion.current === version) {
        if (response.ok) {
          setTextResult(response.result);
          // The submitted source stays visible in the user turn and cited review;
          // free the composer for a new, explicitly numbered correction.
          if (focused) setTextDraft("");
          onPreviewChange?.(response.result);
          if (focused) {
            const count = response.result.candidates.length;
            appendConversationTurn("assistant", count
              ? "Ho individuato " + count + (count === 1 ? " articolo. Verifica i dettagli qui sotto prima di aggiungerlo alla Distinta." : " articoli. Verifica i dettagli qui sotto prima di aggiungerli alla Distinta.")
              : "Non ho trovato articoli sufficientemente identificati. Puoi integrare la richiesta e riprovare.", "result");
          }
        } else {
          setTextError(response.error);
          if (focused) appendConversationTurn("assistant", "Non sono riuscito a interpretare la richiesta. Controlla i dati e riprova.", "error");
        }
      }
    } catch {
      if (extractionVersion.current === version) {
        setTextError("Non è stato possibile analizzare la richiesta. Nessun dato è stato importato.");
        if (focused) appendConversationTurn("assistant", "L'analisi non è disponibile. Puoi riprovare senza perdere il testo.", "error");
      }
    } finally {
      setTextPending(false);
    }
  }
  const [selectedFile, setSelectedFile] = useState<{ name: string; bytes: number } | null>(null);
  const [fileError, setFileError] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileError("");
    setSelectedFile(null);
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((allowed) => allowed === extension)) {
      setFileError("Formato non supportato: usa Excel, PDF o EML.");
    } else if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      setFileError("Seleziona un file non vuoto e di massimo 25 MB.");
    } else {
      // Only filename and byte count retained. File content is NEVER read or sent.
      setSelectedFile({ name: file.name, bytes: file.size });
    }
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    setFileError("");
    setFileInputKey((key) => key + 1);
  }

  function updateFocusedDraft(next: string) {
    // Editing a correction must not discard 5–10 pending AI proposals.
    if (textResult) { setTextDraft(next); setTextError(""); return; }
    extractionVersion.current += 1;
    setTextDraft(next);
    setTextResult(null);
    onPreviewChange?.(null);
    setTextError("");
  }

  // The focused Commerciale route renders a real conversational surface.
  // Keep the four-mode legacy JSX below for manual/public RFQ Hub consumers.
  if (focused && workspace) {
    return (
      <CommercialRfqConversation
        mode={mode}
        onModeChange={onModeChange}
        turns={conversationTurns}
        value={textDraft}
        onChange={updateFocusedDraft}
        onAnalyze={analyzeText}
        onClear={() => { if (textResult) setTextDraft(""); else updateFocusedDraft(""); }}
        onSample={() => updateFocusedDraft(SAMPLE_RFQ_TEXT)}
        pending={textPending}
        error={textError}
        hasProposals={Boolean(textResult)}
        manualTools={children}
        review={textResult ? (
          <RfqAiTextReview
            result={textResult}
            correction={pendingCorrection}
            onCandidatesChange={(updated) => {
              setTextResult((current) => current ? { ...current, candidates: updated } : null);
              onPreviewChange?.({ ...textResult, candidates: updated });
            }}
            onDismiss={() => {
              setTextResult(null);
              setPendingCorrection(null);
              onPreviewChange?.(null);
              appendConversationTurn("assistant", "Proposte scartate. Puoi modificare la richiesta e analizzarla di nuovo.");
            }}
            onInsert={(items) => {
              if (!onInsertTextLines(items)) return false;
              setTextResult(null);
              setPendingCorrection(null);
              onPreviewChange?.(null);
              setTextDraft("");
              appendConversationTurn("assistant", "Ho aggiunto " + items.length +
                (items.length === 1 ? " articolo verificato alla Distinta a destra." : " articoli verificati alla Distinta a destra.") +
                " Puoi continuare aggiungendo altre misure, oppure salvare la Distinta privata.", "accepted");
              return true;
            }}
          />
        ) : null}
      />
    );
  }

  return (
    <section className="rfqai2-intake" aria-label="Modalità di creazione distinta">
      {!focused ? (<>
      <div className="rfqai2-intake-heading">
        <div>
          <p className="rfqai2-eyebrow">Un solo strumento · quattro ingressi</p>
          <h3 className="rfqai2-intake-title">Come vuoi creare la distinta?</h3>
        </div>
        <span className="rfqai2-intake-note">Un’unica anteprima modificabile</span>
      </div>

      <div id="rfqai2-intake-modes" className="rfqai2-mode-grid" role="group" aria-label="Scegli la modalità di inserimento">
        {options.map((option) => (
          <button
            key={option.mode}
            type="button"
            aria-pressed={mode === option.mode}
            aria-controls={panelId}
            onClick={() => onModeChange(option.mode)}
            className="rfqai2-mode-button"
          >
            <strong>{option.name}</strong>
            <span>{option.meta}</span>
          </button>
        ))}
      </div>

      </>) : (
        <div role="group" aria-label="Metodo di preparazione della distinta" className="flex justify-end px-2 pt-1" data-testid="commercial-ai-focused-modes">
          <button type="button" aria-pressed={mode === "manual"}
            onClick={() => onModeChange(mode === "manual" ? "text" : "manual")}
            className="inline-flex min-h-9 items-center text-xs font-semibold text-[#175640] underline underline-offset-4">
            {mode === "manual" ? "Torna all’analisi del testo" : "Preferisci configurare manualmente?"}
          </button>
        </div>
      )}
      <div id={panelId} className="rfqai2-mode-panel">
        <div className="rfqai2-manual" hidden={mode !== "manual"}>
          {children}
        </div>

        {mode !== "manual" && !workspace ? (
          <div className="rfqai2-access-panel">
            <p className="rfqai2-panel-kicker">Smart Steel Sales · AI privata</p>
            <h4>Trasforma una richiesta in distinta, senza ricopiarla</h4>
            <p>
              Nel RFQ Hub aziendale puoi già preparare una distinta da testo libero con AI,
              verificando ogni articolo prima di inserirlo. L’importazione da file e il
              collegamento email arriveranno nei prossimi rilasci. La compilazione manuale
              rimane gratuita.
            </p>
            <div className="rfqai2-access-actions">
              {authenticated ? (
                <Link className="rfqai2-primary-link" href={appRoutes.rfqHub.createDistinta}>
                  Apri RFQ Hub aziendale →
                </Link>
              ) : (
                <>
                  <Link className="rfqai2-primary-link" href="/register">
                    Registra la tua azienda →
                  </Link>
                  <Link className="rfqai2-secondary-link" href="/login?next=%2Frfq-hub%2Fdistinta">
                    Hai già un account? Accedi
                  </Link>
                </>
              )}
            </div>
            <p className="rfqai2-panel-disclaimer">L’accesso all’AI richiederà un’azienda attiva e i permessi appropriati.</p>
          </div>
        ) : null}

        {mode === "text" && workspace ? (
          <div className="rfqai2-capture-panel" aria-label="Preparazione testo per estrazione AI">
            {!focused ? (
              <div className="rfqai2-panel-heading">
                <div>
                  <p className="rfqai2-panel-kicker">Smart Steel Sales · Assistente commerciale</p>
                  <h4>{textResult ? "Completiamo insieme la tua richiesta" : "Ciao, dimmi quale materiale stai cercando"}</h4>
                </div>
                <span className="rfqai2-panel-status">Revisione obbligatoria</span>
              </div>
            ) : null}
            <details open={!textResult} className="rounded-xl border border-[#cbded3] bg-white p-3" data-rfqai-original-request>
              <summary className="cursor-pointer text-sm font-semibold text-[#164b35]">
                {textResult ? "Visualizza o modifica la richiesta originale" : "Scrivi o incolla la richiesta"}
              </summary>
              <div className={focused ? "mt-1" : "mt-3"}>
            <label htmlFor="rfqai2-text-input" className={focused ? "sr-only" : "rfqai2-field-label"}>
              Testo della richiesta
            </label>
            <textarea
              id="rfqai2-text-input"
              maxLength={MAX_TEXT_CHARS}
              rows={focused ? 3 : 7}
              style={focused ? { minHeight: "6rem" } : undefined}
              value={textDraft}
              onChange={(event) => { extractionVersion.current += 1; setTextDraft(event.target.value); setTextResult(null); onPreviewChange?.(null); setTextError(""); }}
              placeholder={"Es. Mi servono 30 barre da 12 m di tubo quadro 100×100×5 S355J2H EN 10219 e 120 m di tubo tondo 60,3×3 EN 10210."}
              spellCheck={false}
              className="rfqai2-textarea"
            />
            {(!focused || !textDraft.trim()) ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[#56675f]">Non sai come iniziare? Prova una richiesta tipo.</span>
              <button type="button" className="rfqai2-secondary-action"
                disabled={textPending}
                onClick={() => { extractionVersion.current += 1; setTextDraft(SAMPLE_RFQ_TEXT); setTextResult(null); onPreviewChange?.(null); setTextError(""); }}>
                Inserisci esempio
              </button>
            </div>
            ) : null}
            <div className={focused ? "sr-only" : "rfqai2-field-footer"}>
              <span>Puoi incollare più articoli e condizioni commerciali.</span>
              <span>{textDraft.length.toLocaleString("it-IT")} / {MAX_TEXT_CHARS.toLocaleString("it-IT")} caratteri</span>
            </div>
            <div className={focused ? "flex flex-wrap items-center gap-2 pt-2" : "rfqai2-input-actions"}>
              <button type="button" disabled={textPending || textDraft.trim().length < 12}
                onClick={analyzeText} className={focused ? "rfqai2-primary-link min-h-11 w-full sm:w-auto sm:flex-1" : "rfqai2-primary-link"}>
                {textPending ? "Analisi in corso…" : "Analizza la richiesta con AI"}
              </button>
              <button type="button" disabled={!textDraft || textPending}
                onClick={() => { extractionVersion.current += 1; setTextDraft(""); setTextResult(null); onPreviewChange?.(null); setTextError(""); }}
                className={focused ? "min-h-9 px-2 text-xs font-semibold text-[#175640] underline underline-offset-4" : "rfqai2-secondary-action"}>
                Cancella testo
              </button>
            </div>
            {textError ? <p role="alert" className="rfqai3-warning">{textError}</p> : null}
              </div>
            </details>
            {textResult ? (
              <RfqAiTextReview
                result={textResult}
                onDismiss={() => { setTextResult(null); onPreviewChange?.(null); }}
                onInsert={(items) => {
                  if (!onInsertTextLines(items)) return false;
                  setTextResult(null);
                  onPreviewChange?.(null);
                  setTextDraft("");
                  return true;
                }}
              />
            ) : null}
            <p role="status" className="rfqai2-privacy-note">
              Il testo viene inviato al servizio AI solo quando premi Analizza.
              L’AI prepara proposte, non salva né invia RFQ. Ogni articolo richiede una conferma esplicita.
            </p>
          </div>
        ) : null}

        {mode === "file" && workspace ? (
          <div className="rfqai2-capture-panel" aria-label="Preparazione documento per estrazione AI">
            <div className="rfqai2-panel-heading">
              <div>
                <p className="rfqai2-panel-kicker">RFQAI4–5 · Prossima fase</p>
                <h4>Carica una richiesta da Excel o documento</h4>
              </div>
              <span className="rfqai2-panel-status">Selezione locale</span>
            </div>
            <label htmlFor="rfqai2-file-input" className="rfqai2-field-label">
              Seleziona un file
            </label>
            <input
              key={fileInputKey}
              id="rfqai2-file-input"
              type="file"
              accept=".xlsx,.xls,.pdf,.eml"
              onChange={chooseFile}
              className="rfqai2-file-input"
            />
            <p className="rfqai2-field-helper">Excel (.xlsx, .xls), PDF o email (.eml) · massimo 25 MB. Documenti Word e PDF scansiti saranno valutati nei blocchi successivi.</p>
            {fileError ? <p role="alert" className="rfqai2-file-error">{fileError}</p> : null}
            {selectedFile ? (
              <div className="rfqai2-file-selection" role="status">
                <div className="rfqai2-file-meta">
                  <strong>{selectedFile.name}</strong>
                  <span>{(selectedFile.bytes / (1024 * 1024)).toLocaleString("it-IT", { maximumFractionDigits: 2 })} MB · selezione locale</span>
                </div>
                <button type="button" onClick={clearSelectedFile} className="rfqai2-secondary-action">
                  Rimuovi
                </button>
              </div>
            ) : null}
            <button type="button" className="rfqai2-disabled-action" disabled>
              Estrai articoli dal file · RFQAI4–5
            </button>
            <p role="status" className="rfqai2-privacy-note">
              Il file non viene caricato sul server né memorizzato. Questa selezione prepara l’interfaccia
              per l’importazione RFQ, separata dagli upload della memoria commerciale.
            </p>
          </div>
        ) : null}

        {mode === "email" && workspace ? (
          <div className="rfqai2-capture-panel" aria-label="Informazioni sul futuro intake email">
            <div className="rfqai2-panel-heading">
              <div>
                <p className="rfqai2-panel-kicker">RFQAI9–10 · Prossima fase</p>
                <h4>Ricevi automaticamente le richieste</h4>
              </div>
              <span className="rfqai2-panel-status">Non attivo</span>
            </div>
            <p className="rfqai2-email-copy">
              Prevediamo un indirizzo di inoltro dedicato alla tua azienda e, successivamente,
              il collegamento autorizzato di caselle email. Le richieste diventeranno bozze
              private da controllare prima di creare qualsiasi RFQ.
            </p>
            <p className="rfqai2-privacy-note">
              Nessuna casella è collegata, nessuna email viene letta e non è stato attivato
              alcun inoltro automatico.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
