import type { ReactNode } from "react";

import { requireWorkspaceWriteRole } from "@/lib/workspace-context";

export default async function UploadsRoleLayout({ children }: { children: ReactNode }) {
  await requireWorkspaceWriteRole();
  return children;
}
