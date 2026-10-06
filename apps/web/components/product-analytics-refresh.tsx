"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const REFRESH_SECONDS = 60;

export function ProductAnalyticsRefresh({
  generatedAt,
}: {
  generatedAt: string;
}) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(REFRESH_SECONDS);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          startTransition(() => router.refresh());
          return REFRESH_SECONDS;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [router]);

  function refreshNow() {
    setSeconds(REFRESH_SECONDS);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#718078]">
      <span>
        Aggiornato {new Date(generatedAt).toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </span>
      <span aria-hidden="true">·</span>
      <span>{pending ? "Aggiornamento…" : `auto refresh tra ${seconds}s`}</span>
      <button
        type="button"
        onClick={refreshNow}
        disabled={pending}
        className="rounded-full border border-[#d7dfdb] bg-white px-2.5 py-1 font-semibold text-[#43524c] hover:border-[#b8d2c8] hover:bg-[#f4f7f5] disabled:opacity-50"
      >
        Aggiorna ora
      </button>
    </div>
  );
}
