import { redirect } from "next/navigation";

import { appRoutes } from "@/lib/routes";

export default function LegacyKnowledgeCenterPage() {
  redirect(appRoutes.knowledge.workspace);
}
