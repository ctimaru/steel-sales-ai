"use client";

import { useEffect, useRef } from "react";

import { createPublicSupabaseClient } from "@/lib/supabase/public";

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
    sent.current = true;

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
