"use client";

import { guidedTubeToBuyerLine } from "@/lib/buyer-guided-commercial-line";

import Link from "next/link";
import { BuyerTubeGuidedCreator } from "@/components/buyer-tube-guided-creator";
import { guidedTubeMassKgM, guidedTubeMeasurement,  type GuidedTubeDraft } from "@/lib/buyer-tube-guidance";
import { emptyBuyerDocumentRequirements, formatBuyerDocumentRequirements, type BuyerDistintaDocumentRequirements } from "@/lib/buyer-distinta-documents";
import { useRouter } from "next/navigation";
import { appRoutes } from "@/lib/routes";
import {
  buyerDraftKey, parseBuyerSessionDraft, serializeBuyerSessionDraft,
  type BuyerSessionDraft,
} from "@/lib/buyer-distinta-session-draft";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  createBuyerRfqCampaign,
  saveBuyerDistinta,
  sendBuyerDistinta,
} from "@/app/(public)/distinta/actions";
import {
  buildBuyerDistintaHtml,
  buildBuyerDistintaPlainText,
  calculateBuyerDistintaLine,
  calculateBuyerDistintaTotals,
  type BuyerDistintaDraftLine,
  type BuyerQuantityMode,
} from "@/lib/buyer-distinta";
import {
  buyerTubeFamilyLabels,
  searchBuyerDistintaCatalog,
  type BuyerDistintaCatalogOption,
} from "@/lib/buyer-distinta-catalog";

function blankLine(id: string): BuyerDistintaDraftLine {
  return {
    id,
    description: "",
    standard: "",
    grade: "",
    finish: "",
    quantityMode: "bars",
    quantity: "",
    barLengthM: "12",
    weightKgM: "",
    targetEurT: "",
    note: "",
  };
}

function newLineId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "line-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

function isUntouchedLine(line: BuyerDistintaDraftLine) {
  return !line.description.trim() && !line.weightKgM.trim() &&
    !line.quantity.trim() && !line.standard.trim() && !line.grade.trim() &&
    !line.finish.trim() && !line.targetEurT.trim() && !line.note.trim();
}

function formatNumber(value: number | null, digits: number) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function BuyerDistintaBuilder({
  authenticated,
  emailConfigured,
  catalogOptions,
  workspace = false,
  userId = null,
}: {
  authenticated: boolean;
  emailConfigured: boolean;
  catalogOptions: BuyerDistintaCatalogOption[];
  workspace?: boolean;
  userId?: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("Richiesta di offerta");
  const [documents, setDocuments] = useState<BuyerDistintaDocumentRequirements>(emptyBuyerDocumentRequirements);
  const [previewDraft, setPreviewDraft] = useState<GuidedTubeDraft | null>(null);
  const [wizardRestoreSerial, setWizardRestoreSerial] = useState(0);
  const [quickQuery, setQuickQuery] = useState("");
  const [compactMode, setCompactMode] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [editingRows, setEditingRows] = useState<Record<string, boolean>>({});
  const focusQuantityId = useRef<string | null>(null);
  const [selectedCatalog, setSelectedCatalog] = useState<Record<string, { family: string; sizeKey: string; optionId: string }>>({});
  const [guidedSpecsByLine, setGuidedSpecsByLine] = useState<Record<string, GuidedTubeDraft>>({});
  const [lines, setLines] = useState<BuyerDistintaDraftLine[]>([
    blankLine("line-1"),
  ]);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [recipientInput, setRecipientInput] = useState("");
  const [emailSubject, setEmailSubject] = useState("Richiesta di offerta");
  const [emailMessage, setEmailMessage] = useState(
    "Buongiorno,\nvi chiediamo cortesemente la vostra migliore offerta per i materiali indicati nella distinta seguente.",
  );
  const [sendMessage, setSendMessage] = useState<string | null>(null);
  const [rfqMessage, setRfqMessage] = useState<string | null>(null);
  // Only a same-tab session draft; no cookie, URL payload, remote autosave or email data.
  const [draftReady, setDraftReady] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<{ key: string; draft: BuyerSessionDraft } | null>(null);
  const draftKey = buyerDraftKey(authenticated ? userId : null);
  const [savePending, startSaveTransition] = useTransition();
  const [sendPending, startSendTransition] = useTransition();
  const [rfqPending, startRfqTransition] = useTransition();

  const calculated = useMemo(
    () => lines.map(calculateBuyerDistintaLine),
    [lines],
  );
  const totals = useMemo(
    () => calculateBuyerDistintaTotals(calculated),
    [calculated],
  );
  // Only the initial reusable empty placeholder is excluded from progress.
  // Explicitly added blank rows must still block copy until they are completed.
  const initialEmptyRow = lines.length === 1 && isUntouchedLine(lines[0]) && !editingRows[lines[0].id];
  const activeLineCount = initialEmptyRow ? 0 : lines.length;
  const allComplete =
    calculated.length > 0 && calculated.every((line) => line.complete);
  const quickMatches = useMemo(
    () => searchBuyerDistintaCatalog(catalogOptions, quickQuery, 8),
    [catalogOptions, quickQuery],
  );

  useEffect(() => {
    try {
      // After authentication prefer the guest handoff. Never silently load one
      // browser user's commercial text into a different account.
      const candidates = authenticated
        ? [buyerDraftKey(null), draftKey]
        : [draftKey];
      for (const key of candidates) {
        const raw = window.sessionStorage.getItem(key);
        const recovered = parseBuyerSessionDraft(raw);
        if (recovered) {
          setRestoreCandidate({ key, draft: recovered });
          return;
        }
        if (raw) window.sessionStorage.removeItem(key);
      }
    } catch {
      // Storage may be disabled in private mode; builder remains fully usable.
    }
    setDraftReady(true);
  }, [authenticated, draftKey]);

  function persistBrowserDraft() {
    try {
      const value = serializeBuyerSessionDraft({
        title, lines, documents, guidedSpecsByLine, selectedCatalog, wizardDraft: previewDraft,
      });
      if (value) window.sessionStorage.setItem(draftKey, value);
      else window.sessionStorage.removeItem(draftKey);
    } catch {
      // Storage unavailable or quota exceeded; server save and copy still work.
    }
  }

  useEffect(() => {
    if (!draftReady) return;
    persistBrowserDraft();
    // Deliberately store only changes to the draft payload, not message, email
    // recipients or subject; none of these can be sent from browser storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady, draftKey, title, lines, documents, guidedSpecsByLine, selectedCatalog, previewDraft]);

  function restoreBrowserDraft() {
    if (!restoreCandidate) return;
    const recovered = restoreCandidate.draft;
    setTitle(recovered.title);
    setLines(recovered.lines);
    setEditingRows({});
    setDocuments(recovered.documents);
    setGuidedSpecsByLine(recovered.guidedSpecsByLine);
    setSelectedCatalog(recovered.selectedCatalog);
    setPreviewDraft(recovered.wizardDraft);
    setWizardRestoreSerial((current) => current + 1);
    setEmailSubject(recovered.title);
    setSavedId(null);
    setSaveMessage(null);
    setSendMessage(null);
    setRfqMessage(null);
    try {
      // Transfer ownership into the authenticated user's tab-scoped key only
      // after an explicit choice, never silently on login.
      if (restoreCandidate.key !== draftKey) window.sessionStorage.removeItem(restoreCandidate.key);
    } catch { /* storage may be disabled */ }
    setRestoreCandidate(null);
    setDraftReady(true);
  }

  function discardBrowserDraft() {
    try { if (restoreCandidate) window.sessionStorage.removeItem(restoreCandidate.key); }
    catch { /* optional session storage */ }
    setRestoreCandidate(null);
    setDraftReady(true);
  }

  useEffect(() => {
    const id = focusQuantityId.current;
    if (!id) return;
    const input = document.getElementById("buyer-quantity-" + id);
    if (!input) return;
    focusQuantityId.current = null;
    input.focus({ preventScroll: true });
    input.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [lines, compactMode]);

  function updateLine(
    id: string,
    patch: Partial<BuyerDistintaDraftLine>,
  ) {
    setSavedId(null);
    setSaveMessage(null);
    setSendMessage(null);
    setRfqMessage(null);
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function chooseFamily(id: string, family: string) {
    setSelectedCatalog((current) => ({ ...current, [id]: { family, sizeKey: "", optionId: "" } }));
    updateLine(id, { description: "", weightKgM: "" });
  }

  function chooseSize(id: string, family: string, sizeKey: string) {
    setSelectedCatalog((current) => ({ ...current, [id]: { family, sizeKey, optionId: "" } }));
    updateLine(id, { description: "", weightKgM: "" });
  }

  function weightFromCatalogForStandard(option: BuyerDistintaCatalogOption, standard: string): string {
    if (standard !== "EN 10210" && standard !== "EN 10219") {
      return option.weightKgM.toLocaleString("it-IT", { maximumFractionDigits: 3 });
    }
    const parts = option.sizeKey.split(":");
    const a = Number(parts[1]), b = Number(parts[2]);
    const weight = guidedTubeMassKgM(option.family, standard, a, b, option.thicknessMm);
    return (weight ?? option.weightKgM).toLocaleString("it-IT", { maximumFractionDigits: 3 });
  }

  function addGuidedTube(draft: GuidedTubeDraft) {
    const reusable = lines.length === 1 && isUntouchedLine(lines[0]);
    if (lines.length >= 500 && !reusable) return;
    const id = reusable ? lines[0].id : newLineId();
    const nextLine = guidedTubeToBuyerLine(draft, id);
    if (!nextLine) return; // Never create a partial article from the guided flow.
    setLines((current) => reusable ? [nextLine] : [...current, nextLine]);
    setGuidedSpecsByLine((current) => ({ ...current, [id]: { ...draft } }));
    setSavedId(null);
    setSaveMessage(null);
    setSendMessage(null);
    setRfqMessage(null);
    setCompactMode(true);
    setExpandedRows((current) => ({ ...current, [id]: false }));
    setEditingRows((current) => ({ ...current, [id]: false }));
    // The confirmed row already contains quantity and theoretical weight;
    // no secondary quantity-entry step or forced focus is needed.
  }

  function chooseCatalogOption(id: string, family: string, sizeKey: string, optionId: string) {
    const selected = catalogOptions.find((option) =>
      option.id === optionId && option.family === family && option.sizeKey === sizeKey
    );
    if (!selected) return;
    setSelectedCatalog((current) => ({ ...current, [id]: { family, sizeKey, optionId } }));
    updateLine(id, {
      description: selected.description,
      weightKgM: weightFromCatalogForStandard(selected, lines.find((line) => line.id === id)?.standard ?? ""),
    });
  }

  // The specification belongs to this line: switching its norm never changes
  // previously entered lines, even when their shapes and dimensions match.
  function changeLineStandard(id: string, standard: string) {
    const selection = selectedCatalog[id];
    const reference = catalogOptions.find((option) => option.id === selection?.optionId);
    const guided = guidedSpecsByLine[id];
    const recalculated = (standard === "EN 10219" || standard === "EN 10210") && guided
      ? guidedTubeMeasurement({ ...guided, standard })
      : null;
    updateLine(id, reference
      ? { standard, weightKgM: weightFromCatalogForStandard(reference, standard) }
      : recalculated
        ? { standard, weightKgM: recalculated.weightKgM.toLocaleString("it-IT", { maximumFractionDigits: 3 }) }
        : { standard });
    if (guided) {
      setGuidedSpecsByLine((current) => ({
        ...current,
        [id]: { ...guided, standard: standard === "EN 10219" || standard === "EN 10210" ? standard : "" },
      }));
    }
  }

  function addCatalogLine(option: BuyerDistintaCatalogOption) {
    if (lines.length >= 500 && !(lines.length === 1 && isUntouchedLine(lines[0]))) return;
    const reuse = lines.length === 1 && isUntouchedLine(lines[0]);
    const id = reuse ? lines[0].id : newLineId();
    focusQuantityId.current = id;
    const nextLine: BuyerDistintaDraftLine = {
      ...blankLine(id),
      description: option.description,
      weightKgM: option.weightKgM.toLocaleString("it-IT", { maximumFractionDigits: 3 }),
    };
    setLines((current) => reuse ? [nextLine] : [...current, nextLine]);
    setSelectedCatalog((current) => ({
      ...current,
      [id]: { family: option.family, sizeKey: option.sizeKey, optionId: option.id },
    }));
    setSavedId(null);
    setSaveMessage(null);
    setSendMessage(null);
    setRfqMessage(null);
    setQuickQuery("");
    setCompactMode(true);
    setExpandedRows((current) => ({ ...current, [id]: false }));
    setEditingRows((current) => ({ ...current, [id]: true }));
  }

  function duplicateLine(id: string) {
    if (lines.length >= 500) return;
    const source = lines.find((line) => line.id === id);
    if (!source || !source.description.trim()) return;
    const duplicateId = newLineId();
    const copy = { ...source, id: duplicateId, quantity: "" };
    if (guidedSpecsByLine[id]) {
      setGuidedSpecsByLine((current) => ({ ...current, [duplicateId]: { ...current[id] } }));
    }
    setExpandedRows((current) => ({ ...current, [duplicateId]: false }));
    setEditingRows((current) => ({ ...current, [duplicateId]: true }));
    focusQuantityId.current = duplicateId;
    setLines((current) => {
      const index = current.findIndex((line) => line.id === id);
      if (index === -1 || current.length >= 500) return current;
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
    const selection = selectedCatalog[id];
    if (selection) {
      setSelectedCatalog((current) => ({ ...current, [duplicateId]: { ...selection } }));
    }
    setSavedId(null);
    setSaveMessage(null);
    setSendMessage(null);
    setRfqMessage(null);
  }

  function toggleRowDetails(id: string) {
    setExpandedRows((current) => ({ ...current, [id]: !(current[id] ?? !compactMode) }));
  }

  function addLine() {
    if (lines.length >= 500) return;
    setSavedId(null);
    setSaveMessage(null);
    if (initialEmptyRow) {
      // The initial blank row is recyclable; opening manual mode must not
      // create a second empty line and break completion unexpectedly.
      setEditingRows((current) => ({ ...current, [lines[0].id]: true }));
      return;
    }
    const id = newLineId();
    setEditingRows((current) => ({ ...current, [id]: true }));
    setLines((current) =>
      current.length >= 500 ? current : [...current, blankLine(id)],
    );
  }

  function removeLine(id: string) {
    setSavedId(null);
    setSaveMessage(null);
    setSelectedCatalog((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setExpandedRows((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setEditingRows((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setGuidedSpecsByLine((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLines((current) =>
      current.length === 1
        ? [blankLine(newLineId())]
        : current.filter((line) => line.id !== id),
    );
  }

  function goToIncompleteRow() {
    const index = calculated.findIndex((line) => !line.complete);
    if (index < 0) return;
    const row = lines[index];
    if (initialEmptyRow) {
      document.getElementById("bd6-config-title")?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setEditingRows((current) => ({ ...current, [row.id]: true }));
    // A provided but invalid target is editable in this row's details panel.
    if (row.targetEurT.trim() && calculated[index].targetEurT === null) {
      setExpandedRows((current) => ({ ...current, [row.id]: true }));
    }
    const element = document.getElementById("buyer-row-" + row.id);
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  async function copyDistinta() {
    const valid = calculated.filter((line) => line.complete);
    if (!valid.length || valid.length !== calculated.length) {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2200);
      return;
    }

    const plain = buildBuyerDistintaPlainText(title, valid, documents);
    const html = buildBuyerDistintaHtml(title, valid, documents);

    try {
      if (
        navigator.clipboard &&
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard.write
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([plain], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  }

  function saveDistinta() {
    setSaveMessage(null);
    startSaveTransition(async () => {
      const result = await saveBuyerDistinta({ title, lines, documents });
      if (!result.ok || !result.distintaId) {
        setSaveMessage(result.error ?? "Salvataggio non riuscito.");
        return;
      }
      setSavedId(result.distintaId);
      try { window.sessionStorage.removeItem(draftKey); } catch { /* optional storage */ }
      setSaveMessage("Distinta salvata nel tuo spazio privato.");
    });
  }

  function createRfqHub() {
    if (!savedId) {
      setRfqMessage("Salva prima la distinta, poi puoi trasformarla in RFQ.");
      return;
    }

    setRfqMessage(null);
    startRfqTransition(async () => {
      const result = await createBuyerRfqCampaign(savedId);
      if (!result.ok || !result.rfqId) {
        setRfqMessage(result.error ?? "Creazione RFQ non riuscita.");
        return;
      }
      router.push(appRoutes.rfqHub.campaign(result.rfqId));
    });
  }

  function sendDistinta() {
    if (!savedId) {
      setSendMessage("Salva prima la distinta, poi puoi inviarla ai fornitori.");
      return;
    }

    const recipients = recipientInput
      .split(/[\n,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    setSendMessage(null);
    startSendTransition(async () => {
      const result = await sendBuyerDistinta({
        distintaId: savedId,
        recipients,
        subject: emailSubject,
        message: emailMessage,
      });

      if (!result.ok) {
        setSendMessage(result.error ?? "Invio non riuscito.");
        return;
      }
      setSendMessage(
        "Distinta inviata a " +
          String(result.sentCount ?? recipients.length) +
          ((result.sentCount ?? recipients.length) === 1 ? " fornitore." : " fornitori."),
      );
    });
  }

  return (
    <div className="bd54-page space-y-4 sm:space-y-5">
      {restoreCandidate ? (
        <aside className="rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] p-3 sm:p-4" aria-label="Bozza da recuperare">
          <p className="text-sm font-bold text-[var(--brand-deep)]">Bozza trovata in questa scheda</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            {restoreCandidate.draft.lines.length} righe, ultima modifica in questa sessione.
            Riprendila soltanto se è la tua richiesta: niente è stato inviato o salvato online.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={restoreBrowserDraft}
              className="platform-primary min-h-11 rounded-lg px-4 text-sm font-bold">
              Riprendi la distinta
            </button>
            <button type="button" onClick={discardBrowserDraft}
              className="app-secondary min-h-11 rounded-lg px-4 text-sm font-semibold">
              Scarta e crea nuova
            </button>
          </div>
        </aside>
      ) : null}
      {workspace && !restoreCandidate ? (
        <p className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--text-secondary)]">
          RFQ Hub · Le modifiche non ancora salvate sono temporanee e rimangono solo in questa scheda.
          Salva la distinta per registrarla nel tuo account aziendale.
        </p>
      ) : null}
      <aside className="bd53-hud" aria-label="Riepilogo in tempo reale della distinta">
        <div className="bd53-hud-progress">
          <span className="bd53-hud-caption">Righe pronte</span>
          <span className="bd53-hud-complete">{totals.completeLines}/{activeLineCount}</span>
          <div
            className="bd53-hud-track"
            role="progressbar"
            aria-label="Righe complete nella distinta"
            aria-valuemin={0}
            aria-valuemax={activeLineCount}
            aria-valuenow={totals.completeLines}
          >
            <span
              className="bd53-hud-progress-fill"
              style={{ width: (activeLineCount ? totals.completeLines / activeLineCount : 0) * 100 + "%" }}
            />
          </div>
        </div>
        <div className="bd53-hud-metrics">
          <div className="bd53-hud-metric">
            <span>Metri</span>
            <strong>{formatNumber(totals.totalMeters, 2)}</strong>
          </div>
          <div className="bd53-hud-metric">
            <span>Tonnellate</span>
            <strong>{formatNumber(totals.totalTonnes, 3)}</strong>
          </div>
          {!allComplete ? <span className="bd53-hud-partial">Totali parziali</span> : null}
        </div>
        <button
          type="button"
          onClick={allComplete ? copyDistinta : goToIncompleteRow}
          disabled={allComplete && copyState === "copied"}
          className="bd53-hud-action"
        >
          {allComplete
            ? copyState === "copied"
              ? "Copiata ✓"
              : copyState === "error"
                ? "Riprova copia"
                : "Copia distinta"
            : "Completa le righe"}
        </button>
      </aside>
      <section className="rounded-3xl border border-[#d8e1dd] bg-white p-3 shadow-[0_16px_50px_rgba(18,61,52,0.06)] sm:p-5">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
              {workspace ? "RFQ Hub · Distinta privata" : "Creazione articoli"}
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-[var(--brand-deep)]">
              Articoli in distinta
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
Configura un articolo o compila direttamente una riga: quantità, kg/m e anteprima si aggiornano subito. Ogni articolo mantiene la propria norma.
            </p>
          </div>
          <label className="w-full max-w-sm text-xs font-semibold text-[var(--text-secondary)]">
            Titolo distinta
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setSavedId(null);
                setEmailSubject(event.target.value || "Richiesta di offerta");
              }}
              className="mt-1 h-10 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm font-semibold text-[var(--text-primary)]"
            />
          </label>
        </div>


        <div className="bd7-workbench">
          <div className="bd7-workbench-editor">
            <BuyerTubeGuidedCreator
              key={wizardRestoreSerial}
              initialDraft={previewDraft}
              catalogOptions={catalogOptions}
              onAdd={addGuidedTube}
              onDraftChange={setPreviewDraft}
              canAdd={lines.length < 500 || (lines.length === 1 && isUntouchedLine(lines[0]))}
            />

        <details className="bd6-legacy-search">
          <summary className="bd6-legacy-summary">Ricerca rapida alternativa · misure pubblicate e compilazione libera</summary>
        <section aria-label="Ricerca rapida articoli" className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--brand-deep)]">Aggiunta rapida degli articoli</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                Trova una misura pubblica, aggiungila e compila la quantità. Per altri articoli usa la riga libera.
              </p>
            </div>
            <button
              type="button"
              aria-pressed={!compactMode}
              onClick={() => {
                setCompactMode((current) => !current);
                setExpandedRows({});
              }}
              className={!compactMode
                ? "platform-primary min-h-11 rounded-xl px-4 text-xs font-bold"
                : "min-h-11 rounded-xl border border-[var(--border)] bg-white px-4 text-xs font-bold text-[var(--brand-deep)] hover:bg-[var(--surface-muted)]"}
            >
              {compactMode ? "Mostra tutti i dettagli" : "Comprimi tutte le righe"}
            </button>
          </div>
          <label className="mt-3 block text-xs font-semibold text-[var(--text-secondary)]">
            Cerca per forma, dimensioni o spessore
            <input
              type="search"
              value={quickQuery}
              onChange={(event) => setQuickQuery(event.target.value)}
              placeholder="Es. quadro 100x100x4, tondo 60,3x3"
              autoComplete="off"
              className="mt-1.5 h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]"
            />
          </label>
          {quickQuery.trim() ? (
            <div className="mt-3" aria-live="polite">
              {catalogOptions.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">Catalogo pubblico non disponibile. Aggiungi una riga libera.</p>
              ) : quickMatches.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">Nessuna misura trovata. Prova una ricerca diversa oppure usa una riga libera.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {quickMatches.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => addCatalogLine(option)}
                      disabled={lines.length >= 500}
                      aria-label={"Aggiungi " + option.description}
                      className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-left text-sm text-[var(--text-primary)] transition hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="min-w-0 font-semibold">{option.description}</span>
                      <span className="shrink-0 whitespace-nowrap text-xs text-[var(--text-secondary)]">
                        {option.weightKgM.toLocaleString("it-IT", { maximumFractionDigits: 3 })} kg/m <span aria-hidden="true">＋</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {quickMatches.length === 8 ? (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">Mostriamo i primi 8 risultati: affina la ricerca per trovare la misura desiderata.</p>
              ) : null}
            </div>
          ) : null}
        </section>
        </details>


          </div>
          <aside className="bd7-preview" aria-label="Distinta in composizione">
            <div className="bd7-preview-head">
              <div>
                <p className="bd6-eyebrow">Anteprima in tempo reale</p>
                <h3 className="text-sm font-extrabold text-[var(--brand-deep)]">La tua distinta</h3>
              </div>
              <span className="bd7-preview-counter">{totals.completeLines}/{activeLineCount} righe</span>
            </div>
            {previewDraft && (previewDraft.family || previewDraft.standard || previewDraft.grade) ? (
              <div className="bd7-draft-pending">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">In configurazione</span>
                <p className="mt-1 text-xs font-semibold text-[var(--brand-deep)]">
                  {guidedTubeMeasurement(previewDraft)?.description ||
                    [previewDraft.family ? buyerTubeFamilyLabels[previewDraft.family] : "", previewDraft.standard, previewDraft.grade].filter(Boolean).join(" · ")}
                </p>
                {guidedTubeMeasurement(previewDraft) ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    {formatNumber(guidedTubeMeasurement(previewDraft)!.weightKgM, 3)} kg/m teorici
                  </p>
                ) : null}
              </div>
            ) : null}
            {activeLineCount === 0 ? (
              <p className="bd9-preview-empty">Nessun articolo ancora inserito. Configura il primo articolo o compila una riga libera.</p>
            ) : null}
                    <div className="bd10-preview-lines" aria-label="Articoli della distinta">
        <datalist id="buyer-standards"><option value="EN 10219" /><option value="EN 10210" /><option value="EN 10305" /></datalist>
        <datalist id="buyer-grades"><option value="S235JRH" /><option value="S275J0H" /><option value="S355J2H" /></datalist>
        <datalist id="buyer-finishes"><option value="Nero" /><option value="Zincato" /><option value="Decapato" /></datalist>
        <p className="bd10-preview-help">Ogni riga è pronta per la richiesta e può essere modificata qui, senza un secondo passaggio.</p>
        <div className="mt-3 space-y-3 sm:space-y-4">
          {lines.map((line, index) => {
            const calc = calculated[index];
            const detailOpen = expandedRows[line.id] ?? !compactMode;
            const editOpen = editingRows[line.id] ?? false;
            const invalidTarget = line.targetEurT.trim() !== "" && calc.targetEurT === null;
            const rowStage = calc.complete ? "complete" : isUntouchedLine(line) ? "empty" : "pending";
            const selection = selectedCatalog[line.id] ?? { family: "", sizeKey: "", optionId: "" };
            const familyOptions = catalogOptions.filter((option) => option.family === selection.family);
            const sizeChoices = familyOptions.filter((option, optionIndex, all) =>
              all.findIndex((candidate) => candidate.sizeKey === option.sizeKey) === optionIndex
            );
            const thicknessChoices = familyOptions.filter((option) => option.sizeKey === selection.sizeKey);

            return (
              <article
                key={line.id}
                id={"buyer-row-" + line.id}
                tabIndex={-1}
                aria-label={`Riga ${index + 1}: ${calc.complete ? "completa" : rowStage === "empty" ? "da iniziare" : "da completare"}`}
                data-stage={rowStage}
                hidden={initialEmptyRow && !editingRows[line.id]}
                className="bd5-row-card bd10-preview-row"
              >
                <div className="bd10-row-summary">
                  <span className="bd7-preview-number" aria-hidden="true">{index + 1}</span>
                  <div className="bd10-row-summary-content">
                    <strong>{line.description.trim() || "Articolo da compilare"}</strong>
                    <span>{line.standard || "Norma da scegliere"}{line.grade ? " · " + line.grade : ""}</span>
                    <span>{calc.quantity !== null
                      ? formatNumber(calc.quantity, line.quantityMode === "bars" ? 0 : 2) + " " +
                        (line.quantityMode === "bars" ? "barre" : line.quantityMode === "meters" ? "m" : "t")
                      : "Quantità mancante"} · {formatNumber(calc.meters, 2)} m · {formatNumber(calc.tonnes, 3)} t
                      {" · "}{formatNumber(calc.weightKgM, 3)} kg/m
                      {calc.targetEurT !== null ? " · Target " + formatNumber(calc.targetEurT, 2) + " €/t" : ""}</span>
                  </div>
                  <div className="bd10-row-actions">
                    <button type="button" className="bd10-edit-button"
                      aria-expanded={editOpen}
                      aria-controls={"buyer-inline-editor-" + line.id}
                      onClick={() => setEditingRows((current) => ({ ...current, [line.id]: !editOpen }))}>
                      {editOpen ? "Chiudi" : "Modifica"}
                    </button>
                    <button type="button" className="bd10-mini-action" title="Duplica articolo"
                      aria-label={`Duplica articolo riga ${index + 1}`}
                      disabled={!line.description.trim() || lines.length >= 500}
                      onClick={() => duplicateLine(line.id)}>⧉</button>
                    <button type="button" className="bd10-mini-action bd10-mini-danger" title="Rimuovi articolo"
                      aria-label={`Rimuovi articolo riga ${index + 1}`}
                      onClick={() => removeLine(line.id)}>×</button>
                  </div>
                </div>
                <div id={"buyer-inline-editor-" + line.id} className="bd10-row-editor" hidden={!editOpen}>
                  <div className="bd5-row-header">
                  <span className="bd5-row-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <label className="bd52-field bd52-field-description">
                    Articolo *
                    <input
                      value={line.description}
                      onChange={(event) => updateLine(line.id, { description: event.target.value })}
                      placeholder="Tubo quadro 100 × 100 × 4 mm"
                      className="bd52-input"
                    />
                  </label>
                  <label className="bd8-inline-norm bd52-field">
                    Norma
                    <select
                      aria-label={`Norma della riga ${index + 1}`}
                      value={line.standard}
                      onChange={(event) => changeLineStandard(line.id, event.target.value)}
                      className="bd52-input"
                    >
                      <option value="">Scegli</option>
                      <option value="EN 10219">EN 10219</option>
                      <option value="EN 10210">EN 10210</option>
                      {line.standard && !["EN 10219", "EN 10210"].includes(line.standard)
                        ? <option value={line.standard}>{line.standard}</option> : null}
                    </select>
                  </label>
                  <label className="bd8-inline-grade bd52-field">
                    Grado
                    <input
                      list="buyer-grades"
                      aria-label={`Grado della riga ${index + 1}`}
                      value={line.grade}
                      onChange={(event) => updateLine(line.id, { grade: event.target.value })}
                      placeholder="S355J2H"
                      className="bd52-input"
                    />
                  </label>
                  <span className="bd5-status-badge" title={calc.complete ? "Completa" : rowStage === "empty" ? "Da iniziare" : "Da completare"}>
                    <span aria-hidden="true" className="bd5-status-dot" />
                    <span className="sr-only">{calc.complete ? "Completa" : rowStage === "empty" ? "Da iniziare" : "Da completare"}</span>
                  </span>
                </div>
                <div className="bd5-row-body">
                  <div className="bd52-core">
                    <div className="bd52-core-fields">
                      <label className="bd52-field bd52-field-quantity">
                        Quantità *
                        <input
                          id={"buyer-quantity-" + line.id}
                          inputMode="decimal"
                          aria-label={`Quantità riga ${index + 1}`}
                          value={line.quantity}
                          onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                          placeholder="0"
                          className="bd52-input bd52-quantity-input"
                        />
                      </label>
                      <label className="bd52-field bd52-field-unit">
                        Unità
                        <select
                          value={line.quantityMode}
                          onChange={(event) => updateLine(line.id, { quantityMode: event.target.value as BuyerQuantityMode })}
                          className="bd52-input"
                        >
                          <option value="meters">Metri</option>
                          <option value="bars">Barre / pezzi</option>
                          <option value="tonnes">Tonnellate</option>
                        </select>
                      </label>
                      {line.quantityMode === "bars" ? (
                        <label className="bd52-field bd52-field-bars">
                          Barra (m) *
                          <input
                            inputMode="decimal"
                            value={line.barLengthM}
                            onChange={(event) => updateLine(line.id, { barLengthM: event.target.value })}
                            placeholder="12"
                            className="bd52-input"
                          />
                        </label>
                      ) : null}
                      <label className="bd52-field bd52-field-weight">
                        Peso kg/m *
                        <input
                          inputMode="decimal"
                          value={line.weightKgM}
                          onChange={(event) => updateLine(line.id, { weightKgM: event.target.value })}
                          placeholder="kg/m"
                          className="bd52-input"
                        />
                      </label>
                      <div className="bd8-tonnes" aria-label={`Peso riga ${index + 1}`}>
                        <span>Tonnellate</span>
                        <strong className="bd52-weight-pill">{formatNumber(calc.tonnes, 3)} t</strong>
                      </div>
                      <button
                        type="button"
                        aria-expanded={detailOpen}
                        aria-controls={"buyer-details-" + line.id}
                        aria-label={(detailOpen ? "Chiudi dettagli riga " : "Apri dettagli riga ") + String(index + 1)}
                        onClick={() => toggleRowDetails(line.id)}
                        className="bd52-details-toggle"
                      >
                        {detailOpen ? "Chiudi" : invalidTarget ? "Correggi target" : "Dettagli e opzioni"}
                        <span aria-hidden="true" className={detailOpen ? "bd52-chevron bd52-chevron-open" : "bd52-chevron"}>⌄</span>
                      </button>
                      <div className="bd5-row-actions flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => duplicateLine(line.id)}
                          disabled={!line.description.trim() || lines.length >= 500}
                          title="Duplica articolo (quantità vuota, norma invariata)"
                          aria-label={`Duplica articolo riga ${index + 1}`}
                          className="bd5-row-action bd8-icon-button"
                        >
                          <span aria-hidden="true">⧉</span><span className="sr-only">Duplica articolo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="bd5-row-action bd5-row-action-danger bd8-icon-button"
                          aria-label={`Rimuovi riga ${index + 1}`}
                          title="Rimuovi articolo"
                        >
                          <span aria-hidden="true">×</span><span className="sr-only">Rimuovi</span>
                        </button>
                      </div>
                    </div>
                    {(line.targetEurT.trim() || line.finish || line.note) ? (
                      <div className="bd52-core-footer">
                        {line.targetEurT.trim()
                          ? <span>{invalidTarget ? "Verifica Target €/t" : `Target ${formatNumber(calc.targetEurT, 2)} €/t`}</span> : null}
                        {line.finish ? <span>Finitura: {line.finish}</span> : null}
                        {line.note ? <span>Nota inserita</span> : null}
                      </div>
                    ) : null}
                  </div>

                <div
                  id={"buyer-details-" + line.id}
                  hidden={!detailOpen}
                  className="bd52-detail-panel"
                >
                  <div className="bd52-detail-section">
                    <p className="bd52-detail-heading">Misure da catalogo Knowledge</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="bd52-field">
                        Tipo di tubo
                        <select
                          aria-label={`Tipo di tubo, riga ${index + 1}`}
                          value={selection.family}
                          onChange={(event) => chooseFamily(line.id, event.target.value)}
                          className="bd52-input"
                        >
                          <option value="">Compilazione libera</option>
                          {(["round_tube", "square_tube", "rectangular_tube"] as const).map((family) => (
                            <option key={family} value={family}>{buyerTubeFamilyLabels[family]}</option>
                          ))}
                        </select>
                      </label>
                      <label className="bd52-field">
                        Misura
                        <select
                          aria-label={`Misura, riga ${index + 1}`}
                          value={selection.sizeKey}
                          disabled={!selection.family || sizeChoices.length === 0}
                          onChange={(event) => chooseSize(line.id, selection.family, event.target.value)}
                          className="bd52-input"
                        >
                          <option value="">Scegli misura</option>
                          {sizeChoices.map((option) => (
                            <option key={option.sizeKey} value={option.sizeKey}>{option.sizeLabel}</option>
                          ))}
                        </select>
                      </label>
                      <label className="bd52-field">
                        Spessore
                        <select
                          aria-label={`Spessore, riga ${index + 1}`}
                          value={selection.optionId}
                          disabled={!selection.sizeKey || thicknessChoices.length === 0}
                          onChange={(event) => chooseCatalogOption(line.id, selection.family, selection.sizeKey, event.target.value)}
                          className="bd52-input"
                        >
                          <option value="">Scegli spessore</option>
                          {thicknessChoices.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.thicknessMm.toLocaleString("it-IT")} mm · {option.weightKgM.toLocaleString("it-IT", { maximumFractionDigits: 3 })} kg/m
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {catalogOptions.length === 0 ? (
                      <p className="mt-2 text-xs text-[var(--semantic-warning)]">
                        Riferimenti pubblici temporaneamente non disponibili: usa la compilazione libera.
                      </p>
                    ) : null}
                    {selection.optionId ? (
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">
                        Il peso precompilato è indicativo; verifica sempre specifiche e tolleranze richieste.
                      </p>
                    ) : null}
                  </div>
                  <div className="bd52-detail-section">
                    <p className="bd52-detail-heading">Specifiche e condizioni (facoltative)</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <label className="bd52-field">
                        Norma
                        <input
                          list="buyer-standards"
                          value={line.standard}
                          onChange={(event) => changeLineStandard(line.id, event.target.value)}
                          placeholder="EN 10219"
                          className="bd52-input"
                        />
                      </label>
                      <label className="bd52-field">
                        Grado
                        <input
                          list="buyer-grades"
                          value={line.grade}
                          onChange={(event) => updateLine(line.id, { grade: event.target.value })}
                          placeholder="S355J2H"
                          className="bd52-input"
                        />
                      </label>
                      <label className="bd52-field">
                        Finitura
                        <input
                          list="buyer-finishes"
                          value={line.finish}
                          onChange={(event) => updateLine(line.id, { finish: event.target.value })}
                          placeholder="Nero / zincato"
                          className="bd52-input"
                        />
                      </label>
                      <label className="bd52-field">
                        Target €/t (facoltativo)
                        <input
                          inputMode="decimal"
                          value={line.targetEurT}
                          onChange={(event) => updateLine(line.id, { targetEurT: event.target.value })}
                          placeholder="Opzionale"
                          className="bd52-input"
                        />
                      </label>
                      <div className="bd52-field">
                        Target €/m (calcolato)
                        <output className="bd52-output">{formatNumber(calc.targetEurM, 4)}</output>
                      </div>
                      <label className="bd52-field">
                        Note
                        <input
                          value={line.note}
                          onChange={(event) => updateLine(line.id, { note: event.target.value })}
                          placeholder="Tolleranze, consegna…"
                          className="bd52-input"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {!calc.complete && rowStage === "pending" ? (
                  <p className="bd5-row-hint mt-3 text-xs leading-5">
                    Completa descrizione, quantità e peso kg/m. Il Target €/t è facoltativo, ma se inserito deve essere positivo.
                  </p>
                ) : null}
                </div>
                </div>
              </article>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addLine}
          disabled={lines.length >= 500}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-4 text-sm font-bold text-[#173f35] hover:bg-[#e1ece8]"
        >
          + Aggiungi riga libera
        </button>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">{lines.length} / 500 righe · Duplica per riutilizzare le specifiche senza ripetere la quantità.</p>
        </div>
            <div className="bd7-preview-totals">
              <span>{formatNumber(totals.totalMeters, 2)} m</span>
              <strong>{formatNumber(totals.totalTonnes, 3)} t</strong>
            </div>
            <details className="bd7-global-documents">
              <summary className="bd7-doc-summary">
                <span className="font-bold">Documentazione richiesta · intera distinta</span>
                <span className="bd7-doc-caption">{formatBuyerDocumentRequirements(documents) ? "Condizioni impostate" : "Facoltativa"}</span>
              </summary>
              <div className="bd7-doc-fields">
                <label className="bd6-dimension-field">
                  Certificato di controllo EN 10204
                  <select
                    value={documents.inspectionDocument}
                    onChange={(event) => {
                      setDocuments((current) => ({ ...current, inspectionDocument: event.target.value as BuyerDistintaDocumentRequirements["inspectionDocument"] }));
                      setSavedId(null);
                    }}
                    className="bd6-input"
                  >
                    <option value="">Non specificato</option>
                    <option value="2.1">2.1 · Dichiarazione conformità</option>
                    <option value="2.2">2.2 · Rapporto di prova</option>
                    <option value="3.1">3.1 · Certificato materiale</option>
                    <option value="3.2">3.2 · Con ispezione indipendente</option>
                  </select>
                </label>
                <label className="bd6-check">
                  <input type="checkbox" checked={documents.ceDop} onChange={(event) => {
                    setDocuments((current) => ({ ...current, ceDop: event.target.checked })); setSavedId(null);
                  }} />
                  Marcatura CE + DoP, se applicabili
                </label>
                <label className="bd6-check">
                  <input type="checkbox" checked={documents.iso9001} onChange={(event) => {
                    setDocuments((current) => ({ ...current, iso9001: event.target.checked })); setSavedId(null);
                  }} />
                  Produttore certificato UNI EN ISO 9001
                </label>
                <p className="text-[11px] leading-4 text-[var(--text-secondary)]">
                  Vale per tutta la richiesta; non viene ripetuto in ogni articolo. CE/DoP, EN 10204 e ISO 9001 hanno finalità differenti.
                </p>
              </div>
            </details>
            {formatBuyerDocumentRequirements(documents) ? (
              <p className="bd7-preview-doc-note">{formatBuyerDocumentRequirements(documents)}</p>
            ) : null}
          </aside>
        </div>


      </section>

      <section className="rounded-3xl border border-[#d8e1dd] bg-white p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Spazio privato
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[#1d2824]">
              Salva la richiesta nel tuo account.
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Lo snapshot resta privato e separato dai contenuti pubblici. Potrai usarlo come base per richieste e invii ai fornitori.
            </p>

            {authenticated ? (
              <button
                type="button"
                disabled={!allComplete || savePending}
                onClick={saveDistinta}
                className="platform-primary mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savePending ? "Salvataggio…" : savedId ? "Salvata ✓" : "Salva distinta"}
              </button>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={"/login?next=" + encodeURIComponent(appRoutes.rfqHub.createDistinta)}
                  onClick={persistBrowserDraft}
                  className="platform-primary inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold"
                >
                  Accedi per salvare
                </Link>
                <Link
                  href="/register"
                  onClick={persistBrowserDraft}
                  className="app-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
                >
                  Registra azienda
                </Link>
              </div>
            )}

            {savedId ? (
              <div className="mt-3 rounded-2xl border border-[#b8d2c8] bg-[#edf5f2] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                  RFQ Hub
                </p>
                <p className="mt-1 text-sm leading-6 text-[#52615b]">
                  Trasforma questa distinta salvata in una campagna privata e aggiungi più fornitori senza esporre gli indirizzi tra loro.
                </p>
                <button
                  type="button"
                  onClick={createRfqHub}
                  disabled={rfqPending}
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {rfqPending ? "Creazione RFQ…" : "Avvia RFQ multi-fornitore"}
                </button>
              </div>
            ) : null}

            {saveMessage ? (
              <p className="mt-3 text-xs font-semibold text-[#52615b]">{saveMessage}</p>
            ) : null}
            {rfqMessage ? (
              <p className="mt-2 text-xs font-semibold text-[#7b6a43]">{rfqMessage}</p>
            ) : null}
          </div>

          <div className="border-t border-[#e5eae8] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Invio fornitori
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[#1d2824]">
              Invia direttamente a più fornitori.
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Gli indirizzi vengono gestiti separatamente: ogni fornitore riceve la propria email e può rispondere direttamente al tuo indirizzo.
            </p>

            {authenticated ? (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-[#52615b]">
                  Email fornitori
                  <textarea
                    value={recipientInput}
                    onChange={(event) => setRecipientInput(event.target.value)}
                    placeholder={"acquisti@fornitore1.it\nofferte@fornitore2.it"}
                    rows={3}
                    className="mt-1.5 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 py-2.5 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
                  />
                </label>
                <label className="block text-xs font-semibold text-[#52615b]">
                  Oggetto
                  <input
                    value={emailSubject}
                    onChange={(event) => setEmailSubject(event.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
                  />
                </label>
                <label className="block text-xs font-semibold text-[#52615b]">
                  Messaggio
                  <textarea
                    value={emailMessage}
                    onChange={(event) => setEmailMessage(event.target.value)}
                    rows={4}
                    className="mt-1.5 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 py-2.5 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
                  />
                </label>

                <button
                  type="button"
                  disabled={!savedId || sendPending}
                  onClick={sendDistinta}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-5 text-sm font-bold text-[#173f35] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendPending ? "Invio…" : "Invia ai fornitori"}
                </button>

                {!emailConfigured ? (
                  <p className="text-[11px] leading-5 text-[#7b6a43]">
                    Il flusso è pronto; il server richiede la chiave del provider email per effettuare l&apos;invio reale.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-[#f7f9f8] px-4 py-3 text-xs leading-5 text-[#66736e]">
                L&apos;invio diretto è un servizio privato: accedi o registra la tua azienda per utilizzarlo.
              </p>
            )}

            {sendMessage ? (
              <p className="mt-3 text-xs font-semibold text-[#52615b]">{sendMessage}</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
