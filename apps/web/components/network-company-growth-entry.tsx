import Link from "next/link";
import {appRoutes} from "@/lib/routes";

/** Visible in both Free and Pro Network, without a Follow mechanic. */
export function NetworkCompanyGrowthEntry(){
  return <aside className="flex flex-col gap-3 rounded-2xl border border-[#cfe0d5] bg-white p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Percorso attivazione aziendale">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#32745a]">La tua azienda nel Network</p>
      <p className="mt-1 text-sm font-medium leading-5 text-[#173f35]">Profilo, connessioni e prossime azioni commerciali, in un unico percorso.</p>
    </div>
    <Link href={appRoutes.network.start} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-[#bed3c5] bg-[#f0f7f2] px-4 text-xs font-semibold text-[#175640] hover:bg-[#e2f0e6]">
      Il mio percorso →
    </Link>
  </aside>;
}
