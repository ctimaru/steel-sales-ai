const fallbackSiteUrl = "https://smartsteelsales.com";

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || fallbackSiteUrl
).replace(/\/$/, "");

export function absoluteUrl(path = "/") {
  if (!path || path === "/") return siteUrl + "/";
  return siteUrl + (path.startsWith("/") ? path : `/${path}`);
}
