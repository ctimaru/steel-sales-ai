import { redirect } from "next/navigation";

import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default function LegacyCompanyTubesStandardsPage() {
  redirect(appRoutes.knowledge.tubes);
}
