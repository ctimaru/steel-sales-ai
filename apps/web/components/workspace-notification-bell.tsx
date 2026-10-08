"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNotificationFreshness } from "@/lib/use-notification-freshness";
import { useNotificationPopoverDismiss } from "@/lib/use-notification-popover-dismiss";

import { appRoutes } from "@/lib/routes";
import {
  formatNotificationTime,
  type WorkspaceNotificationSnapshot,
} from "@/lib/workspace-notifications";

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor"
      strokeWidth="1.8" aria-hidden="true">
      <path d="M6 10a6 6 0 0 1 12 0v4.25l1.5 2.25h-15L6 14.25V10Z" />
      <path d="M9.5 19.5a3 3 0 0 0 5 0" />
    </svg>
  );
}

export function WorkspaceNotificationBell({
  snapshot: initialSnapshot,
  demoMode,
  organizationId,
  initialVerifiedAt,
}: {
  snapshot: WorkspaceNotificationSnapshot | null;
  demoMode: boolean;
  organizationId: string | null;
  initialVerifiedAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const {snapshot,connection,verifiedAt,stale,isRefreshing,refresh} = useNotificationFreshness<WorkspaceNotificationSnapshot>({
    scope:"workspace",organizationId,enabled:!demoMode,
    initialSnapshot,initialVerifiedAt,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dismiss = useCallback(() => setOpen(false), []);
  useNotificationPopoverDismiss({ open, triggerRef, panelRef, onDismiss: dismiss });
  const unavailable = !demoMode && stale;
  const unread = snapshot?.unreadCount ?? 0;

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unavailable ? "Notifiche: verifica non disponibile"
          : demoMode ? "Notifiche: anteprima non configurata"
            : unread > 0 ? `Notifiche: ${unread} da leggere` : "Notifiche: nessuna da leggere"}
        title="Centro notifiche"
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#65716c] transition hover:bg-[#eef1ef] hover:text-[#173f35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35]"
      >
        <BellIcon />
        {unavailable ? (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-[#946515] px-1 text-center text-[10px] font-bold leading-4 text-white">!</span>
        ) : unread > 0 ? (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-[#173f35] px-1 text-center text-[10px] font-bold leading-4 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <aside
            ref={panelRef}
            role="dialog" aria-modal="false" aria-label="Anteprima notifiche Workspace"
            className="fixed inset-x-3 top-[calc(72px+env(safe-area-inset-top))] z-[60] max-h-[min(75dvh,680px)] overflow-y-auto rounded-2xl border border-[#dce5e2] bg-white shadow-2xl sm:left-auto sm:right-5 sm:w-[390px] lg:absolute lg:inset-x-auto lg:right-0 lg:top-12 lg:w-[400px]"
          >
            <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-[#e2e9e5] bg-white p-4">
              <div>
                <h2 className="text-base font-bold text-[#1d2824]">Notifiche</h2>
                <p className="text-xs text-[#66736e]">
                  {unavailable ? "Impossibile verificare lo stato"
                    : demoMode ? "Collega un Workspace per consultarle"
                      : unread > 0 ? `${unread} da leggere · Solo la tua azienda`
                        : "Nessuna da leggere · Solo la tua azienda"}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} autoFocus
                aria-label="Chiudi pannello notifiche"
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#5c6e66] hover:bg-[#edf5f2]">×</button>
            </div>

            <div className="border-b border-[#e2e9e5] px-4 py-2 text-xs text-[#66736e]" aria-live="polite">
              {verifiedAt && !unavailable
                ? `Dati verificati alle ${formatNotificationTime(verifiedAt)} · ${connection === "live" ? "Realtime attivo" : connection === "paused" ? "Aggiornamento sospeso" : "Aggiornamento periodico"}`
                : connection === "paused" ? "Aggiornamento sospeso" : "Dati da verificare"}
              <button type="button" onClick={refresh} disabled={isRefreshing}
                className="ml-2 font-semibold text-[#173f35] underline disabled:opacity-50">
                {isRefreshing ? "Verifica…" : "Aggiorna"}
              </button>
            </div>
            {unavailable ? (
              <div role="alert" className="p-5 text-sm text-[#815e24]">
                Non è stato possibile caricare un dato attendibile. Questo non significa che non ci siano notifiche.
                <button type="button" className="mt-3 block font-semibold underline" onClick={refresh}>
                  Riprova
                </button>
              </div>
            ) : snapshot?.items.length ? (
              <ul className="divide-y divide-[#edf1ef]">
                {snapshot.items.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} onClick={() => setOpen(false)}
                      className="flex min-h-16 gap-3 px-4 py-3 transition hover:bg-[#f4f8f6] focus-visible:bg-[#f4f8f6]">
                      <span aria-hidden="true" className={`mt-2 h-2 w-2 shrink-0 rounded-full ${item.readAt ? "bg-[#d3ded9]" : "bg-[#1d735a]"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-[#1d2824]">{item.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-[#627269]">{item.description}</span>
                        <span className="mt-1 block text-[11px] text-[#66736e]">{formatNotificationTime(item.occurredAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 text-sm leading-6 text-[#66736e]">
                {demoMode ? "Il Centro Notifiche richiede una sessione aziendale."
                  : "Nessuna notifica al momento. Puoi consultare separatamente il registro degli alert operativi."}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e9e5] bg-[#f8faf9] p-3">
              <Link href={appRoutes.notifications} onClick={() => setOpen(false)}
                className="notification-primary-action rounded-lg px-4 py-2 text-xs font-semibold">
                Apri Centro notifiche
              </Link>
              <Link href={appRoutes.operations.alerts} onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2 text-xs font-semibold text-[#456458] hover:bg-[#edf5f2]">
                Alert operativi
              </Link>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
