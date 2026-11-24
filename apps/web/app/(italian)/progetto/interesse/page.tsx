import type { Metadata } from "next";
import { CommunityInterestPage } from "@/components/community-interest-page";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Manifestazione di interesse",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{kind?:string;result?:string}>}) {
  const p=await searchParams;
  return <CommunityInterestPage locale="it" kind={p.kind==="investor"?"investor":"partner"} result={p.result}/>;
}
