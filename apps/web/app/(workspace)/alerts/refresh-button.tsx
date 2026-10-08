"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function OperationalAlertsRefreshButton({
  label = "Riprova",
}: {
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      aria-busy={pending}
      className="app-primary inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
    >
      {pending ? "Aggiornamento…" : label}
    </button>
  );
}
