import type { Metadata } from "next";
import { PublicProjectPage } from "@/components/public-project-page";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Il progetto — Smart Steel Sales 2027",
  description: "Scopri la visione per un’infrastruttura intelligente dell’acciaio e come partecipare al progetto.",
  alternates: {canonical:absoluteUrl("/progetto"),languages:{it:absoluteUrl("/progetto"),en:absoluteUrl("/en/project"),"x-default":absoluteUrl("/progetto")}},
};
export default function ProjectPage(){return <PublicProjectPage locale="it" />;}
