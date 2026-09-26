"use server";

import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceWriteRole } from "@/lib/workspace-context";

export type BulkFileDescriptor = {
  filename: string;
  size_bytes: number;
  content_checksum: string;
};

export type PreparedBulkItem = {
  item_id: string;
  filename: string;
  status: "queued" | "completed";
  storage_path: string;
  upload_token: string | null;
  deduplicated: boolean;
};

export type PreparedBulkBatch = {
  batch_id: string;
  status: string;
  total_items: number;
  items: PreparedBulkItem[];
};

export type BulkActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function ownerId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

function workerConfig(): { url: string; headers: HeadersInit } | null {
  const url = process.env.WORKER_URL?.replace(/\/$/, "");
  if (!url) return null;
  const headers: HeadersInit = { "content-type": "application/json" };
  if (process.env.WORKER_INTERNAL_TOKEN) {
    headers["x-worker-token"] = process.env.WORKER_INTERNAL_TOKEN;
  }
  return { url, headers };
}

async function postWorker<T extends object>(path: string, body: object): Promise<BulkActionResult<T>> {
  const config = workerConfig();
  if (!config) return { ok: false, error: "Worker non configurato nell'ambiente web." };

  try {
    const response = await fetch(`${config.url}${path}`, {
      method: "POST",
      headers: config.headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | T
      | { detail?: string }
      | null;
    if (!response.ok || !payload) {
      const detail = payload && "detail" in payload ? payload.detail : null;
      return { ok: false, error: detail ?? "Il worker ha rifiutato la richiesta." };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, error: "Worker non raggiungibile." };
  }
}

export async function prepareBulkImport(
  files: BulkFileDescriptor[],
): Promise<BulkActionResult<PreparedBulkBatch>> {
  await requireWorkspaceWriteRole();
  const actorUserId = await ownerId();
  if (!actorUserId) return { ok: false, error: "Sessione scaduta. Accedi di nuovo." };
  return postWorker<PreparedBulkBatch>("/v1/import-batches/prepare", {
    actor_user_id: actorUserId,
    files,
  });
}

export async function startBulkImport(
  batchId: string,
  itemIds: string[],
): Promise<BulkActionResult<{ batch_id: string; accepted_items: number; skipped_items: number }>> {
  await requireWorkspaceWriteRole();
  const actorUserId = await ownerId();
  if (!actorUserId) return { ok: false, error: "Sessione scaduta. Accedi di nuovo." };
  return postWorker(`/v1/import-batches/${batchId}/start`, {
    actor_user_id: actorUserId,
    item_ids: itemIds,
  });
}

export async function retryBulkImport(
  batchId: string,
  itemIds: string[],
): Promise<
  BulkActionResult<{
    batch_id: string;
    accepted_items: number;
    reconciled_items: number;
    skipped_items: number;
  }>
> {
  await requireWorkspaceWriteRole();
  const actorUserId = await ownerId();
  if (!actorUserId) return { ok: false, error: "Sessione scaduta. Accedi di nuovo." };
  return postWorker(`/v1/import-batches/${batchId}/retry`, {
    actor_user_id: actorUserId,
    item_ids: itemIds,
  });
}
