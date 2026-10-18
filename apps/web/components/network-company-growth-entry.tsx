import Link from "next/link";
import { actionClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {appRoutes} from "@/lib/routes";

/** Visible in both Free and Pro Network, without a Follow mechanic. */
export function NetworkCompanyGrowthEntry(){
  return <aside className="flex flex-col gap-3 rounded-2xl border border-[#cfe0d5] bg-white p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Percorso attivazione aziendale">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#32745a]">La tua azienda nel Network</p>
      <p className="mt-1 text-sm font-medium leading-5 text-[#173f35]">Profilo, connessioni e prossime azioni commerciali, in un unico percorso.</p>
    </div>
    <Link href={appRoutes.network.start} className={cn(actionClasses({ variant: "soft", size: "sm" }), "min-h-10 shrink-0 px-4")}>
      Il mio percorso →
    </Link>
  </aside>;
}
