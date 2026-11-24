import type { Metadata } from "next";
import { CommunityInterestPage } from "@/components/community-interest-page";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Community interest",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{kind?:string;result?:string}>}) {
  const p=await searchParams;
  return <CommunityInterestPage locale="en" kind={p.kind==="investor"?"investor":"partner"} result={p.result}/>;
}
