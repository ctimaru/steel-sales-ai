import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { SiteDocument, metadata, viewport } from "@/app/site-document";
import { isNewCalculatorLocale } from "@/lib/international-calculator-landing";

export { metadata, viewport };

/** Independent language root: html lang must agree with visible UI, not cookie preferences. */
export default async function InternationalCalculatorRoot({
  children,params,
}:{
  children:ReactNode;
  params:Promise<{locale:string}>;
}){
  const {locale}=await params;
  if(!isNewCalculatorLocale(locale))notFound();
  return <SiteDocument lang={locale}>{children}</SiteDocument>;
}
