"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

const PUBLIC_PAGEVIEW_PREFIXES = [
  "/knowledge",
  "/azienda",
  "/register",
  "/login",
  "/cookies",
  "/privacy",
  "/terms",
  "/company-data",
  "/distinta",
  "/rfq/respond",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

function isMeasuredPublicPath(pathname: string) {
  return pathname === "/" || PUBLIC_PAGEVIEW_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function redactDynamicSegment(segment: string) {
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment) ||
    /^[0-9a-f]{32,64}$/i.test(segment) ||
    /^[A-Za-z0-9_-]{24,}$/.test(segment)
  ) {
    return ":id";
  }
  return segment;
}

export function sanitizeProductAnalyticsEvent(event: BeforeSendEvent) {
  try {
    const url = new URL(event.url);
    if (!isMeasuredPublicPath(url.pathname)) {
      return null;
    }

    url.pathname = url.pathname
      .split("/")
      .map(redactDynamicSegment)
      .join("/");
    url.search = "";
    url.hash = "";

    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}

export function ProductAnalyticsIngestion() {
  return <Analytics beforeSend={sanitizeProductAnalyticsEvent} />;
}
