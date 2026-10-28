import Link from "next/link";
import {SchoolAssistantEntry} from "@/components/school-assistant-entry";

import { FocusPage, FocusSectionHeader } from "@/components/focus-ui";
import { PilotEvent } from "@/components/pilot-event";
import { SchoolQuickAccess } from "@/components/school-quick-access";
import { SchoolJourney, SchoolTechnicalSections } from "@/components/school-unified-experience";
import { SchoolUnifiedNavigation, SchoolConversionPath } from "@/components/school-unified-navigation";
import { SchoolPrivateTopbar } from "@/components/school-private-language-switch";
import { SchoolLocalizedWorkspaceHome } from "@/components/school-localized-workspace-home";
import { schoolWorkspaceLocale } from "@/lib/school-workspace-i18n";
import { appRoutes } from "@/lib/routes";

const technicalShortcuts = [
  { label: "EN 10219", href: `${appRoutes.knowledge.schoolStandards}?q=EN%2010219` },
  { label: "EN 10210", href: `${appRoutes.knowledge.schoolStandards}?q=EN%2010210` },
  { label: "S355J2H", href: `${appRoutes.knowledge.schoolGrades}?q=S355J2H` },
  { label: "P265GH", href: `${appRoutes.knowledge.schoolGrades}?q=P265GH` },
] as const;

export default async function SchoolPage({searchParams}:{searchParams:Promise<{lang?:string}>}) {
  const locale=schoolWorkspaceLocale((await searchParams).lang);
  if(locale!=="it") return <SchoolLocalizedWorkspaceHome locale={locale}/>;
  return (
    <FocusPage className="max-w-[1120px]">
      <PilotEvent eventName="school_home_viewed" metadata={{ surface: "school_home" }} />
      <SchoolPrivateTopbar locale="it"/>
      <SchoolUnifiedNavigation locale="it" scope="workspace" />
      <section aria-labelledby="school-workspace-cine-heading" className="relative isolate overflow-hidden rounded-[28px] bg-[#102921] text-white shadow-[0_24px_64px_-40px_rgba(9,36,26,.8)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cover bg-[position:72%_center] opacity-65" style={{backgroundImage:"url('/home-cine1a-steel.webp')"}} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(9,31,23,.96)_0%,rgba(9,31,23,.89)_47%,rgba(9,31,23,.43)_100%)]" />
        <div className="relative grid items-center gap-6 px-6 py-8 sm:px-9 sm:py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#a6d4ba]">Smart Steel Sales / School</p>
            <h1 id="school-workspace-cine-heading" className="mt-4 text-3xl font-semibold leading-tight tracking-[-.04em] text-white sm:text-4xl">L’acciaio, spiegato bene.</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[#d2e4d9]">Norme, materiali e geometrie. Studia un argomento o approfondisci con l’assistente tecnico, mantenendo separati i documenti aziendali.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/school/assistant" className="inline-flex min-h-11 items-center rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[#143b2d] transition hover:bg-[#e4f2e9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Chiedi all’assistente <span aria-hidden="true" className="ml-2">→</span></Link>
              <Link href="/school/norme" className="inline-flex min-h-11 items-center rounded-xl border border-white/35 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Esplora le norme</Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-3 backdrop-blur-sm">
            <SchoolTechnicalSections locale="it"/>
          </div>
        </div>
      </section>
      <SchoolAssistantEntry locale="it"/>
      <SchoolJourney locale="it" workspace />
      <SchoolConversionPath locale="it" />

      <details className="group rounded-2xl border border-[#d5e3da] bg-white px-4 py-4 sm:px-5">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#174b3c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c] [&::-webkit-details-marker]:hidden">
          Altri strumenti e cataloghi tecnici
          <span aria-hidden="true" className="text-base transition group-open:rotate-45">+</span>
        </summary>
        <div className="mt-4 space-y-5">
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
        <FocusSectionHeader
          eyebrow="Cataloghi"
          title={<span id="school-catalogs">Vai direttamente al riferimento tecnico</span>}
        />

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

        </div>
      </details>

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
