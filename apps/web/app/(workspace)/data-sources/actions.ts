"use server";

import { createClient } from "@/lib/supabase/server";

export type DataSourceState =
  | "all"
  | "ready"
  | "indexed"
  | "indexing"
  | "processing"
  | "duplicate"
  | "error"
  | "discarded";

export type DataSourceSummary = {
  total: number;
  indexed: number;
  indexing: number;
  duplicates: number;
  errors: number;
  discarded: number;
  processing: number;
  last_sync_at: string | null;
  active_model_key: string | null;
  active_model_name: string | null;
};

export type DataSourceOverview = {
  source_key: string;
  source_name: string;
  source_type: string;
  total_items: number;
  indexed_items: number;
  duplicate_items: number;
  error_items: number;
  last_sync_at: string | null;
};

export type ImportHistoryItem = {
  history_id: string;
  batch_id: string | null;
  item_id: string | null;
  document_id: string | null;
  display_name: string;
  media_type: "email" | "file";
  source_key: string;
  source_name: string;
  source_type: string;
  state: "ready" | "processing" | "duplicate" | "error" | "discarded";
  indexing_state:
    | "indexed"
    | "indexing"
    | "pending"
    | "no_content"
    | "not_available"
    | "not_applicable";
  deduplicated: boolean;
  error: string | null;
  attempt_count: number;
  size_bytes: number | null;
  chunk_count: number;
  embedded_count: number;
  imported_at: string;
  last_sync_at: string | null;
};

export type DataSourceCenterPayload = {
  summary: DataSourceSummary;
  sources: DataSourceOverview[];
  items: ImportHistoryItem[];
  total_filtered: number;
  limit: number;
  offset: number;
};

export type DataSourceCenterResult =
  | { ok: true; data: DataSourceCenterPayload }
  | { ok: false; error: string };

export type DataSourceCenterQuery = {
  search?: string;
  state?: DataSourceState;
  sourceKey?: string;
  limit?: number;
  offset?: number;
};

export async function loadDataSourceCenter(
  query: DataSourceCenterQuery = {},
): Promise<DataSourceCenterResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const actorUserId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!actorUserId) {
    return { ok: false, error: "Sessione scaduta. Accedi di nuovo." };
  }

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  if (!workerUrl) {
    return { ok: false, error: "Worker non configurato nell'ambiente web." };
  }

  const headers: HeadersInit = { "content-type": "application/json" };
  if (process.env.WORKER_INTERNAL_TOKEN) {
    headers["x-worker-token"] = process.env.WORKER_INTERNAL_TOKEN;
  }

  try {
    const response = await fetch(`${workerUrl}/v1/data-sources/history`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        actor_user_id: actorUserId,
        search: query.search || null,
        state: query.state === "all" ? null : query.state || null,
        source_key: query.sourceKey || null,
        limit: Math.max(1, Math.min(query.limit ?? 50, 100)),
        offset: Math.max(0, query.offset ?? 0),
      }),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | DataSourceCenterPayload
      | { detail?: string }
      | null;
    if (!response.ok || !payload || "detail" in payload) {
      return {
        ok: false,
        error:
          payload && "detail" in payload && payload.detail
            ? payload.detail
            : "Impossibile caricare il Data source center.",
      };
    }
    return { ok: true, data: payload };
  } catch {
    return { ok: false, error: "Worker Data source center non raggiungibile." };
  }
}
