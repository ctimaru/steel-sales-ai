"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { toggleNetworkSavedCompany } from "@/app/(workspace)/network/save-actions";
import {
  NETWORK_SAVE_ERROR_EVENT,
  NETWORK_SAVE_EVENT,
  emitNetworkSave,
  networkSaveErrorMessage,
  type NetworkSaveErrorDetail,
  type NetworkSaveEventDetail,
} from "@/lib/network-save-events";

type Toast =
  | { id: number; kind: "saved" | "removed"; detail: NetworkSaveEventDetail }
  | { id: number; kind: "error"; message: string };

const TOAST_MS = 5000;

/**
 * NET-SAVE-INLINE1: one toast region for the whole workspace. Confirms a save
 * or removal with "Annulla", reports failures, and is announced to screen
 * readers through a polite live region that is always mounted.
 */
export function NetworkSaveToaster() {
  const pathname = usePathname();
  const [toast, setToast] = useState<Toast | null>(null);
  const [undoing, setUndoing] = useState(false);
  const timer = useRef<number | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    function show(next: Toast) {
      if (timer.current) window.clearTimeout(timer.current);
      setUndoing(false);
      setToast(next);
      timer.current = window.setTimeout(() => setToast(null), TOAST_MS);
    }
    function onSave(event: Event) {
      const detail = (event as CustomEvent<NetworkSaveEventDetail>).detail;
      if (!detail || detail.origin !== "click") return;
      show({ id: ++counter.current, kind: detail.saved ? "saved" : "removed", detail });
    }
    function onError(event: Event) {
      const detail = (event as CustomEvent<NetworkSaveErrorDetail>).detail;
      if (!detail) return;
      show({ id: ++counter.current, kind: "error", message: networkSaveErrorMessage(detail.reason, detail.wanted) });
    }
    window.addEventListener(NETWORK_SAVE_EVENT, onSave);
    window.addEventListener(NETWORK_SAVE_ERROR_EVENT, onError);
    return () => {
      window.removeEventListener(NETWORK_SAVE_EVENT, onSave);
      window.removeEventListener(NETWORK_SAVE_ERROR_EVENT, onError);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  async function undo() {
    if (!toast || toast.kind === "error" || undoing) return;
    const { detail } = toast;
    setUndoing(true);
    const result = await toggleNetworkSavedCompany(detail.companyId, !detail.saved, detail.surface);
    if (result.ok) {
      emitNetworkSave({ ...detail, saved: result.saved, count: result.count, origin: "undo" });
      setToast(null);
    } else {
      setToast({ id: ++counter.current, kind: "error", message: networkSaveErrorMessage(result.reason, !detail.saved) });
    }
    setUndoing(false);
  }

  const onSavedPage = pathname === "/network/saved";
  let body: ReactNode = null;
  if (toast?.kind === "error") {
    body = <p className="text-sm font-semibold">{toast.message}</p>;
  } else if (toast) {
    body = (
      <>
        <span aria-hidden="true" className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-full " + (toast.kind === "saved" ? "bg-[#f2b544] text-[#3a2600]" : "bg-white/15 text-white")}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill={toast.kind === "saved" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
          </svg>
        </span>
        <p className="min-w-0 flex-1 text-sm leading-5">
          <strong className="font-bold">{toast.detail.name}</strong>{" "}
          {toast.kind === "saved" ? "salvata nella tua lista privata" : "rimossa dai salvati"}
        </p>
        {toast.kind === "saved" && !onSavedPage ? (
          <Link href="/network/saved" className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-bold text-[#f2b544] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            Vedi Salvate
          </Link>
        ) : null}
        <button type="button" onClick={undo} disabled={undoing}
          className="shrink-0 rounded-lg border border-white/30 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          {undoing ? "…" : "Annulla"}
        </button>
      </>
    );
  }

  return (
    <div aria-live="polite" aria-atomic="true" data-testid="network-save-toaster"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex justify-center sm:inset-x-auto sm:right-5 sm:justify-end lg:bottom-6">
      {toast ? (
        <div key={toast.id} role={toast.kind === "error" ? "alert" : "status"} data-testid="network-save-toast" data-kind={toast.kind}
          className={"pointer-events-auto flex w-full max-w-[440px] items-center gap-3 rounded-2xl px-3.5 py-3 text-white shadow-[0_16px_40px_rgba(10,32,25,0.28)] motion-safe:animate-[sss-toast-in_220ms_ease-out] " +
            (toast.kind === "error" ? "bg-[#8a2d12]" : "bg-[#123a2e]")}>
          {body}
        </div>
      ) : null}
    </div>
  );
}

/** NET-SAVE-INLINE1: live total next to the "Salvate" tab. Null hides it. */
export function NetworkSavedCountBadge({ initial }: { initial: number | null }) {
  const [count, setCount] = useState(initial);
  const [bump, setBump] = useState(false);
  useEffect(() => setCount(initial), [initial]);
  useEffect(() => {
    function onSave(event: Event) {
      const detail = (event as CustomEvent<NetworkSaveEventDetail>).detail;
      if (!detail || typeof detail.count !== "number") return;
      setCount(detail.count);
      setBump(true);
      window.setTimeout(() => setBump(false), 300);
    }
    window.addEventListener(NETWORK_SAVE_EVENT, onSave);
    return () => window.removeEventListener(NETWORK_SAVE_EVENT, onSave);
  }, []);
  if (count === null) return null;
  return (
    <span data-testid="network-saved-count"
      className={"ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[#f2b544] px-1.5 text-[10px] font-extrabold leading-5 tabular-nums text-[#3a2600] transition-transform duration-300 motion-reduce:transition-none " + (bump ? "scale-125" : "scale-100")}>
      <span className="sr-only">: </span>{count.toLocaleString("it-IT")}<span className="sr-only"> aziende salvate</span>
    </span>
  );
}

/**
 * NET-SAVE-INLINE1: a row of the Salvate page. Removing the company collapses
 * the row in place; "Annulla" brings it back. Once collapsed the content is
 * unmounted, so its RFQ checkbox can no longer be submitted.
 */
export function NetworkSavedRow({ companyId, children }: { companyId: string; children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    let timeout: number | null = null;
    function onSave(event: Event) {
      const detail = (event as CustomEvent<NetworkSaveEventDetail>).detail;
      if (!detail || detail.companyId !== companyId) return;
      if (timeout) window.clearTimeout(timeout);
      if (detail.saved) {
        setMounted(true);
        setVisible(true);
      } else {
        setVisible(false);
        timeout = window.setTimeout(() => setMounted(false), 320);
      }
    }
    window.addEventListener(NETWORK_SAVE_EVENT, onSave);
    return () => {
      window.removeEventListener(NETWORK_SAVE_EVENT, onSave);
      if (timeout) window.clearTimeout(timeout);
    };
  }, [companyId]);
  return (
    <div data-testid="network-saved-row-shell" aria-hidden={visible ? undefined : true}
      className={"grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none " +
        (visible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
      <div className="min-h-0 overflow-hidden">{mounted ? children : null}</div>
    </div>
  );
}
