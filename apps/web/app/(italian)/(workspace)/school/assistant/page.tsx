import type { Metadata } from "next";
import { SchoolGuidedAssistant } from "@/components/school-guided-assistant";
import { SchoolPrivateTopbar } from "@/components/school-private-language-switch";
import { schoolWorkspaceLocale } from "@/lib/school-workspace-i18n";
import { privateNoIndexRobots } from "@/lib/seo";

export const metadata:Metadata={
  title:"Assistente tecnico · Smart Steel School",
  description:"Consultazione conversazionale guidata di norme e materiali pubblicati con fonti verificabili.",
  robots:privateNoIndexRobots,
};
export default async function SchoolTechnicalAssistantPage({searchParams}:{
  searchParams:Promise<{lang?:string}>;
}){
  const locale=schoolWorkspaceLocale((await searchParams).lang);
  const aiEnabled=process.env.SCHOOL6B_AI_ENABLED==="true"&&Boolean(process.env.AI_GATEWAY_API_KEY);
  const voiceEnabled=process.env.SCHOOL6B_VOICE_ENABLED==="true";
  return <main lang={locale} className="mx-auto max-w-[1180px] space-y-4 px-2 py-3 sm:px-4 sm:py-6">
    <SchoolPrivateTopbar locale={locale} pathname="/school/assistant" compact/>
    <SchoolGuidedAssistant locale={locale} aiEnabled={aiEnabled} voiceEnabled={voiceEnabled}/>
  </main>;
}
