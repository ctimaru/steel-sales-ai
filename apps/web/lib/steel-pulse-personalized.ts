import { isSteelPulsePublicCard, type SteelPulsePublicCard } from "@/lib/steel-pulse-public";

export const pulseTopics = [
  { key: "market", label: "Mercato" },
  { key: "trade", label: "Commercio" },
  { key: "regulation", label: "Normative" },
  { key: "raw_materials", label: "Materie prime" },
  { key: "technology", label: "Tecnologia" },
  { key: "companies", label: "Industria" },
] as const;

export const pulseProfessionalInterests = [
  { key: "all", label: "Tutto il settore" },
  { key: "producer", label: "Produttore" },
  { key: "trader", label: "Commerciante" },
  { key: "processor", label: "Terzista" },
  { key: "end_user", label: "Utilizzatore" },
] as const;

export type PulseTopic = (typeof pulseTopics)[number]["key"];
export type PulseProfessionalInterest = (typeof pulseProfessionalInterests)[number]["key"];
export type PulsePreferences = {
  topics: PulseTopic[];
  role_interest: PulseProfessionalInterest;
  language_code: "it" | "en";
};
export type PulsePersonalizedFeed = {
  preferences: PulsePreferences;
  items: SteelPulsePublicCard[];
};

const ALLOWED_TOPICS = new Set<string>(pulseTopics.map((x) => x.key));
const ALLOWED_PROFESSIONS = new Set<string>(pulseProfessionalInterests.map((x) => x.key));

export function validatePulsePreferences(value: unknown): PulsePreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.topics) || data.topics.length > 6) return null;
  if (!data.topics.every((v: unknown) => typeof v === "string" && ALLOWED_TOPICS.has(v))) return null;
  if (new Set(data.topics).size !== data.topics.length) return null;
  if (typeof data.role_interest !== "string" || !ALLOWED_PROFESSIONS.has(data.role_interest)) return null;
  if (data.language_code !== "it" && data.language_code !== "en") return null;
  return {
    topics: data.topics as PulseTopic[],
    role_interest: data.role_interest as PulseProfessionalInterest,
    language_code: data.language_code,
  };
}

export function parsePulsePersonalizedFeed(value: unknown): PulsePersonalizedFeed | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const preferences = validatePulsePreferences(data.preferences);
  if (!preferences || !Array.isArray(data.items)) return null;
  if (data.items.length > 12 || !data.items.every(isSteelPulsePublicCard)) return null;
  return { preferences, items: data.items as SteelPulsePublicCard[] };
}

export const EMPTY_PULSE_PREFERENCES: PulsePreferences = {
  topics: [],
  role_interest: "all",
  language_code: "it",
};
