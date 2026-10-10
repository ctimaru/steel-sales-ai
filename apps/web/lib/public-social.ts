/**
 * A LinkedIn Company Page is not assumed to exist until its real URL is set.
 * Use NEXT_PUBLIC_LINKEDIN_COMPANY_URL only after creating and verifying the Page.
 * The URL deliberately points to the Page, not an unsupported messaging deep link.
 */
export function getLinkedInCompanyUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_LINKEDIN_COMPANY_URL?.trim();
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (
      url.protocol !== "https:" ||
      !["linkedin.com", "www.linkedin.com"].includes(url.hostname) ||
      !/^\/company\/[a-z0-9-]+\/?$/i.test(url.pathname) ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}
