import type { Metadata } from "next";
import Link from "next/link";
import { SchoolTechnicalTutor } from "@/components/school-technical-tutor";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Professore tecnico · Smart Steel School",
  description: "Consulta le fonti tecniche pubblicate su norme EN e gradi di acciaio.",
  alternates: { canonical: absoluteUrl("/knowledge/professore") },
  robots: { index: false, follow: true },
};
export default function SchoolTechnicalTutorPage() {
  return <div className="mx-auto max-w-[1100px] space-y-4 px-4 py-5 sm:px-6 sm:py-8">
    <nav aria-label="Percorso nella Scuola" className="flex items-center gap-2 text-xs font-semibold text-[#516a59]">
      <Link href="/knowledge" className="underline underline-offset-4">Scuola</Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page">Professore tecnico</span>
    </nav>
    <SchoolTechnicalTutor />
  </div>;
}
