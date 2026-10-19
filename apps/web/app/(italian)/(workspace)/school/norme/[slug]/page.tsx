import StandardDetailPage from "@/app/(public)/knowledge/norme/[slug]/page";
import { SchoolPrivateReferenceDetailBanner } from "@/components/school-private-reference-detail";
import { englishStandardForSlug } from "@/lib/international-steel-knowledge";
import { schoolWorkspaceLocale } from "@/lib/school-workspace-i18n";

export default async function SchoolStandardDetail({params,searchParams}:{
  params:Promise<{slug:string}>;searchParams:Promise<{lang?:string}>;
}){
  const [{slug},search]=await Promise.all([params,searchParams]);
  const locale=schoolWorkspaceLocale(search.lang);
  return <>
    <SchoolPrivateReferenceDetailBanner locale={locale} kind="norme" slug={slug}
      englishAvailable={Boolean(englishStandardForSlug(slug))}/>
    <StandardDetailPage params={params}/>
  </>;
}
