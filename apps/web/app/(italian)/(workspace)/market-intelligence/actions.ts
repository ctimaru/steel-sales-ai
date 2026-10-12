"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type MarketObservation = {
  period: string | null;
  value: number | null;
  unit: string | null;
  metadata: Record<string, unknown>;
};

export type MarketSourceOverview = {
  key: string;
  name: string;
  provider: string;
  source_url: string;
  series_type: string;
  frequency: string;
  unit: string;
  display_unit: string;
  geography: string | null;
  category: string | null;
  latest: MarketObservation | null;
  change_mom_pct: number | null;
  change_yoy_pct: number | null;
  series: MarketObservation[];
  observation_count: number;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  sync_error: string | null;
};

export type MarketOverview = {
  generated_at: string;
  cache_hours: number;
  sources: MarketSourceOverview[];
};

export type MarketOverviewState = {
  status: "success" | "error";
  message: string;
  data: MarketOverview | null;
};

async function requestMarketOverview(force: boolean): Promise<MarketOverviewState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const ownerId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (!ownerId) {
    return { status: "error", message: "Sessione scaduta. Accedi di nuovo.", data: null };
  }

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  if (!workerUrl) {
    return {
      status: "error",
      message: "Worker non configurato nell'ambiente web.",
      data: null,
    };
  }

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (process.env.WORKER_INTERNAL_TOKEN) {
    headers["x-worker-token"] = process.env.WORKER_INTERNAL_TOKEN;
  }

  try {
    const response = await fetch(`${workerUrl}/v1/market/overview`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        owner_id: ownerId,
        refresh: true,
        force,
      }),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | MarketOverview
      | { detail?: string }
      | null;

    if (!response.ok || !payload || !("sources" in payload)) {
      return {
        status: "error",
        message: payload && "detail" in payload && payload.detail
          ? payload.detail
          : "Market Intelligence non disponibile.",
        data: null,
      };
    }

    return {
      status: "success",
      message: "Dati di mercato aggiornati da fonti ufficiali.",
      data: payload,
    };
  } catch {
    return { status: "error", message: "Worker non raggiungibile.", data: null };
  }
}

export async function loadMarketOverview(): Promise<MarketOverviewState> {
  return requestMarketOverview(false);
}

export async function refreshMarketData(): Promise<void> {
  await requestMarketOverview(true);
  revalidatePath("/market-intelligence");
}
