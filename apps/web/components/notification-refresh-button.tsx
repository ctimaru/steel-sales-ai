"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Explicit retry; only the existing, authenticated server RPC can verify freshness. */
export function NotificationRefreshButton() {
  const router=useRouter();
  const [pending,startTransition]=useTransition();
  return (
    <button type="button" onClick={()=>startTransition(()=>router.refresh())}
      disabled={pending}
      className="inline-flex min-h-10 items-center rounded-xl border border-[#d2dfd8] bg-white px-4 text-sm font-semibold text-[#365749] hover:bg-[#edf5f2] disabled:opacity-60"
      aria-label="Verifica adesso le notifiche">
      {pending ? "Aggiornamento…" : "Aggiorna"}
    </button>
  );
}
