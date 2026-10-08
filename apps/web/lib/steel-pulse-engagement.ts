import { isSteelPulsePublicCard, type SteelPulsePublicCard } from "@/lib/steel-pulse-public";

export type PulseEngagement = {
  saved_items: SteelPulsePublicCard[];
  saved_urls: string[];
  read_urls: string[];
};

export type PulseEngagementAction = "save" | "unsave" | "read" | "unread";

const ACTIONS = new Set<PulseEngagementAction>(["save", "unsave", "read", "unread"]);

export function validatePulseAction(value: unknown): value is PulseEngagementAction {
  return typeof value === "string" && ACTIONS.has(value as PulseEngagementAction);
}

export function validatePulseSourceUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 12 || value.length > 2048 ||
      /\s|[?#]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.port && url.href === value;
  } catch {
    return false;
  }
}

export function parsePulseEngagement(value: unknown): PulseEngagement | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.saved_items) || obj.saved_items.length > 12 ||
      !obj.saved_items.every(isSteelPulsePublicCard)) return null;
  if (!Array.isArray(obj.saved_urls) || !Array.isArray(obj.read_urls) ||
      obj.saved_urls.length > 1000 || obj.read_urls.length > 1000 ||
      !obj.saved_urls.every(validatePulseSourceUrl) ||
      !obj.read_urls.every(validatePulseSourceUrl)) return null;
  return {
    saved_items: obj.saved_items as SteelPulsePublicCard[],
    saved_urls: obj.saved_urls as string[],
    read_urls: obj.read_urls as string[],
  };
}
