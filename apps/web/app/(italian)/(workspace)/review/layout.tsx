import type { ReactNode } from "react";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

// Legacy /review/* is still addressable by URL and may render sensitive
// extraction, normalization and source-email evidence. Page access is NOT
// authorization for Server Actions or directly callable RPCs.
export default async function LegacyReviewGuard({ children }: { children: ReactNode }) {
  await requireWorkspaceAdmin();
  return children;
}
