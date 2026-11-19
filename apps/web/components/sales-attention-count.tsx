"use client";

import { useEffect, useState } from "react";

import { getSalesAttentionCount } from "@/app/(workspace)/commercial/attention-actions";

// One request per minute at most, shared by every menu render (desktop + mobile).
let cache: { at: number; value: Promise<number> } | null = null;
function load(): Promise<number> {
  if (!cache || Date.now() - cache.at > 60_000) {
    cache = { at: Date.now(), value: getSalesAttentionCount().catch(() => 0) };
  }
  return cache.value;
}

/** COMM-CLIENTS1: «Richieste d'offerta · 3» — customer requests that wait for you. */
// On the selected (dark green) menu item the link forces white text on every
// child, so the badge switches to a dark amber fill: white on #7a4d0e ≈ 7.8:1.
export function SalesAttentionCount({ onDark = false }: { onDark?: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    load().then((value) => { if (alive) setCount(value); });
    return () => { alive = false; };
  }, []);
  if (count < 1) return null;
  return (
    <span data-testid="sales-attention-count" aria-label={count + (count === 1 ? " richiesta da gestire" : " richieste da gestire")}
      className={"ml-auto shrink-0 rounded-full px-1.5 text-[10px] font-bold tabular-nums " +
        (onDark ? "bg-[#7a4d0e] text-white ring-1 ring-white/40" : "bg-[#fff1d6] text-[#7a4d0e]")}>
      {count}
    </span>
  );
}
