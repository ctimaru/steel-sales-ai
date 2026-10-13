import Link from "next/link";

import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { getDashFeed7Insights } from "@/lib/dashboard-feed7-server";
import { assessDashFeed7, DASH_FEED7_EVENTS } from "@/lib/dashboard-feed7-model";
import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

function number(value:number) {
  return new Intl.NumberFormat("it-IT",{maximumFractionDigits:0}).format(value);
}
function friendlyDay(day:string) {
  return new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",timeZone:"UTC"})
    .format(new Date(day+"T00:00:00Z"));
}
export default async function DashFeed7InsightsPage({
  searchParams,
}: {
  searchParams:Promise<{days?:string}>;
}) {
  await requirePlatformSuperadmin();
  const {days:rawDays} = await searchParams;
  const days:7|30 = rawDays==="7" ? 7 : 30;
  const snapshot = await getDashFeed7Insights(days);
  const assessment = snapshot ? assessDashFeed7(snapshot) : null;
  const totalActions = snapshot ? Object.values(snapshot.actions).reduce((a,b)=>a+b,0) : 0;
  const actionRows = snapshot ? DASH_FEED7_EVENTS.map((event)=>({
    ...event,value:snapshot.actions[event.key],
  })) : [];

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-3 py-4 sm:px-6 sm:py-7">
      <header className="space-y-2">
        <Link href={appRoutes.platform.productAnalytics} className="inline-flex min-h-11 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2">
          ← Product Analytics
        </Link>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#22634f]">DASH-FEED7 · Solo superadmin</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#173f35] sm:text-3xl">Engagement e ritorno alla Home</h1>
        <p className="max-w-3xl text-sm leading-6 text-[#52615b]">
          Visite e clic espliciti, aggregati dal registro interno. Nessun nome utente, azienda,
          RFQ, URL visitato o dato commerciale è esposto da questa vista.
        </p>
        <nav aria-label="Periodo di analisi" className="flex flex-wrap gap-2 pt-2">
          {([7,30] as const).map((option)=>(
            <Link key={option} href={appRoutes.platform.feedInsights+"?days="+option}
              aria-current={days===option?"page":undefined}
              className={"inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 "+
                (days===option?"border-[#173f35] bg-[#173f35] text-white":"border-[#c2d5c9] bg-white text-[#175640] hover:bg-[#f1f7f3]")}>
              {option} giorni
            </Link>
          ))}
        </nav>
      </header>

      {snapshot && assessment ? (
        <>
          <section aria-labelledby="feed7-readiness" className="rounded-2xl border border-[#d5e1d8] bg-white p-4 sm:p-5">
            <h2 id="feed7-readiness" className="text-base font-semibold text-[#173f35]">Qualità dei dati · {assessment.state==="exploratory"?"Lettura esplorativa":"In raccolta"}</h2>
            <p role="status" className="mt-2 text-sm leading-6 text-[#52615b]">{assessment.message}</p>
            <p className="mt-2 text-xs text-[#63756a]">
              Finestra UTC di {days} giorni, fino al {friendlyDay(snapshot.as_of_day)}.
              Prima apertura Home registrata: {snapshot.first_observed_home_day ? friendlyDay(snapshot.first_observed_home_day) : "non disponibile"}.
            </p>
          </section>

          <section aria-label="Indicatori di engagement" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {label:"Aperture Home",value:snapshot.home_views,note:"Eventi, non utenti unici"},
              {label:"Account distinti",value:snapshot.unique_home_users,note:"Autenticati che hanno aperto la Home"},
              {label:"Account su più giorni",value:snapshot.returning_home_users,note:"Home aperta in almeno due date UTC nel periodo"},
              {label:"Clic feed",value:totalActions,note:"Azioni esplicite registrate, non conversioni"},
            ].map((card)=>(
              <div key={card.label} className="min-w-0 rounded-2xl border border-[#dce6dd] bg-white p-4">
                <p className="text-2xl font-semibold tabular-nums text-[#173f35]">{number(card.value)}</p>
                <h2 className="mt-1 text-sm font-semibold text-[#354b3e]">{card.label}</h2>
                <p className="mt-1 text-xs leading-5 text-[#63756a]">{card.note}</p>
              </div>
            ))}
          </section>

          <section aria-labelledby="feed7-actions" className="rounded-2xl border border-[#dce6dd] bg-white p-4 sm:p-5">
            <h2 id="feed7-actions" className="text-lg font-semibold text-[#173f35]">Quali elementi vengono aperti?</h2>
            <p className="mt-1 text-xs leading-5 text-[#63756a]">
              Conteggi di clic best effort. La navigazione non attende la registrazione; un clic può non essere acquisito.
              Non sono tassi di conversione né impression dei singoli elementi.
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {actionRows.map((item)=>(
                <div key={item.key} className="rounded-xl border border-[#e2e9e4] bg-[#f8faf9] p-3">
                  <dd className="text-xl font-semibold tabular-nums text-[#173f35]">{number(item.value)}</dd>
                  <dt className="mt-1 text-xs font-medium text-[#52615b]">{item.label}</dt>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="feed7-retention" className="rounded-2xl border border-[#dce6dd] bg-white p-4 sm:p-5">
            <h2 id="feed7-retention" className="text-lg font-semibold text-[#173f35]">Ritorno D+1 e D+7 · Coorti osservate</h2>
            <p className="mt-1 text-xs leading-5 text-[#63756a]">
              Primo giorno in cui un account è stato osservato sulla Home (non giorno di registrazione).
              Ritorno = nuova apertura nello stesso giorno UTC +1 o +7. Si contano solo le coorti
              che hanno avuto il tempo di maturare; le percentuali sono omesse sotto 10 account eleggibili.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {([{label:"D+1",data:snapshot.d1},{label:"D+7",data:snapshot.d7}] as const).map((row)=>(
                <div key={row.label} className="rounded-xl border border-[#e2e9e4] bg-[#f8faf9] p-4">
                  <p className="text-sm font-semibold text-[#354b3e]">{row.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-[#173f35]">
                    {row.data.rate_percent===null?"Campione insufficiente":row.data.rate_percent.toLocaleString("it-IT")+"%"}
                  </p>
                  <p className="mt-1 text-xs text-[#63756a]">
                    {number(row.data.returned)} rientri / {number(row.data.eligible)} account eleggibili
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="feed7-daily" className="rounded-2xl border border-[#dce6dd] bg-white p-4 sm:p-5">
            <h2 id="feed7-daily" className="text-lg font-semibold text-[#173f35]">Andamento giornaliero</h2>
            <p className="mt-1 text-xs leading-5 text-[#63756a]">Giorni senza eventi mostrati come zero. Gli account unici giornalieri non vanno sommati tra date.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[580px] border-collapse text-left text-xs">
                <thead className="text-[#52615b]">
                  <tr className="border-b border-[#dce6dd]">
                    <th scope="col" className="px-2 py-3">Giorno UTC</th>
                    <th scope="col" className="px-2 py-3 text-right">Home</th>
                    <th scope="col" className="px-2 py-3 text-right">Account</th>
                    <th scope="col" className="px-2 py-3 text-right">Fonti</th>
                    <th scope="col" className="px-2 py-3 text-right">Preferenze</th>
                    <th scope="col" className="px-2 py-3 text-right">Network</th>
                    <th scope="col" className="px-2 py-3 text-right">Marketplace</th>
                  </tr>
                </thead>
                <tbody>
                  {[...snapshot.daily].reverse().map((day)=>(
                    <tr key={day.day} className="border-b border-[#edf1ed] text-[#354b3e]">
                      <th scope="row" className="whitespace-nowrap px-2 py-3 font-medium">{friendlyDay(day.day)}</th>
                      {([day.home_views,day.active_users,day.news_source,day.interests,day.network_profiles,day.opportunities]).map((value,i)=>(
                        <td key={i} className="px-2 py-3 text-right tabular-nums">{number(value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="pb-4 text-xs leading-5 text-[#63756a]">
            Interpretatione: osservazione descrittiva del pilot, senza inferire valore prodotto, causalità
            o retention generalizzabile da un account di test. Le metriche non alterano il ranking del feed.
          </p>
        </>
      ) : (
        <section role="status" className="rounded-2xl border border-[#e7d4ae] bg-white p-5">
          <h2 className="text-base font-semibold text-[#173f35]">Dati engagement non disponibili</h2>
          <p className="mt-2 text-sm leading-6 text-[#52615b]">
            Impossibile leggere o validare gli aggregati in questo momento. Non vengono mostrati valori stimati o inventati.
            La Home e le funzionalità commerciali restano disponibili.
          </p>
        </section>
      )}
    </main>
  );
}
