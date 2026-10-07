import Link from "next/link";

import { FocusHeader, FocusPage } from "@/components/focus-ui";
import { PilotEvent } from "@/components/pilot-event";
import { SchoolQuickAccess } from "@/components/school-quick-access";
import { appRoutes } from "@/lib/routes";

const technicalShortcuts = [
  { label: "EN 10219", href: `${appRoutes.knowledge.schoolStandards}?q=EN%2010219` },
  { label: "EN 10210", href: `${appRoutes.knowledge.schoolStandards}?q=EN%2010210` },
  { label: "S355J2H", href: `${appRoutes.knowledge.schoolGrades}?q=S355J2H` },
  { label: "P265GH", href: `${appRoutes.knowledge.schoolGrades}?q=P265GH` },
] as const;

export default function SchoolPage() {
  return (
    <FocusPage className="max-w-[1120px]">
      <PilotEvent eventName="school_home_viewed" metadata={{ surface: "school_home" }} />
      <FocusHeader
        eyebrow="Scuola"
        title="Il toolbox tecnico per acciaio e tubi"
        description={
          <>
            Calcola prima, cerca la norma o il grado quando serve, approfondisci solo dopo.
            <span className="mt-2 block text-xs font-semibold text-[#5d6a65]">
              Strumenti tecnici e cataloghi pubblici · documenti aziendali separati
            </span>
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-3xl border border-[#b8d2c8] bg-[#edf5f2] p-5 sm:p-6">
          <p className="app-kicker">Strumento principale</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#173f35]">
            Calcolo pesi tubo
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#52615b]">
            Calcola kg/m, peso barra, quantità e tonnellaggio per tondo, quadro e rettangolare.
            Usa EN 10210, EN 10219 oppure il calcolo geometrico libero.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-[#cfe0d9] bg-white/80 p-3">
              <p className="text-xs font-semibold text-[#173f35]">kg/m</p>
              <p className="mt-1 text-xs text-[#5d6a65]">Massa lineare</p>
            </div>
            <div className="rounded-xl border border-[#cfe0d9] bg-white/80 p-3">
              <p className="text-xs font-semibold text-[#173f35]">Peso barra</p>
              <p className="mt-1 text-xs text-[#5d6a65]">6 m, 12 m o libero</p>
            </div>
            <div className="rounded-xl border border-[#cfe0d9] bg-white/80 p-3">
              <p className="text-xs font-semibold text-[#173f35]">Tonnellate</p>
              <p className="mt-1 text-xs text-[#5d6a65]">Quantità totale</p>
            </div>
          </div>

          <Link
            href={`${appRoutes.knowledge.schoolTubes}?source=school&surface=home_card#calcolatore-pesi`}
            className="app-primary mt-5 inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold"
          >
            Apri calcolo pesi
          </Link>
        </div>

        <div className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
          <p className="app-kicker">Ricerca tecnica</p>
          <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
            Cerca norma o grado
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#5d6a65]">
            Parti direttamente dal codice che hai davanti.
          </p>

          <form action={appRoutes.knowledge.schoolStandards} method="get" className="mt-5">
            <label htmlFor="school-standard-search" className="text-xs font-semibold text-[#43524c]">
              Norma
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="school-standard-search"
                name="q"
                type="search"
                placeholder="Es. EN 10219"
                className="h-11 min-w-0 flex-1 rounded-xl border border-[#d7dfdb] px-3 text-sm text-[#1d2824] outline-none placeholder:text-[#5d6a65] focus:border-[#438d7a] focus:ring-4 focus:ring-[#e1ece8]"
              />
              <button className="app-primary h-11 rounded-xl px-4 text-xs font-semibold">Cerca</button>
            </div>
          </form>

          <form action={appRoutes.knowledge.schoolGrades} method="get" className="mt-4">
            <label htmlFor="school-grade-search" className="text-xs font-semibold text-[#43524c]">
              Grado
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="school-grade-search"
                name="q"
                type="search"
                placeholder="Es. S355J2H"
                className="h-11 min-w-0 flex-1 rounded-xl border border-[#d7dfdb] px-3 text-sm text-[#1d2824] outline-none placeholder:text-[#5d6a65] focus:border-[#438d7a] focus:ring-4 focus:ring-[#e1ece8]"
              />
              <button className="app-secondary h-11 rounded-xl px-4 text-xs font-semibold">Cerca</button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {technicalShortcuts.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-full border border-[#d7dfdb] bg-[#f8faf9] px-3 py-1.5 text-xs font-semibold text-[#173f35] hover:border-[#9db9af]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="school-catalogs">
        <div className="mb-3">
          <p className="app-kicker">Cataloghi</p>
          <h2 id="school-catalogs" className="mt-1 text-xl font-semibold text-[#1d2824]">
            Vai direttamente al riferimento tecnico
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Link
            href={appRoutes.knowledge.schoolStandards}
            className="group rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#b8d2c8]"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5d6a65]">Standard</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-[#1d2824]">Norme</h3>
              <span className="font-semibold text-[#173f35]">→</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#5d6a65]">
              Ambito, prodotti, processi e gradi collegati.
            </p>
          </Link>

          <Link
            href={appRoutes.knowledge.schoolGrades}
            className="group rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#b8d2c8]"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5d6a65]">Materiali</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-[#1d2824]">Gradi</h3>
              <span className="font-semibold text-[#173f35]">→</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#5d6a65]">
              Designazioni, numeri materiale e norme collegate.
            </p>
          </Link>

          <Link
            href={appRoutes.knowledge.catalog}
            className="group rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#b8d2c8]"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5d6a65]">Scuola</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-[#1d2824]">Catalogo completo</h3>
              <span className="font-semibold text-[#173f35]">→</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#5d6a65]">
              Tutte le aree tecniche della base pubblica.
            </p>
          </Link>
        </div>
      </section>

      <SchoolQuickAccess />

      <section className="rounded-2xl border border-[#d9e8e2] bg-[#f3f7f5] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="app-kicker">Documenti aziendali</p>
            <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">
              Cerca nella knowledge privata
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#52615b]">
              Quando il riferimento pubblico non basta, interroga documenti e knowledge del tuo workspace mantenendo fonti e provenienza.
            </p>
          </div>
          <Link
            href={appRoutes.knowledge.explorer}
            className="app-secondary inline-flex min-h-11 shrink-0 items-center rounded-xl px-4 text-sm font-semibold"
          >
            Apri documenti
          </Link>
        </div>
      </section>
    </FocusPage>
  );
}
