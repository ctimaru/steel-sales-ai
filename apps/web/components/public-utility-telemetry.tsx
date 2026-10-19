"use client";

import { useEffect, useRef } from "react";

import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { hasCurrentAnalyticsConsent, trackSchoolStage } from "@/lib/school-acquisition.client";

export type PublicUtilityDiscoverySource = "direct" | "home" | "school";
export type PublicUtilityDiscoverySurface =
  | "direct"
  | "header"
  | "hero"
  | "quick_actions"
  | "school_section"
  | "nav"
  | "home_card";

export function PublicUtilityTelemetry({
  source,
  surface,
}: {
  source: PublicUtilityDiscoverySource;
  surface: PublicUtilityDiscoverySurface;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    // Honor explicit consent before any analytics insert.
    if (!hasCurrentAnalyticsConsent()) return;
    sent.current = true;
    if (source === "school") trackSchoolStage("calculator_open", "calculator");

    const supabase = createPublicSupabaseClient();
    if (!supabase) return;

    void supabase
      .from("public_utility_events")
      .insert({
        event_name: "calculator_opened",
        source,
        surface,
      })
      .then(({ error }) => {
        if (error) {
          console.warn("Public utility telemetry unavailable:", error.message);
        }
      });
  }, [source, surface]);

  return null;
}
