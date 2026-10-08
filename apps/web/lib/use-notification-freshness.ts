"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  parseWorkspaceNotificationSnapshot,
  type WorkspaceNotificationSnapshot,
} from "@/lib/workspace-notifications";
import {
  parsePlatformNotificationSnapshot,
  type PlatformNotificationSnapshot,
} from "@/lib/platform-notifications";

/**
 * NC3.3 — Database changes are INVALIDATION hints only. Never render websocket
 * payloads and never use realtime authorization to bypass the source RPC/RLS.
 *
 * One instance exists per context, in its header bell. The full notification
 * page gets server refresh only when the independently verified inbox changes.
 */
export type NotificationFreshnessScope = "workspace" | "platform";
export type NotificationFreshnessStatus = "live" | "polling" | "paused";
export type NotificationSnapshot = WorkspaceNotificationSnapshot | PlatformNotificationSnapshot;

export const NC33_POLL_MS = 90_000;
export const NC33_STALE_MS = 180_000;
export const NC33_DEBOUNCE_MS = 900;
const MIN_REFRESH_MS = 10_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validScope(scope: NotificationFreshnessScope, organizationId: string | null) {
  return scope === "platform" ? organizationId === null :
    typeof organizationId === "string" && UUID.test(organizationId);
}

function digest(snapshot: NotificationSnapshot | null): string {
  return snapshot ? JSON.stringify([snapshot.unreadCount,snapshot.totalCount,
    snapshot.items.map((item) => [item.id,item.readAt,item.archivedAt])]) : "";
}

export function useNotificationFreshness<T extends NotificationSnapshot>({
  scope, organizationId, enabled, initialSnapshot, initialVerifiedAt,
}: {
  scope: NotificationFreshnessScope;
  organizationId: string | null;
  enabled: boolean;
  initialSnapshot: T | null;
  initialVerifiedAt: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState<T | null>(initialSnapshot);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(initialSnapshot ? initialVerifiedAt : null);
  const [connection, setConnection] = useState<NotificationFreshnessStatus>("polling");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const refreshRef = useRef<() => void>(() => undefined);
  const currentRef = useRef<T | null>(initialSnapshot);
  const lastVerifiedRef = useRef<number>(
    initialSnapshot && initialVerifiedAt ? Date.parse(initialVerifiedAt) || 0 : 0,
  );

  // On a server navigation or a company-context change, discard previous data.
  useEffect(() => {
    currentRef.current = initialSnapshot;
    setSnapshot(initialSnapshot);
    setVerifiedAt(initialSnapshot ? initialVerifiedAt : null);
    lastVerifiedRef.current = initialSnapshot && initialVerifiedAt ?
      Date.parse(initialVerifiedAt) || 0 : 0;
  }, [initialSnapshot, initialVerifiedAt, scope, organizationId]);

  useEffect(() => {
    if (!enabled || !validScope(scope,organizationId) ||
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      setConnection("paused");
      return;
    }

    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let inFlight = false;
    let pendingRefresh: ReturnType<typeof setTimeout> | null = null;
    let lastRequestAt = 0;

    const isVisible = () => document.visibilityState === "visible" && navigator.onLine;
    const typeTable = scope === "platform"
      ? "platform_notification_recipients" : "workspace_notification_recipients";

    async function loadVerifiedInbox(reason: "poll" | "change" | "focus" | "manual") {
      if (!active || inFlight || !isVisible()) return;
      if (reason !== "manual" && Date.now() - lastRequestAt < MIN_REFRESH_MS) return;
      lastRequestAt = Date.now();
      inFlight = true;
      setIsRefreshing(true);
      try {
        const response = scope === "platform"
          ? await supabase.rpc("nc32_platform_notifications_read",{
              p_filter:"all", p_limit:5, p_offset:0,
            })
          : await supabase.rpc("nc31_workspace_notifications_read",{
              p_organization_id: organizationId as string,
              p_filter:"all", p_limit:5, p_offset:0,
            });
        if (!active) return;
        const parsed = response.error ? null : (
          scope === "platform"
            ? parsePlatformNotificationSnapshot(response.data)
            : parseWorkspaceNotificationSnapshot(response.data)
        );
        if (!parsed) {
          // Any RPC error or malformed shape immediately removes cached private
          // references. We never turn an unauthorized request into "0 unread".
          currentRef.current = null;
          setSnapshot(null);
          setVerifiedAt(null);
          lastVerifiedRef.current = 0;
          return;
        }
        const previousDigest = digest(currentRef.current);
        currentRef.current = parsed as T;
        setSnapshot(parsed as T);
        const observed = new Date().toISOString();
        setVerifiedAt(observed);
        lastVerifiedRef.current = Date.now();
        // Full filtered inbox page has its own protected server RPC. Refresh it
        // only when the per-user inbox demonstrably changed, not on every poll.
        const onInbox = scope === "platform"
          ? pathname?.startsWith("/platform/notifications")
          : pathname?.startsWith("/notifications");
        if (onInbox && digest(parsed) !== previousDigest) router.refresh();
      } catch {
        if (active) {
          currentRef.current = null;
          setSnapshot(null);
          setVerifiedAt(null);
          lastVerifiedRef.current = 0;
        }
      } finally {
        inFlight = false;
        if (active) setIsRefreshing(false);
      }
    }

    function queueRefresh() {
      if (!active || !isVisible() || pendingRefresh) return;
      pendingRefresh = setTimeout(() => {
        pendingRefresh = null;
        void loadVerifiedInbox("change");
      }, NC33_DEBOUNCE_MS);
    }

    function dropRealtime() {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    }

    async function connectRealtime() {
      if (!active || !isVisible() || channel) return;
      setConnection("polling");
      try {
        // Verify the identity before subscribing; no anon or guessed filters.
        const {data,error} = await supabase.auth.getUser();
        if (!active || !isVisible()) return;
        if (error || !data.user || !UUID.test(data.user.id)) {
          currentRef.current = null;
          setSnapshot(null);
          setVerifiedAt(null);
          lastVerifiedRef.current = 0;
          return;
        }
        const uid = data.user.id;
        // Subscription is limited to *own* per-user rows; RLS on the
        // recipient table additionally checks active org/Platform privileges.
        channel = supabase.channel(`nc33-${scope}-${organizationId ?? "global"}-${uid}`)
          .on("postgres_changes",{
            event:"*",schema:"public",table:typeTable,
            filter:`recipient_user_id=eq.${uid}`,
          }, () => {
            // Never inspect or render the Realtime change object.
            queueRefresh();
          })
          .subscribe((status) => {
            if (!active) return;
            setConnection(status === "SUBSCRIBED" ? "live" : "polling");
            if (status === "SUBSCRIBED") queueRefresh();
          });
      } catch {
        if (active) setConnection("polling");
      }
    }

    function resume() {
      if (!active) return;
      if (!isVisible()) {
        setConnection("paused");
        dropRealtime(); // hidden tabs do not consume a live socket.
        return;
      }
      void connectRealtime();
      // On tab focus / return from offline, refresh immediately unless very
      // recently verified, so revoked permissions disappear on next view.
      if (!lastVerifiedRef.current ||
          Date.now() - lastVerifiedRef.current > 15_000) {
        void loadVerifiedInbox("focus");
      }
    }
    function onAuthChange(event: string) {
      if (event === "SIGNED_OUT") {
        dropRealtime();
        currentRef.current = null;
        setSnapshot(null);
        setVerifiedAt(null);
        lastVerifiedRef.current = 0;
        setConnection("paused");
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // Recheck current identity/permissions with the server; never trust
        // JWT user_metadata, Realtime message content, or cached privileges.
        dropRealtime();
        queueMicrotask(() => { if (active) resume(); });
      }
    }
    const {data:{subscription}} = supabase.auth.onAuthStateChange(onAuthChange);
    refreshRef.current = () => { void loadVerifiedInbox("manual"); };
    const pollId = setInterval(() => {
      setNow(Date.now());
      if (isVisible()) void loadVerifiedInbox("poll");
    }, NC33_POLL_MS);
    const clockId = setInterval(() => setNow(Date.now()),30_000);
    document.addEventListener("visibilitychange",resume);
    window.addEventListener("focus",resume);
    window.addEventListener("online",resume);
    window.addEventListener("offline",resume);
    resume();
    return () => {
      active = false;
      if (pendingRefresh) clearTimeout(pendingRefresh);
      clearInterval(pollId);
      clearInterval(clockId);
      document.removeEventListener("visibilitychange",resume);
      window.removeEventListener("focus",resume);
      window.removeEventListener("online",resume);
      window.removeEventListener("offline",resume);
      subscription.unsubscribe();
      dropRealtime();
      refreshRef.current = () => undefined;
    };
  }, [scope,organizationId,enabled,router,pathname]);

  const verifiedTime = verifiedAt ? Date.parse(verifiedAt) : NaN;
  const stale = !enabled ? false : !snapshot ||
    !Number.isFinite(verifiedTime) || now - verifiedTime > NC33_STALE_MS;
  const refresh = useCallback(() => refreshRef.current(), []);
  return {snapshot,verifiedAt,connection,isRefreshing,stale,refresh};
}
