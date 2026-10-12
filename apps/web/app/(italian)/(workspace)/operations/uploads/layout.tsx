import type { ReactNode } from "react";

import { requireCommercialMemoryReady } from "@/lib/workspace-context";

export default async function UploadsRoleLayout({ children }: { children: ReactNode }) {
  await requireCommercialMemoryReady();
  return children;
}
