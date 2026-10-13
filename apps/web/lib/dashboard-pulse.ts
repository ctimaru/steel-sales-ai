import "server-only";

import { parsePulseEngagement, type PulseEngagement } from "@/lib/steel-pulse-engagement";
import {
  EMPTY_PULSE_ADVANCED_INTERESTS,
  parsePulseAdvancedInterests,
  rankPersonalizedPulseCards,
  type PulseAdvancedInterests,
} from "@/lib/steel-pulse-advanced";
import {
  parsePulsePersonalizedFeed,
  type PulsePersonalizedFeed,
} from "@/lib/steel-pulse-personalized";
import { createClient } from "@/lib/supabase/server";

export type DashboardPulseState = {
  available: boolean;
  feed: PulsePersonalizedFeed | null;
  engagement: PulseEngagement | null;
  interests: PulseAdvancedInterests;
};

/**
 * DASH-FEED3: read only the user's governed, published Steel Pulse content.
 * These RPCs enforce identity and current publication rights in the database.
 * Never query editorial drafts, private commercial data, or service-role tables.
 * Reads run concurrently with the commercial dashboard; no polling.
 */
export async function loadDashboardPulse(): Promise<DashboardPulseState> {
  const unavailable: DashboardPulseState = {
    available: false, feed: null, engagement: null,
    interests: EMPTY_PULSE_ADVANCED_INTERESTS,
  };
  try {
    const db = await createClient();
    const [feedResult, engagementResult, interestsResult] = await Promise.all([
      db.rpc("sp5_my_steel_pulse_feed", { p_limit: 6 }),
      db.rpc("sp6_my_article_engagement", { p_limit: 12 }),
      db.rpc("sp8_my_feed_interests"),
    ]);
    if (feedResult.error) return unavailable;
    const feed = parsePulsePersonalizedFeed(feedResult.data);
    if (!feed) return unavailable;

    const engagement = engagementResult.error
      ? null
      : parsePulseEngagement(engagementResult.data);

    const interests = interestsResult.error
      ? EMPTY_PULSE_ADVANCED_INTERESTS
      : parsePulseAdvancedInterests(interestsResult.data) ?? EMPTY_PULSE_ADVANCED_INTERESTS;
    const ordered = rankPersonalizedPulseCards(feed.items, interests, feed.preferences.role_interest);
    return {
      available: true, feed: { ...feed, items: ordered.slice(0, 6) }, engagement, interests,
    };
  } catch {
    return unavailable;
  }
}
