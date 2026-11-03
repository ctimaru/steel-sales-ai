/**
 * ONBOARDING-AUDIT2 · F8 — feedback text read from ?error= / ?message=.
 *
 * Registration pages show the message carried in the URL after a redirect.
 * React escapes it (no XSS), but anyone could craft a link that shows an
 * official-looking message such as "call +39 …" or "go to example.net".
 * Our own messages never carry links, foreign domains or addresses, or phone
 * numbers, so anything that does is replaced by a neutral fallback.
 */
const OWN_DOMAIN = "smartsteelsales.com";

function looksInjected(text: string): boolean {
  const lower = text.toLowerCase();
  if (/[<>]/.test(text)) return true;
  if (/(https?:\/\/|www\.)/.test(lower)) return true;

  for (const match of lower.matchAll(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/g)) {
    if (match[1] !== OWN_DOMAIN) return true;
  }
  for (const match of lower.matchAll(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/g)) {
    const domain = match[1];
    if (domain !== OWN_DOMAIN && !domain.endsWith("." + OWN_DOMAIN) && /\.(com|it|net|org|io|eu|info|biz|co|me|app|xyz|link|ly)$/.test(domain)) {
      return true;
    }
  }
  // Seven or more digits in a row, allowing spaces, dots, dashes or a leading +: a phone number.
  if (/\+?\d(?:[\s.-]?\d){6,}/.test(text)) return true;
  return false;
}

export function safeUrlFeedback(
  value: unknown,
  locale: "it" | "en" = "it",
): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length > 400 || looksInjected(text)) {
    return locale === "en"
      ? "The operation could not be completed. Please try again."
      : "Non è stato possibile completare l’operazione. Riprova.";
  }
  return text;
}
