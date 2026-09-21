"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  prepareBulkImport,
  retryBulkImport,
  startBulkImport,
  type BulkFileDescriptor,
  type PreparedBulkBatch,
} from "@/app/(workspace)/uploads/bulk-actions";
import { createClient } from "@/lib/supabase/client";

const MAX_FILES = 25;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_BATCH_BYTES = 100 * 1024 * 1024;
const ALLOWED = new Set(["eml", "pdf", "xls", "xlsx"]);

type BatchProgress = {
  id: string;
  status: "queued" | "processing" | "completed" | "partial" | "failed";
  total_items: number;
  queued_items: number;
  processing_items: number;
  completed_items: number;
  failed_items: number;
  deduplicated_items: number;
};

type BatchItem = {
  id: string;
  ordinal: number;
  filename: string;
  status: "queued" | "processing" | "completed" | "failed";
  attempt_count: number;
  last_error: string | null;
  deduplicated: boolean;
};

async function sha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function validateFiles(files: File[]): string | null {
  if (!files.length) return "Seleziona almeno un file.";
  if (files.length > MAX_FILES) return `Puoi importare al massimo ${MAX_FILES} file alla volta.`;
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_BATCH_BYTES) return "I file selezionati superano il limite complessivo di 100 MB.";
  for (const file of files) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !ALLOWED.has(extension)) {
      return `${file.name}: formato non supportato. Usa EML, PDF, XLS o XLSX.`;
    }
    if (!file.size) return `${file.name}: il file è vuoto.`;
    if (file.size > MAX_FILE_BYTES) return `${file.name}: supera il limite di 25 MB.`;
  }
  return null;
}

export function BulkUploadForm() {
  const supabase = useMemo(() => createClient(), []);
  const [files, setFiles] = useState<File[]>([]);
  const [batch, setBatch] = useState<PreparedBulkBatch | null>(null);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => () => stopPolling(), []);

  async function refresh(batchId: string): Promise<BatchProgress | null> {
    const [batchResult, itemsResult] = await Promise.all([
      supabase
        .from("import_batches")
        .select("id,status,total_items,queued_items,processing_items,completed_items,failed_items,deduplicated_items")
        .eq("id", batchId)
        .single(),
      supabase
        .from("import_batch_items")
        .select("id,ordinal,filename,status,attempt_count,last_error,deduplicated")
        .eq("batch_id", batchId)
        .order("ordinal"),
    ]);

    if (batchResult.error) {
      setMessage(`Impossibile leggere il progresso: ${batchResult.error.message}`);
      return null;
    }
    if (itemsResult.error) {
      setMessage(`Impossibile leggere lo stato dei file: ${itemsResult.error.message}`);
      return null;
    }

    const next = batchResult.data as BatchProgress;
    setProgress(next);
    setItems((itemsResult.data ?? []) as BatchItem[]);
    return next;
  }

  function beginPolling(batchId: string) {
    stopPolling();
    void refresh(batchId);
    pollRef.current = setInterval(async () => {
      const next = await refresh(batchId);
      if (next && ["completed", "partial", "failed"].includes(next.status)) {
        stopPolling();
      }
    }, 1500);
  }

  async function handleImport() {
    const validation = validateFiles(files);
    if (validation) {
      setMessage(validation);
      return;
    }

    setBusy(true);
    setMessage("Preparo i file per l’importazione...");
    setBatch(null);
    setProgress(null);
    setItems([]);
    let activeBatchId: string | null = null;

    try {
      const descriptors: BulkFileDescriptor[] = await Promise.all(
        files.map(async (file) => ({
          filename: file.name,
          size_bytes: file.size,
          content_checksum: await sha256(file),
        })),
      );

      const prepared = await prepareBulkImport(descriptors);
      if (!prepared.ok) {
        setMessage(prepared.error);
        return;
      }
      activeBatchId = prepared.data.batch_id;
      setBatch(prepared.data);

      const uploadItemIds: string[] = [];
      for (const [index, item] of prepared.data.items.entries()) {
        if (item.deduplicated || item.status === "completed") continue;
        const file = files[index];
        if (!file || !item.upload_token) {
          throw new Error(`${item.filename}: token di upload non disponibile.`);
        }
        setMessage(`Caricamento ${index + 1}/${files.length}: ${item.filename}`);
        const { error } = await supabase.storage
          .from("commercial-uploads")
          .uploadToSignedUrl(item.storage_path, item.upload_token, file, {
            contentType: file.type || "application/octet-stream",
          });
        if (error) throw new Error(`${item.filename}: ${error.message}`);
        uploadItemIds.push(item.item_id);
      }

      if (uploadItemIds.length) {
        const started = await startBulkImport(prepared.data.batch_id, uploadItemIds);
        if (!started.ok) throw new Error(started.error);
      }

      setMessage(
        uploadItemIds.length
          ? "Importazione avviata. L’avanzamento viene aggiornato automaticamente."
          : "Tutti i file erano già presenti nello storico: nessun duplicato è stato creato.",
      );
      beginPolling(prepared.data.batch_id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import non riuscito.");
      if (activeBatchId) beginPolling(activeBatchId);
    } finally {
      setBusy(false);
    }
  }

  async function handleRetry(itemIds: string[]) {
    if (!batch || !itemIds.length) return;
    setBusy(true);
    setMessage("Nuovo tentativo in avvio...");
    const result = await retryBulkImport(batch.batch_id, itemIds);
    if (!result.ok) {
      setMessage(result.error);
      setBusy(false);
      return;
    }
    setMessage(
      `Nuovo tentativo avviato per ${result.data.accepted_items} file; ${result.data.reconciled_items} erano già presenti nello storico.`,
    );
    setBusy(false);
    beginPolling(batch.batch_id);
  }

  const terminal = progress && ["completed", "partial", "failed"].includes(progress.status);
  const completed = progress?.completed_items ?? 0;
  const total = progress?.total_items ?? batch?.total_items ?? 0;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const failedIds = items.filter((item) => item.status === "failed").map((item) => item.id);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label htmlFor="bulk-files" className="text-sm font-semibold text-slate-900">
          Documenti commerciali
        </label>
        <input
          id="bulk-files"
          type="file"
          multiple
          accept=".eml,.pdf,.xls,.xlsx"
          disabled={busy || (!!progress && !terminal)}
          onChange={(event) => {
            setFiles(Array.from(event.target.files ?? []));
            setMessage("");
            setBatch(null);
            setProgress(null);
            setItems([]);
            stopPolling();
          }}
          className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
        />
        <p className="text-xs text-slate-500">
          EML, PDF, XLS o XLSX · max 25 file · 25 MB/file · 100 MB totali
        </p>
        {files.length ? (
          <p className="text-xs font-medium text-slate-700">
            {files.length} file selezionati · {(files.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(1)} MB
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => void handleImport()}
        disabled={busy || !files.length || (!!progress && !terminal)}
        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "Preparazione..." : "Avvia importazione"}
      </button>

      {message ? (
        <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      {progress ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Importazione {progress.status}</p>
              <p className="text-xs text-slate-500">
                {progress.completed_items}/{progress.total_items} completati · {progress.failed_items} errori · {progress.deduplicated_items} già presenti
              </p>
            </div>
            <span className="text-sm font-semibold text-slate-700">{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-slate-950 transition-all" style={{ width: `${percent}%` }} />
          </div>

          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.filename}</p>
                  <p className="text-xs text-slate-500">
                    {item.status} · tentativi: {item.attempt_count}{item.deduplicated ? " · già presente nello storico" : ""}
                  </p>
                  {item.last_error ? <p className="mt-1 text-xs text-rose-700">{item.last_error}</p> : null}
                </div>
                {item.status === "failed" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRetry([item.id])}
                    className="self-start rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:self-auto"
                  >
                    Riprova
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {failedIds.length > 1 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRetry(failedIds)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
            >
              Riprova tutti gli errori
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
