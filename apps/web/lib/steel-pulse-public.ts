import { createClient } from "@supabase/supabase-js";

export type SteelPulsePublicCard = {
  headline: string;
  summary: string;
  relevance: string;
  topic: "market" | "trade" | "regulation" | "raw_materials" | "technology" | "companies";
  language_code: "it" | "en";
  source_name: string;
  source_url: string;
  source_published_at: string | null;
};

const TOPICS = new Set<SteelPulsePublicCard["topic"]>([
  "market", "trade", "regulation", "raw_materials", "technology", "companies",
]);

function validText(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim().length >= min && value.length <= max &&
    !/[<>]/.test(value);
}

export function isSteelPulsePublicCard(value: unknown): value is SteelPulsePublicCard {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const card = value as Record<string, unknown>;
  if (
    !validText(card.headline, 25, 160) ||
    !validText(card.summary, 60, 650) ||
    !validText(card.relevance, 40, 380) ||
    !validText(card.source_name, 2, 140) ||
    !TOPICS.has(card.topic as SteelPulsePublicCard["topic"]) ||
    !["it", "en"].includes(String(card.language_code)) ||
    (card.source_published_at !== null && card.source_published_at !== undefined &&
      (typeof card.source_published_at !== "string" ||
        !Number.isFinite(Date.parse(card.source_published_at))))
  ) {
    return false;
  }
  try {
    const link = new URL(String(card.source_url));
    return link.protocol === "https:" && link.username === "" &&
      link.password === "" && link.port === "" && !link.hash;
  } catch {
    return false;
  }
}

/**
 * Public, anonymous and fail-closed. Never use service_role or any user session.
 * A production DB without SP4 migration safely renders the no-news state.
 * Explicit no-store allows source-rights revocation to take effect on new requests.
 */
export async function listSteelPulsePublicCards(): Promise<SteelPulsePublicCard[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];

  try {
    const client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            cache: "no-store",
            signal: AbortSignal.timeout(2500),
          }),
      },
    });
    const { data, error } = await client.rpc("sp4_public_steel_pulse_feed", {
      p_limit: 3,
    });
    if (error || !Array.isArray(data)) return [];
    return data.filter(isSteelPulsePublicCard).slice(0, 3);
  } catch {
    return [];
  }
}
