"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackInternationalRfq } from "@/lib/international-rfq-analytics.client";
import type { InternationalRfqLocale } from "@/lib/international-rfq-funnel";

/** Click-through only. Account creation / verification are separate server events. */
export function InternationalRfqRegisterLink({
  locale,className,children,
}:{locale:InternationalRfqLocale;className:string;children:ReactNode}){
  return <Link href="/en/register" hrefLang="en" lang="en"
    className={className}
    onClick={()=>trackInternationalRfq("registration_click",locale)}>
    {children}
  </Link>;
}
