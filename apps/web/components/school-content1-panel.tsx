import Link from "next/link";
import type { SchoolContent1Guide } from "@/lib/school-content1-guides.mjs";
import { SCHOOL_CONTENT1_REVIEW_DATE } from "@/lib/school-content1-guides.mjs";

export function SchoolContent1Panel({ guide }: { guide: SchoolContent1Guide }) {
  return (
    <section
      id="school-practical-guide"
      aria-label="Approfondimento tecnico operativo"
      className="scroll-mt-24 rounded-[20px] border border-[#d1e1d7] bg-white p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#1a5144]">
          Dalla scheda alla pratica
        </p>
        <p className="text-xs text-[#52615b]">
          Approfondimento rivisto <time dateTime={SCHOOL_CONTENT1_REVIEW_DATE}>2 novembre 2026</time>
        </p>
      </div>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#1d2824] sm:text-2xl">
        {guide.heading}
      </h2>
      <p className="mt-3 max-w-[76ch] text-sm leading-7 text-[#43564b]">{guide.takeaway}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
        <div className="rounded-2xl border border-[#e0e8e2] bg-[#f7faf8] p-4 sm:p-5">
          <h3 className="text-sm font-bold text-[#173f35]">Cosa verificare prima di specificare il prodotto</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#465b4e]">
            {guide.checks.map((check) => <li key={check}>{check}</li>)}
          </ul>
        </div>
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[#e0e8e2] bg-white p-4 sm:p-5">
          <div>
            <h3 className="text-sm font-bold text-[#173f35]">Edizioni e limiti di utilizzo</h3>
            <p className="mt-2 text-xs leading-6 text-[#52615b]">{guide.editionNote}</p>
          </div>
          <Link href={guide.compare.href} className="school-inline-link inline-flex min-h-10 items-center text-sm">
            {guide.compare.label} →
          </Link>
        </div>
      </div>
      <div className="mt-4 border-t border-[#e4ebe6] pt-4">
        <p className="text-xs font-bold text-[#173f35]">Fonti pubbliche per approfondire</p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          {guide.sources.map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-8 items-center text-xs font-semibold text-[#1a5144] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">
              {source.label} ↗
            </a>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-[#66736e]">
          Guida originale di orientamento, non riproduzione del testo normativo. Per ordini e conformità,
          verificare l’edizione applicabile e i documenti del produttore; nessuna equivalenza è implicita.
        </p>
      </div>
    </section>
  );
}
