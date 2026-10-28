import type { Metadata } from "next";
import { SchoolTechnicalTutor } from "@/components/school-technical-tutor";
import { SchoolPrivateTopbar } from "@/components/school-private-language-switch";
import { SchoolUnifiedNavigation } from "@/components/school-unified-navigation";
import { schoolWorkspaceLocale } from "@/lib/school-workspace-i18n";
import { privateNoIndexRobots } from "@/lib/seo";

/** Explicit authenticated counterpart of /knowledge/professore.
 * Supabase proxy redirects signed-in public knowledge paths into /school/*.
 * This page still uses public K2 evidence exclusively, not tenant documents.
 */
export const metadata: Metadata = {
  title: "Professore tecnico · Smart Steel School",
  robots: privateNoIndexRobots,
};
export default async function SchoolWorkspaceProfessorPage({searchParams}:{
  searchParams:Promise<{lang?:string}>;
}) {
  const locale=schoolWorkspaceLocale((await searchParams).lang);
  return <main className="mx-auto max-w-[1180px] space-y-4 px-4 py-4 sm:px-6 sm:py-6">
    <SchoolPrivateTopbar locale={locale} pathname="/school/professore" compact/>
    <SchoolUnifiedNavigation locale={locale} scope="workspace" compact/>
    {locale!=="it" ? <p className="rounded-xl border border-[#d7e3da] bg-[#f5f8f6] px-4 py-3 text-xs leading-5 text-[#355849]">Il Professore pubblico è attualmente disponibile in italiano. La lingua del workspace non modifica le fonti né i dati aziendali.</p> : null}
    <SchoolTechnicalTutor/>
  </main>;
}
