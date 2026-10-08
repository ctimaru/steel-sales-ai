import type { ReactNode } from "react";

import { PlatformShell } from "@/components/platform-shell";
import {
  PLATFORM_STAFF_ROLE_TEMPLATES,
  type PlatformStaffRoleKey,
} from "@/lib/platform-access-contract";
import { requirePlatformConsoleContext } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";
import { parsePlatformNotificationSnapshot, type PlatformNotificationSnapshot } from "@/lib/platform-notifications";

function authorityLabel(
  isPlatformOwner: boolean,
  roles: Array<PlatformStaffRoleKey | "platform_owner">,
) {
  if (isPlatformOwner) return "Platform Owner";

  const labels = roles
    .filter((role): role is PlatformStaffRoleKey => role !== "platform_owner")
    .map(
      (role) =>
        PLATFORM_STAFF_ROLE_TEMPLATES.find((item) => item.key === role)?.label ??
        role,
    );

  if (labels.length === 1) return labels[0];
  if (labels.length > 1) return `Platform Staff · ${labels.length} ruoli`;
  return "Platform Staff";
}

export default async function PlatformLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await requirePlatformConsoleContext();
  let notificationSnapshot: PlatformNotificationSnapshot | null = null;
  let notificationVerifiedAt: string | null = null;
  try {
    const client = await createClient();
    const { data,error } = await client.rpc("nc32_platform_notifications_read", {
      p_filter:"all", p_limit:5, p_offset:0,
    });
    notificationSnapshot = error ? null : parsePlatformNotificationSnapshot(data);
    notificationVerifiedAt = notificationSnapshot ? new Date().toISOString() : null;
  } catch {
    notificationSnapshot = null;
    notificationVerifiedAt = null;
  }

  return (
    <PlatformShell
      viewerLabel={context.viewerLabel}
      authorityLabel={authorityLabel(
        context.is_platform_owner,
        context.roles,
      )}
      permissions={context.permissions}
      isPlatformOwner={context.is_platform_owner}
      notificationSnapshot={notificationSnapshot}
      notificationVerifiedAt={notificationVerifiedAt}
    >
      {children}
    </PlatformShell>
  );
}
