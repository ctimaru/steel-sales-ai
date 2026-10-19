import Link from "next/link";
import {SCHOOL_ASSISTANT_COPY} from "@/lib/school-assistant-i18n";
import {schoolWorkspaceHref,type SchoolWorkspaceLocale} from "@/lib/school-workspace-i18n";

/** Shared, compact launch surface; never pretends to generate an AI answer. */
export function SchoolAssistantEntry({locale}:{locale:SchoolWorkspaceLocale}){
 const c=SCHOOL_ASSISTANT_COPY[locale];
 return <section lang={locale} aria-label={c.title}
   className="flex flex-col gap-4 rounded-2xl border border-[#b9d4c4] bg-[#eaf4ef] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
   <div className="min-w-0">
     <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#23694e]">{c.eyebrow}</p>
     <h2 className="mt-1 text-xl font-semibold text-[#173f35]">{c.title}</h2>
     <p className="mt-2 max-w-2xl text-sm leading-6 text-[#506157]">{c.intro}</p>
     <p className="mt-2 text-xs font-medium text-[#52615b]">{c.mode}</p>
   </div>
   <Link href={schoolWorkspaceHref("/school/assistant",locale)}
     className="school-primary-action w-full shrink-0 justify-center sm:w-auto">
     {c.title} <span aria-hidden="true">→</span>
   </Link>
 </section>;
}
