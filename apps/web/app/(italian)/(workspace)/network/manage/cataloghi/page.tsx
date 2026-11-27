import { redirect } from "next/navigation";

import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

/** The existing owner route now enters the same governed company workspace. */
export default async function ManagedProducerCataloguesPage() {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");
  await requireWorkspaceAdmin();
  redirect("/company/profile#products-catalogues");
}
