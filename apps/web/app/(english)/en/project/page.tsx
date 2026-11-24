import type { Metadata } from "next";
import { PublicProjectPage } from "@/components/public-project-page";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "The project — Smart Steel Sales 2027",
  description: "Discover our vision for intelligent steel industry infrastructure and ways to participate.",
  alternates: {canonical:absoluteUrl("/en/project"),languages:{it:absoluteUrl("/progetto"),en:absoluteUrl("/en/project"),"x-default":absoluteUrl("/progetto")}},
};
export default function ProjectPage(){return <PublicProjectPage locale="en" />;}
