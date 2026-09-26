import Link from "next/link";
import { redirect } from "next/navigation";

import {
  markAllNetworkActivityRead,
  markNetworkActivityRead,
} from "@/app/(workspace)/network/actions";
import { getActiveOrganizationContext, getNetworkActivityFeed } from "@/lib/network";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";

function formatWhen(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function NetworkActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ unread?: string; error?: string; message?: string }>;
}) {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");

  const params = await searchParams;
  const organization = await getActiveOrganizationContext();
  if (!organization) redirect("/network?error=Nessuna%20organization%20attiva");

  const unreadOnly = params.unread === "1";
  const feed = await getNetworkActivityFeed(organization.organization_id, unreadOnly);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/network" className="text-sm font-semibold text-slate-500 hover:text-slate-950">
            ← Torna alla directory
          </Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Network activity</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Aggiornamenti aziende seguite</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Solo cambiamenti effettivamente pubblicati nel Network. Inquiry, claim, moderation e Commercial Memory non compaiono qui.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={unreadOnly ? "/network/activity" : "/network/activity?unread=1"}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          >
            {unreadOnly ? "Mostra tutte" : "Solo non lette"}
          </Link>
          <Link
            href="/network/following"
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          >
            Aziende seguite
          </Link>
          {feed.unread > 0 ? (
            <form action={markAllNetworkActivityRead}>
              <button className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">
                Segna tutte lette
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {params.error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{params.error}</div> : null}
      {params.message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{params.message}</div> : null}

      <div className="flex items-center gap-3 text-sm">
        <span className="font-semibold text-slate-900">{feed.total} activity</span>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{feed.unread} non lette</span>
      </div>

      {feed.items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-slate-900">
            {unreadOnly ? "Nessuna activity non letta" : "Nessun aggiornamento disponibile"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Gli eventi precedenti al follow non vengono retro-popolati.
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {feed.items.map((item) => (
            <article
              key={item.activity_event_id}
              className={
                "rounded-2xl border bg-white p-5 " +
                (item.is_unread ? "border-indigo-200 shadow-sm" : "border-slate-200")
              }
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{item.company_name}</p>
                    {item.is_unread ? (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                        Nuovo
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{item.summary}</p>
                  <p className="mt-2 text-xs text-slate-400">{formatWhen(item.occurred_at)}</p>
                </div>

                <div className="flex gap-2">
                  {item.is_unread ? (
                    <form action={markNetworkActivityRead}>
                      <input type="hidden" name="activity_event_id" value={item.activity_event_id} />
                      <button className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600">
                        Segna letta
                      </button>
                    </form>
                  ) : null}

                  <form action={markNetworkActivityRead}>
                    <input type="hidden" name="activity_event_id" value={item.activity_event_id} />
                    <input type="hidden" name="network_company_id" value={item.network_company_id} />
                    <button className="h-9 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white">
                      Apri profilo
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
