import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/routes";

/** Backward-compatible bookmark: never delete document data or bypass workspace RLS. */
export default function LegacySchoolDocumentsRedirect() {
  redirect(appRoutes.commercial.knowledgeExplorer);
}
