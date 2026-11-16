import { FocusPage } from "@/components/focus-ui";
import { NetworkProfileTopBar } from "@/components/network-profile-overview";

/**
 * NET-PROFILE-FAST1: shown the instant a company is opened from the list.
 * Next.js prefetches this boundary for every visible row link, so the click
 * swaps to a profile-shaped skeleton (with a working "Torna alle aziende")
 * while the server reads the profile, instead of the generic workspace loader.
 */
function Bar({ className }: { className: string }) {
  return <div aria-hidden="true" className={"rounded-full bg-[#e3e8e5] motion-safe:animate-pulse " + className} />;
}

export default function NetworkCompanyProfileLoading() {
  return (
    <FocusPage className="max-w-6xl">
      <div aria-busy="true" aria-live="polite" data-testid="network-profile-loading">
        <span className="sr-only">Apertura della scheda aziendale…</span>
        <NetworkProfileTopBar />
        <section className="mt-4 overflow-hidden rounded-[24px] border border-[#dce5df] bg-white">
          <div aria-hidden="true" className="h-16 bg-[#eef4f0]" />
          <div className="flex flex-wrap items-start gap-4 px-5 pb-6 sm:px-7">
            <div aria-hidden="true" className="-mt-8 h-16 w-16 shrink-0 rounded-2xl border-4 border-white bg-[#dfe9e3] motion-safe:animate-pulse sm:h-20 sm:w-20" />
            <div className="min-w-0 flex-1 space-y-3 pt-4">
              <Bar className="h-7 w-full max-w-md" />
              <Bar className="h-4 w-56" />
              <div className="flex flex-wrap gap-2 pt-1">
                <Bar className="h-6 w-24" />
                <Bar className="h-6 w-28" />
                <Bar className="h-6 w-20" />
              </div>
            </div>
            <div className="flex w-full gap-2 pt-4 sm:w-auto">
              <Bar className="h-11 w-32 rounded-xl" />
              <Bar className="h-11 w-28 rounded-xl" />
            </div>
          </div>
        </section>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section className="space-y-3 rounded-[22px] border border-[#dce5df] bg-white p-5">
            <Bar className="h-3 w-24" />
            <Bar className="h-5 w-64" />
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-11/12" />
            <Bar className="h-4 w-4/5" />
          </section>
          <section className="space-y-3 rounded-[22px] border border-[#dce5df] bg-white p-5">
            <Bar className="h-3 w-20" />
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-3/4" />
            <Bar className="h-4 w-2/3" />
          </section>
        </div>
      </div>
    </FocusPage>
  );
}
