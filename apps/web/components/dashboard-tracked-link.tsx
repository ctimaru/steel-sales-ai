"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { recordPilotUsageEvent, type PilotEventName } from "@/app/(workspace)/telemetry/actions";

export type DashboardEngagementKind =
  | "news_source"
  | "interests"
  | "network_profile"
  | "marketplace_teaser";

const events: Record<DashboardEngagementKind, PilotEventName> = {
  news_source: "dashboard_news_source_opened",
  interests: "dashboard_interest_settings_opened",
  network_profile: "dashboard_network_profile_opened",
  marketplace_teaser: "dashboard_marketplace_teaser_opened",
};

/** Records explicit link activations only, without article URL, buyer or RFQ IDs.
 * Best-effort: navigation is NEVER delayed or blocked by analytics.
 */
export function DashboardTrackedLink({
  engagementKind,
  onClick,
  ...props
}: ComponentProps<typeof Link> & { engagementKind: DashboardEngagementKind }) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 ||
            event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        void recordPilotUsageEvent({
          eventName: events[engagementKind],
          metadata: { source: "dashboard_feed", surface: "dashboard" },
        });
      }}
    />
  );
}
