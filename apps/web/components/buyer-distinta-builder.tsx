"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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
  type BuyerDistintaCatalogOption,
} from "@/lib/buyer-distinta-catalog";

function blankLine(id: string): BuyerDistintaDraftLine {
  return {
    id,
    description: "",
    standard: "",
    grade: "",
    finish: "",
    quantityMode: "meters",
    quantity: "",
    barLengthM: "6",
    weightKgM: "",
    targetEurT: "",
    note: "",
  };
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
}: {
  authenticated: boolean;
  emailConfigured: boolean;
  catalogOptions: BuyerDistintaCatalogOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("Richiesta di offerta");
  const [selectedCatalog, setSelectedCatalog] = useState<Record<string, { family: string; sizeKey: string; optionId: string }>>({});
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
  const allComplete =
    calculated.length > 0 && calculated.every((line) => line.complete);

  function updateLine(
    id: string,
    patch: Partial<BuyerDistintaDraftLine>,
  ) {
    setSavedId(null);
    setSaveMessage(null);
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

  function chooseCatalogOption(id: string, family: string, sizeKey: string, optionId: string) {
    const selected = catalogOptions.find((option) =>
      option.id === optionId && option.family === family && option.sizeKey === sizeKey
    );
    if (!selected) return;
    setSelectedCatalog((current) => ({ ...current, [id]: { family, sizeKey, optionId } }));
    updateLine(id, {
      description: selected.description,
      weightKgM: selected.weightKgM.toLocaleString("it-IT", { maximumFractionDigits: 3 }),
    });
  }

  function addLine() {
    setSavedId(null);
    setLines((current) => [
      ...current,
      blankLine(
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "line-" + String(Date.now()),
      ),
    ]);
  }

  function removeLine(id: string) {
    setSavedId(null);
    setLines((current) =>
      current.length === 1
        ? [blankLine("line-reset")]
        : current.filter((line) => line.id !== id),
    );
  }

  async function copyDistinta() {
    const valid = calculated.filter((line) => line.complete);
    if (!valid.length || valid.length !== calculated.length) {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2200);
      return;
    }

    const plain = buildBuyerDistintaPlainText(title, valid);
    const html = buildBuyerDistintaHtml(title, valid);

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
      const result = await saveBuyerDistinta({ title, lines });
      if (!result.ok || !result.distintaId) {
        setSaveMessage(result.error ?? "Salvataggio non riuscito.");
        return;
      }
      setSavedId(result.distintaId);
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
      router.push("/marketplace/rfq-hub/" + result.rfqId);
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
    <div className="space-y-5">
      <section className="rounded-3xl border border-[#d8e1dd] bg-white p-4 shadow-[0_16px_50px_rgba(18,61,52,0.06)] sm:p-6">
        <div className="flex flex-col gap-4 border-b border-[#e8ecea] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
              Buyer tool
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824]">
              Crea la distinta in pochi passaggi
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Inserisci il materiale, la quantità e il peso kg/m; il Target €/t è facoltativo.
              Smart Steel Sales calcola automaticamente il corrispondente Target €/m.
            </p>
          </div>
          <label className="w-full max-w-md text-xs font-semibold uppercase tracking-wide text-[#66736e]">
            Titolo distinta
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setSavedId(null);
                setEmailSubject(event.target.value || "Richiesta di offerta");
              }}
              className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-[#1d2824] outline-none focus:border-[#438d7a]"
            />
          </label>
        </div>

        <datalist id="buyer-standards"><option value="EN 10219" /><option value="EN 10210" /><option value="EN 10305" /></datalist>
        <datalist id="buyer-grades"><option value="S235JRH" /><option value="S275J0H" /><option value="S355J2H" /></datalist>
        <datalist id="buyer-finishes"><option value="Nero" /><option value="Zincato" /><option value="Decapato" /></datalist>
        <div className="mt-5 space-y-4">
          {lines.map((line, index) => {
            const calc = calculated[index];
            const selection = selectedCatalog[line.id] ?? { family: "", sizeKey: "", optionId: "" };
            const familyOptions = catalogOptions.filter((option) => option.family === selection.family);
            const sizeChoices = familyOptions.filter((option, optionIndex, all) =>
              all.findIndex((candidate) => candidate.sizeKey === option.sizeKey) === optionIndex
            );
            const thicknessChoices = familyOptions.filter((option) => option.sizeKey === selection.sizeKey);

            return (
              <article
                key={line.id}
                className="rounded-2xl border border-[#dfe5e2] bg-[#fbfcfb] p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#718078]">
                    Riga {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#8a4c44] hover:bg-rose-50"
                  >
                    Rimuovi
                  </button>
                </div>

                <div className="mt-3 rounded-xl border border-[var(--border)] bg-white p-3 sm:p-4">
                  <p className="text-xs font-bold text-[var(--brand-deep)]">1. Seleziona l'articolo</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    Seleziona forma, misura e spessore: descrizione e peso vengono precompilati
                    dai riferimenti pubblici di Knowledge. Puoi sempre inserire un articolo manualmente.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">
                      Tipo di tubo
                      <select
                        aria-label={`Tipo di tubo, riga ${index + 1}`}
                        value={selection.family}
                        onChange={(event) => chooseFamily(line.id, event.target.value)}
                        className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-primary)]"
                      >
                        <option value="">Compilazione libera</option>
                        {(["round_tube", "square_tube", "rectangular_tube"] as const).map((family) => (
                          <option key={family} value={family}>{buyerTubeFamilyLabels[family]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">
                      Misura
                      <select
                        aria-label={`Misura, riga ${index + 1}`}
                        value={selection.sizeKey}
                        disabled={!selection.family || sizeChoices.length === 0}
                        onChange={(event) => chooseSize(line.id, selection.family, event.target.value)}
                        className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-primary)] disabled:bg-[var(--surface-muted)]"
                      >
                        <option value="">Scegli misura</option>
                        {sizeChoices.map((option) => (
                          <option key={option.sizeKey} value={option.sizeKey}>{option.sizeLabel}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">
                      Spessore
                      <select
                        aria-label={`Spessore, riga ${index + 1}`}
                        value={selection.optionId}
                        disabled={!selection.sizeKey || thicknessChoices.length === 0}
                        onChange={(event) => chooseCatalogOption(line.id, selection.family, selection.sizeKey, event.target.value)}
                        className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-primary)] disabled:bg-[var(--surface-muted)]"
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
                      Peso di riferimento precompilato, non una conferma di disponibilità o tolleranza del fornitore.
                    </p>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                  <label className="lg:col-span-9 text-xs font-semibold text-[var(--text-secondary)]">
                    2. Articolo / descrizione *
                    <input
                      value={line.description}
                      onChange={(event) => updateLine(line.id, { description: event.target.value })}
                      placeholder="Es. Tubo quadro 100 × 100 × 4 mm"
                      className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-primary)] focus:border-[var(--brand-primary)]"
                    />
                  </label>
                  <label className="lg:col-span-3 text-xs font-semibold text-[var(--text-secondary)]">
                    Peso kg/m *
                    <input
                      inputMode="decimal"
                      value={line.weightKgM}
                      onChange={(event) => updateLine(line.id, { weightKgM: event.target.value })}
                      placeholder="Es. 12,5"
                      className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold text-[var(--text-primary)] focus:border-[var(--brand-primary)]"
                    />
                  </label>
                </div>
                <details className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-[var(--brand-deep)]">
                    Specifiche aggiuntive · norma, grado, finitura (facoltative)
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">
                      Norma
                      <input list="buyer-standards" value={line.standard}
                        onChange={(event) => updateLine(line.id, { standard: event.target.value })}
                        placeholder="EN 10219"
                        className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-primary)]" />
                    </label>
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">
                      Grado
                      <input list="buyer-grades" value={line.grade}
                        onChange={(event) => updateLine(line.id, { grade: event.target.value })}
                        placeholder="S355J2H"
                        className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-primary)]" />
                    </label>
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">
                      Finitura
                      <input list="buyer-finishes" value={line.finish}
                        onChange={(event) => updateLine(line.id, { finish: event.target.value })}
                        placeholder="Nero / zincato"
                        className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-primary)]" />
                    </label>
                  </div>
                </details>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                  <label className="lg:col-span-2 text-xs font-semibold text-[#52615b]">
                    Quantità *
                    <input
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.id, { quantity: event.target.value })
                      }
                      placeholder="100"
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm font-semibold text-[#1d2824] outline-none focus:border-[#438d7a]"
                    />
                  </label>
                  <label className="lg:col-span-2 text-xs font-semibold text-[#52615b]">
                    Unità
                    <select
                      value={line.quantityMode}
                      onChange={(event) =>
                        updateLine(line.id, {
                          quantityMode: event.target.value as BuyerQuantityMode,
                        })
                      }
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
                    >
                      <option value="meters">Metri</option>
                      <option value="bars">Barre / pezzi</option>
                      <option value="tonnes">Tonnellate</option>
                    </select>
                  </label>
                  {line.quantityMode === "bars" ? (
                    <label className="lg:col-span-2 text-xs font-semibold text-[#52615b]">
                      Lunghezza barra
                      <input
                        inputMode="decimal"
                        value={line.barLengthM}
                        onChange={(event) =>
                          updateLine(line.id, { barLengthM: event.target.value })
                        }
                        placeholder="6"
                        className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
                      />
                    </label>
                  ) : null}
                  <label className="lg:col-span-2 text-xs font-semibold text-[#173f35]">
                    Target €/t (facoltativo)
                    <input
                      inputMode="decimal"
                      value={line.targetEurT}
                      onChange={(event) =>
                        updateLine(line.id, { targetEurT: event.target.value })
                      }
                      placeholder="Opzionale · es. 750"
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#9ebfb3] bg-[#f6fbf9] px-3 text-sm font-bold text-[#173f35] outline-none focus:border-[#438d7a]"
                    />
                  </label>

                  <div className="lg:col-span-2">
                    <p className="text-xs font-semibold text-[#173f35]">Target €/m</p>
                    <div className="mt-1.5 flex h-11 items-center rounded-xl border border-[#cfe0da] bg-[#edf5f2] px-3 text-sm font-bold tabular-nums text-[#173f35]">
                      {formatNumber(calc.targetEurM, 4)}
                    </div>
                  </div>
                  <div className="lg:col-span-2">
                    <p className="text-xs font-semibold text-[#66736e]">Tonnellate</p>
                    <div className="mt-1.5 flex h-11 items-center rounded-xl border border-[#e0e5e3] bg-white px-3 text-sm font-semibold tabular-nums text-[#43524c]">
                      {formatNumber(calc.tonnes, 3)}
                    </div>
                  </div>
                  <label className="lg:col-span-2 text-xs font-semibold text-[#52615b]">
                    Note
                    <input
                      value={line.note}
                      onChange={(event) =>
                        updateLine(line.id, { note: event.target.value })
                      }
                      placeholder="Tolleranze, consegna…"
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
                    />
                  </label>
                </div>

                {!calc.complete ? (
                  <p className="mt-3 text-[11px] leading-5 text-[#7b6a43]">
                    Per completare la distinta servono descrizione, quantità e peso kg/m. Se inserisci un Target €/t, deve essere positivo.
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addLine}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-4 text-sm font-bold text-[#173f35] hover:bg-[#e1ece8]"
        >
          + Aggiungi riga
        </button>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
        <div className="rounded-2xl border border-[#dce2df] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            Riepilogo
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#f7f9f8] p-3">
              <p className="text-xs text-[#718078]">Metri totali</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-[#1d2824]">
                {formatNumber(totals.totalMeters, 2)}
              </p>
            </div>
            <div className="rounded-xl bg-[#f7f9f8] p-3">
              <p className="text-xs text-[#718078]">Tonnellate totali</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-[#1d2824]">
                {formatNumber(totals.totalTonnes, 3)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#66736e]">
            {totals.completeLines}/{lines.length} righe complete. Se indicato, il Target €/m deriva da Target €/t × kg/m ÷ 1000.
          </p>
        </div>

        <div className="rounded-2xl border border-[#cddbd6] bg-[#f7faf8] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            Pronta per l&apos;email
          </p>
          <h3 className="mt-2 text-lg font-semibold text-[#1d2824]">
            Copia la distinta e incollala nella tua email.
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            La copia include articoli, quantità, peso e, soltanto se inseriti, i prezzi obiettivo.
          </p>
          <button
            type="button"
            onClick={copyDistinta}
            className="platform-primary mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold"
          >
            {copyState === "copied"
              ? "Copiata ✓"
              : copyState === "error"
                ? "Completa tutte le righe"
                : "Copia distinta"}
          </button>
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
                  href={"/login?next=" + encodeURIComponent("/distinta")}
                  className="platform-primary inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold"
                >
                  Accedi per salvare
                </Link>
                <Link
                  href="/register"
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
