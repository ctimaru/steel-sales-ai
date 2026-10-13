import type { ReactNode } from "react";

import { requireWorkspaceAdmin } from "@/lib/workspace-context";

export default async function ReviewRoleLayout({ children }: { children: ReactNode }) {
  await requireWorkspaceAdmin();
  return children;
}
