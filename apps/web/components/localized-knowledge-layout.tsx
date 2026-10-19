import Link from "next/link";
import { ProductBrand } from "@/components/product-brand";
import { SchoolPageLanguageSelector, PUBLIC_HOME_LOCALE_ROUTES } from "@/components/calculator-page-language-selector";
import { SchoolUnifiedNavigation } from "@/components/school-unified-navigation";
import { SCHOOL_HUB_ROUTES } from "@/lib/school-locales";
import { MARKET_TECHNICAL_UI,localizedKnowledgePath,type KnowledgeMarketLocale } from "@/lib/localized-steel-knowledge";

export function LocalizedKnowledgeLayout({
 locale,kind,children
}:{locale:KnowledgeMarketLocale;kind:"standards"|"grades";children:React.ReactNode}){
 const ui=MARKET_TECHNICAL_UI[locale];
 return <main lang={locale} className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
   <header className="border-b border-[#dce2df] bg-white">
     <div className="mx-auto flex min-h-[72px] max-w-[1180px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
       <ProductBrand href={PUBLIC_HOME_LOCALE_ROUTES[locale]} compact/>
       <SchoolPageLanguageSelector locale={locale}/>
     </div>
   </header>
   <div className="mx-auto max-w-[1180px] space-y-6 px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
     <SchoolUnifiedNavigation locale={locale} scope="public"/>
     <nav aria-label="Technical knowledge breadcrumbs" className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#174b3c]">
       <Link href={SCHOOL_HUB_ROUTES[locale]} className="underline underline-offset-4">{ui.school}</Link>
       <span aria-hidden="true">/</span>
       <Link href={localizedKnowledgePath(locale,kind)} className="underline underline-offset-4">{kind==="standards"?ui.standards:ui.grades}</Link>
     </nav>
     {children}
   </div>
 </main>;
}
