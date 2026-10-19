import { KnowledgeExplorer } from "@/components/knowledge-explorer";
import { SchoolPrivateTopbar } from "@/components/school-private-language-switch";
import { SCHOOL_PRIVATE_COPY,schoolWorkspaceLocale } from "@/lib/school-workspace-i18n";

export const dynamic="force-dynamic";
/** Same workspace-only action and RLS as /knowledge-explorer: only presentation changes. */
export default async function SchoolPrivateExplorer({searchParams}:{
  searchParams:Promise<{lang?:string}>;
}){
  const locale=schoolWorkspaceLocale((await searchParams).lang);
  const c=SCHOOL_PRIVATE_COPY[locale];
  return <div lang={locale} className="mx-auto max-w-7xl space-y-6">
    <SchoolPrivateTopbar locale={locale} pathname="/school/explorer"/>
    <header>
      <p className="text-xs font-bold uppercase tracking-[.12em] text-[#1a5144]">{c.kicker} · Semantic Intelligence</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#173f35]">{c.docs}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-[#52615b]">{c.docsHint}</p>
      <p className="mt-2 text-xs leading-6 text-[#52615b]">{c.sourceDisclosure}</p>
    </header>
    <KnowledgeExplorer locale={locale}/>
  </div>;
}
