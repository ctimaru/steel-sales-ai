"use client";

import { useEffect, useState } from "react";

function formatRemaining(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (days > 0) {
    return `${days}g ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function MarketplaceCountdown({
  initialSeconds,
  compact = false,
}: {
  initialSeconds: number;
  compact?: boolean;
}) {
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.floor(initialSeconds)));

  useEffect(() => {
    setSeconds(Math.max(0, Math.floor(initialSeconds)));
    if (initialSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [initialSeconds]);

  if (seconds <= 0) {
    return <span className="font-semibold text-[#66736e]">Scaduta</span>;
  }

  return (
    <span
      className={[
        "font-semibold tabular-nums",
        seconds <= 86400 ? "text-amber-700" : "text-[#173f35]",
        compact ? "text-xs" : "text-sm",
      ].join(" ")}
      aria-label={`Tempo residuo: ${formatRemaining(seconds)}`}
    >
      {formatRemaining(seconds)}
    </span>
  );
}
