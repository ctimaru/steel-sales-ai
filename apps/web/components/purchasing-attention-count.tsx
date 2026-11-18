"use client";

import { useEffect, useState } from "react";

import { getPurchasingAttentionCount } from "@/app/(workspace)/rfq-hub/attention-actions";

// One request per minute at most, shared by every menu render (desktop + mobile).
let cache: { at: number; value: Promise<number> } | null = null;
function load(): Promise<number> {
  if (!cache || Date.now() - cache.at > 60_000) {
    cache = { at: Date.now(), value: getPurchasingAttentionCount().catch(() => 0) };
  }
  return cache.value;
}

/** RFQHUB1: «Centro RFQ · 3» — requests that need an action. */
export function PurchasingAttentionCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    load().then((value) => { if (alive) setCount(value); });
    return () => { alive = false; };
  }, []);
  if (count < 1) return null;
  return (
    <span data-testid="purchasing-attention-count" aria-label={count + (count === 1 ? " richiesta da gestire" : " richieste da gestire")}
      className="ml-auto shrink-0 rounded-full bg-[#fff1d6] px-1.5 text-[10px] font-bold text-[#7a4d0e]">
      {count}
    </span>
  );
}
