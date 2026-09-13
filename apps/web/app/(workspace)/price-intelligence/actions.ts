"use server";

import { createClient } from "@/lib/supabase/server";

export type PriceObservation = {
  id: number;
  thread_id: string;
  grade: string | null;
  standard: string | null;
  outer_diameter_mm: number | string | null;
  width_mm: number | string | null;
  height_mm: number | string | null;
  thickness_mm: number | string | null;
  length_mm: number | string | null;
  quantity: number | string | null;
  quantity_unit: string | null;
  price_value: number | string;
  price_unit: string | null;
  currency: string | null;
  source_text: string | null;
  source_filename: string | null;
  confidence: number | string | null;
  commercial_at: string | null;
  thread_subject: string | null;
};

export type PriceMarketOverlayPoint = {
  observation_id: number | null;
  thread_id: string | null;
  commercial_at: string | null;
  price_value: number | null;
  price_unit: string | null;
  currency: string | null;
  market_period: string | null;
  market_value: number | null;
  market_change_to_latest_pct: number | null;
  market_has_newer_data: boolean;
  price_change_from_first_pct: number | null;
  market_change_from_first_pct: number | null;
};

export type PriceMarketOverlay = {
  reference_price_unit: string | null;
  reference_currency: string | null;
  comparable_price_count: number;
  market_source: {
    key: string | null;
    name: string | null;
    provider: string | null;
    source_url: string | null;
    unit: string | null;
    display_unit: string | null;
    latest_period: string | null;
    latest_value: number | null;
  };
  summary: {
    price_change_pct: number | null;
    market_change_same_window_pct: number | null;
    divergence_pct_points: number | null;
    market_change_since_latest_offer_pct: number | null;
    latest_offer_market_period: string | null;
  };
  points: PriceMarketOverlayPoint[];
};

export type PriceLookupState = {
  status: "idle" | "success" | "error";
  message: string;
  observation?: PriceObservation | null;
  history?: PriceObservation[];
  overlay?: PriceMarketOverlay | null;
};

function textValue(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function numberValue(formData: FormData, name: string): number | undefined {
  const raw = textValue(formData, name);
  if (!raw) return undefined;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function lookupLatestPrice(
  _previousState: PriceLookupState,
  formData: FormData,
): Promise<PriceLookupState> {
  const grade = textValue(formData, "grade")?.toUpperCase();
  const outerDiameter = numberValue(formData, "outer_diameter_mm");
  const thickness = numberValue(formData, "thickness_mm");
  const width = numberValue(formData, "width_mm");
  const height = numberValue(formData, "height_mm");

  if (!grade && outerDiameter === undefined && thickness === undefined && width === undefined && height === undefined) {
    return {
      status: "error",
      message: "Inserisci almeno un criterio di ricerca.",
    };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const ownerId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (!ownerId) {
    return { status: "error", message: "Sessione scaduta. Accedi di nuovo." };
  }

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  if (!workerUrl) {
    return { status: "error", message: "Worker non configurato nell'ambiente web." };
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (process.env.WORKER_INTERNAL_TOKEN) {
    headers["x-worker-token"] = process.env.WORKER_INTERNAL_TOKEN;
  }

  try {
    const response = await fetch(`${workerUrl}/v1/market/price-overlay`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        owner_id: ownerId,
        grade,
        outer_diameter_mm: outerDiameter,
        thickness_mm: thickness,
        width_mm: width,
        height_mm: height,
        limit: 50,
      }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          found?: boolean;
          count?: number;
          observations?: PriceObservation[];
          overlay?: PriceMarketOverlay;
          detail?: string;
        }
      | null;

    if (!response.ok) {
      return {
        status: "error",
        message: payload?.detail ?? "La ricerca prezzo non è riuscita.",
      };
    }

    const history = payload?.observations ?? [];
    if (!payload?.found || history.length === 0) {
      return {
        status: "success",
        message: "Nessuna offerta con prezzo trovata per i criteri indicati.",
        observation: null,
        history: [],
        overlay: payload?.overlay ?? null,
      };
    }

    return {
      status: "success",
      message: history.length === 1
        ? "Trovata 1 offerta con prezzo nel tuo storico commerciale."
        : `Trovate ${history.length} offerte con prezzo nel tuo storico commerciale.`,
      observation: history[0],
      history,
      overlay: payload?.overlay ?? null,
    };
  } catch {
    return { status: "error", message: "Worker non raggiungibile." };
  }
}
