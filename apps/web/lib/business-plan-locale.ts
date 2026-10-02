export type BusinessPlanLocale = "it" | "en";

export function resolveBusinessPlanLocale(
  value: string | string[] | undefined,
  fallback: BusinessPlanLocale,
): BusinessPlanLocale {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "it" || candidate === "en" ? candidate : fallback;
}

export function withBusinessPlanLocale(
  href: string,
  locale: BusinessPlanLocale,
) {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}lang=${locale}`;
}
