import type { ReactNode } from "react";

import { PlatformShell } from "@/components/platform-shell";
import {
  PLATFORM_STAFF_ROLE_TEMPLATES,
  type PlatformStaffRoleKey,
} from "@/lib/platform-access-contract";
import { requirePlatformConsoleContext } from "@/lib/platform-admin";

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

  return (
    <PlatformShell
      viewerLabel={context.viewerLabel}
      authorityLabel={authorityLabel(
        context.is_platform_owner,
        context.roles,
      )}
      permissions={context.permissions}
      isPlatformOwner={context.is_platform_owner}
    >
      {children}
    </PlatformShell>
  );
}
