import type { ReactNode } from "react";

import { requireNetworkAccess } from "@/lib/network-access";
import { requireWorkspaceWriteRole } from "@/lib/workspace-context";

export default async function NetworkInquiryComposeRoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireWorkspaceWriteRole();
  await requireNetworkAccess();
  return children;
}
