import GradeDetailPage from "@/app/(public)/knowledge/gradi/[slug]/page";
import { SchoolPrivateReferenceDetailBanner } from "@/components/school-private-reference-detail";
import { englishGradeForSlug } from "@/lib/international-steel-knowledge";
import { schoolWorkspaceLocale } from "@/lib/school-workspace-i18n";

export default async function SchoolGradeDetail({params,searchParams}:{
  params:Promise<{slug:string}>;searchParams:Promise<{lang?:string}>;
}){
  const [{slug},search]=await Promise.all([params,searchParams]);
  const locale=schoolWorkspaceLocale(search.lang);
  return <>
    <SchoolPrivateReferenceDetailBanner locale={locale} kind="gradi" slug={slug}
      englishAvailable={Boolean(englishGradeForSlug(slug))}/>
    <GradeDetailPage params={params}/>
  </>;
}
