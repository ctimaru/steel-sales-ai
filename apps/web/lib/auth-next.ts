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
  return path === "/register" ||
    path.startsWith("/register?") ||
    path === "/registration/status" ||
    path.startsWith("/registration/status?");
}
