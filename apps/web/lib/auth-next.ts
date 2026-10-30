export function safeInternalNext(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/dashboard",
) {
  const candidate = String(value ?? "").trim();

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(candidate, "https://smartsteelsales.local");
    if (url.origin !== "https://smartsteelsales.local") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

export function isRegistrationNext(path: string) {
  return path === "/en/register" ||
    path.startsWith("/en/register?") ||
    path === "/en/registration/status" ||
    path.startsWith("/en/registration/status?") ||
    path === "/register" ||
    path.startsWith("/register?") ||
    path === "/registration/status" ||
    path.startsWith("/registration/status?");
}

/**
 * UX1: Pass only a bounded, non-sensitive destination through the public
 * registration/email URLs. Full drafts remain tab-scoped in sessionStorage.
 */
export function safeCommercialReturnTo(
  value: FormDataEntryValue | string | null | undefined,
): string | null {
  const candidate = String(value ?? "").trim();
  if (!candidate || candidate.length > 512) return null;
  const safe = safeInternalNext(candidate, "");
  if (!safe) return null;
  const url = new URL(safe, "https://smartsteelsales.local");
  const allowed = ["/distinta", "/rfq-hub", "/commercial", "/marketplace", "/network"];
  if (!allowed.some((root) => url.pathname === root || url.pathname.startsWith(root + "/"))) {
    return null;
  }
  // Exclude query strings (customer text, tokens, search terms) and fragments.
  return url.pathname;
}

export function withCommercialReturnTo(path: string, value: string | null | undefined): string {
  const destination = safeCommercialReturnTo(value);
  if (!destination) return path;
  return path + (path.includes("?") ? "&" : "?") +
    "return_to=" + encodeURIComponent(destination);
}

export function registrationEntryForNext(
  next: string | null | undefined,
  locale: "it" | "en",
): string {
  if (next && (next === "/register" || next.startsWith("/register?") ||
    next === "/en/register" || next.startsWith("/en/register?"))) {
    return next;
  }
  return withCommercialReturnTo(locale === "en" ? "/en/register" : "/register", next);
}
