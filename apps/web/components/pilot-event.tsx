"use client";

import { useEffect, useRef } from "react";

import {
  recordPilotUsageEvent,
  type PilotEventInput,
} from "@/app/(workspace)/telemetry/actions";

export function PilotEvent(props: PilotEventInput) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void recordPilotUsageEvent(props);
  }, [props]);

  return null;
}
