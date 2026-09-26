import type { ReactNode } from "react";

import { PlatformShell } from "@/components/platform-shell";
import { requirePlatformContext } from "@/lib/workspace-context";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const context = await requirePlatformContext();
  return <PlatformShell viewerLabel={context.viewerLabel}>{children}</PlatformShell>;
}
