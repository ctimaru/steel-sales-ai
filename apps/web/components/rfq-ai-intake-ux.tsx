"use client";

import Link from "next/link";
import { useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { analyzeRfqAiFreeText } from "@/app/(workspace)/rfq-hub/distinta/ai-actions";
import { RfqAiTextReview } from "@/components/rfq-ai-text-review";
import type { RfqAiTextDraftResult } from "@/lib/rfq-ai-free-text";
import type { BuyerDistintaDraftLine } from "@/lib/buyer-distinta";

import { appRoutes } from "@/lib/routes";

/**
 * RFQAI2 is presentation only. No AI calls, file reads/uploads, mailbox
 * subscriptions or writes happen here. RFQAI3+ will attach authorized actions.
 */
export type RfqAiIntakeMode = "manual" | "text" | "file" | "email";
const MAX_TEXT_CHARS = 12_000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".pdf", ".eml"] as const;
const options: { mode: RfqAiIntakeMode; name: string; meta: string }[] = [
  { mode: "manual", name: "Configura", meta: "Subito disponibile" },
  { mode: "text", name: "Scrivi o incolla", meta: "Estrazione AI" },
  { mode: "file", name: "Carica file", meta: "RFQAI4–5 · AI" },
  { mode: "email", name: "Email", meta: "RFQAI9–10" },
];

export function RfqAiIntakeUx({
  mode, onModeChange, workspace, authenticated, children, onInsertTextLines,
}: {
  mode: RfqAiIntakeMode;
  onModeChange: (mode: RfqAiIntakeMode) => void;
  /** Can only be true on the route guarded by requireWorkspaceWriteRole. */
  workspace: boolean;
  authenticated: boolean;
  onInsertTextLines: (lines: BuyerDistintaDraftLine[]) => void;
  children: ReactNode;
}) {
  const panelId = useId();
  const [textDraft, setTextDraft] = useState("");
  const [textPending, setTextPending] = useState(false);
  const [textError, setTextError] = useState("");
  const [textResult, setTextResult] = useState<RfqAiTextDraftResult | null>(null);
  const extractionVersion = useRef(0);
  async function analyzeText() {
    if (textPending || !workspace || !textDraft.trim()) return;
    const version = ++extractionVersion.current;
    setTextPending(true);
    setTextError("");
    setTextResult(null);
    try {
      const response = await analyzeRfqAiFreeText(textDraft);
      if (extractionVersion.current === version) {
        if (response.ok) setTextResult(response.result);
        else setTextError(response.error);
      }
    } catch {
      if (extractionVersion.current === version) setTextError("Non è stato possibile analizzare la richiesta. Nessun dato è stato importato.");
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

  return (
    <section className="rfqai2-intake" aria-label="Modalità di creazione distinta">
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

      <div id={panelId} className="rfqai2-mode-panel">
        <div className="rfqai2-manual" hidden={mode !== "manual"}>
          {children}
        </div>

        {mode !== "manual" && !workspace ? (
          <div className="rfqai2-access-panel">
            <p className="rfqai2-panel-kicker">Smart Steel Sales · AI privata</p>
            <h4>Trasforma una richiesta in distinta, senza ricopiarla</h4>
            <p>
              Testi, documenti ed email saranno interpretati in una bozza verificabile
              nel RFQ Hub aziendale. La funzione automatica è in preparazione e non è
              ancora attiva; la compilazione manuale resta gratuita.
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
            <div className="rfqai2-panel-heading">
              <div>
                <p className="rfqai2-panel-kicker">RFQAI3 · Free Text Intelligence</p>
                <h4>Scrivi o incolla la richiesta commerciale</h4>
              </div>
              <span className="rfqai2-panel-status">Revisione obbligatoria</span>
            </div>
            <label htmlFor="rfqai2-text-input" className="rfqai2-field-label">
              Testo della richiesta
            </label>
            <textarea
              id="rfqai2-text-input"
              maxLength={MAX_TEXT_CHARS}
              rows={7}
              value={textDraft}
              onChange={(event) => { extractionVersion.current += 1; setTextDraft(event.target.value); setTextResult(null); setTextError(""); }}
              placeholder={"Es. Mi servono 30 barre da 12 m di tubo quadro 100×100×5 S355J2H EN 10219 e 120 m di tubo tondo 60,3×3 EN 10210."}
              spellCheck={false}
              className="rfqai2-textarea"
            />
            <div className="rfqai2-field-footer">
              <span>Puoi incollare più articoli e condizioni commerciali.</span>
              <span>{textDraft.length.toLocaleString("it-IT")} / {MAX_TEXT_CHARS.toLocaleString("it-IT")} caratteri</span>
            </div>
            <div className="rfqai2-input-actions">
              <button type="button" disabled={!textDraft || textPending}
                onClick={() => { extractionVersion.current += 1; setTextDraft(""); setTextResult(null); setTextError(""); }}
                className="rfqai2-secondary-action">
                Cancella testo
              </button>
              <button type="button" disabled={textPending || textDraft.trim().length < 12}
                onClick={analyzeText} className="rfqai2-primary-link">
                {textPending ? "Analisi in corso…" : "Analizza la richiesta con AI"}
              </button>
            </div>
            {textError ? <p role="alert" className="rfqai3-warning">{textError}</p> : null}
            {textResult ? (
              <RfqAiTextReview
                result={textResult}
                onDismiss={() => setTextResult(null)}
                onInsert={(items) => {
                  onInsertTextLines(items);
                  setTextResult(null);
                  setTextDraft("");
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
