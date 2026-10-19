import Link from "next/link";
import { SchoolPrivateTopbar } from "@/components/school-private-language-switch";
import { SCHOOL_PRIVATE_COPY, schoolWorkspaceHref, type SchoolWorkspaceLocale } from "@/lib/school-workspace-i18n";

export function SchoolPrivateReferenceDetailBanner({locale,kind,slug,englishAvailable}:{
  locale:SchoolWorkspaceLocale;kind:"norme"|"gradi";slug:string;englishAvailable:boolean;
}) {
  if(locale==="it")return null;
  const c=SCHOOL_PRIVATE_COPY[locale];
  const englishHref=kind==="norme"?"/en/knowledge/standards/"+slug:"/en/knowledge/grades/"+slug;
  return <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-6">
    <SchoolPrivateTopbar locale={locale} pathname={"/school/"+kind}/>
    <div className="mt-4 rounded-xl border border-[#d4e2d8] bg-[#f4f8f5] p-4">
      <Link href={schoolWorkspaceHref("/school/"+kind,locale)} className="text-sm font-semibold text-[#174b3c] underline underline-offset-4">← {kind==="norme"?c.standards:c.grades}</Link>
      <p className="mt-3 text-xs font-bold uppercase tracking-[.1em] text-[#174b3c]">{c.originalItalian}</p>
      <p className="mt-1 text-sm leading-6 text-[#52615b]">{c.sourceNote}</p>
      {englishAvailable?<Link href={englishHref} hrefLang="en"
        className="school-secondary-action mt-3">{c.englishGuides} ↗</Link>:null}
    </div>
  </div>;
}
