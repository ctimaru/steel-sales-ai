import type { Metadata } from "next";
import Link from "next/link";
import { FoundingPartnersPreview } from "@/components/founding-partners-preview";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { resolveBusinessPlanLocale } from "@/lib/business-plan-locale";

export const dynamic = "force-dynamic";
export const metadata:Metadata={title:"Founding Partners — anteprima riservata",robots:{index:false,follow:false,nocache:true}};
const route="/platform/marketing/founding-partners";
export default async function FoundingPartnersPreviewPage({searchParams}:{searchParams:Promise<{lang?:string|string[]}>}){
  await requirePlatformSuperadmin();
  const locale=resolveBusinessPlanLocale((await searchParams).lang,"it"),en=locale==="en";
  return <div className="mx-auto w-full min-w-0 max-w-[1160px] space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-base)] p-3">
      <p className="text-xs font-semibold text-[var(--text-secondary)]">MKT9.D.2 · {en?"Founder-only preview":"Anteprima riservata al fondatore"}</p>
      <div className="flex flex-wrap gap-2"><Link href={route+"?lang=it"} aria-current={!en?"page":undefined} className="platform-secondary inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold">IT</Link><Link href={route+"?lang=en"} aria-current={en?"page":undefined} className="platform-secondary inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold">EN</Link><Link href="/platform/marketing/investor-deck" className="platform-secondary inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold">{en?"Investor Deck":"Investor Deck"}</Link></div>
    </div>
    <FoundingPartnersPreview key={locale} locale={locale}/>
  </div>;
}
