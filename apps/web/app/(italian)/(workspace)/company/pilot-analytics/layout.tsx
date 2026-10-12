import type { ReactNode } from "react";

import { requireWorkspaceAdmin } from "@/lib/workspace-context";

export default async function CompanyPilotAnalyticsRoleLayout({ children }: { children: ReactNode }) {
  await requireWorkspaceAdmin();
  return children;
}
