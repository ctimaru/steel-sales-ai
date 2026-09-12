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

export type PriceLookupState = {
  status: "idle" | "success" | "error";
  message: string;
  observation?: PriceObservation | null;
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
    const response = await fetch(`${workerUrl}/v1/ai/latest-price`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        owner_id: ownerId,
        grade,
        outer_diameter_mm: outerDiameter,
        thickness_mm: thickness,
        width_mm: width,
        height_mm: height,
      }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as
      | { found?: boolean; observation?: PriceObservation | null; detail?: string }
      | null;

    if (!response.ok) {
      return {
        status: "error",
        message: payload?.detail ?? "La ricerca prezzo non è riuscita.",
      };
    }

    if (!payload?.found || !payload.observation) {
      return {
        status: "success",
        message: "Nessuna offerta con prezzo trovata per i criteri indicati.",
        observation: null,
      };
    }

    return {
      status: "success",
      message: "Ultimo prezzo trovato nel tuo storico commerciale.",
      observation: payload.observation,
    };
  } catch {
    return { status: "error", message: "Worker non raggiungibile." };
  }
}
