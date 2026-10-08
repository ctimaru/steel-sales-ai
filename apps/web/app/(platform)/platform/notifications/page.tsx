import Link from "next/link";
import { NotificationRefreshButton } from "@/components/notification-refresh-button";

import { setPlatformNotificationState } from "@/app/(platform)/platform/notifications/actions";
import { NotificationFormButton } from "@/app/(workspace)/notifications/notification-form-button";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformConsoleContext } from "@/lib/platform-admin";
import {
  formatNotificationTime,
  normalizePlatformNotificationFilter,
  parsePlatformNotificationSnapshot,
  type PlatformNotificationFilter,
  type PlatformNotificationItem,
} from "@/lib/platform-notifications";

export const dynamic = "force-dynamic";

const FILTERS: Array<{ id: PlatformNotificationFilter; label: string }> = [
  { id: "all", label: "Tutte" },
  { id: "unread", label: "Da leggere" },
  { id: "registrations", label: "Registrazioni" },
  { id: "claims", label: "Claim" },
  { id: "incidents", label: "Incidenti" },
  { id: "archived", label: "Archiviate" },
];

function NotificationActions({ item, filter, page }: {
  item: PlatformNotificationItem;
  filter: PlatformNotificationFilter;
  page: number;
}) {
  const options = item.archivedAt
    ? [{ name: "restore", label: "Ripristina" }]
    : [
        { name: item.readAt ? "unread" : "read", label: item.readAt ? "Segna da leggere" : "Segna come letta" },
        { name: "archive", label: "Archivia" },
      ];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <form key={option.name} action={setPlatformNotificationState}>
          <input type="hidden" name="recipient_id" value={item.id} />
          <input type="hidden" name="action" value={option.name} />
          <input type="hidden" name="filter" value={filter} />
          <input type="hidden" name="page" value={page} />
          <NotificationFormButton label={option.label} tone={option.name === "read" ? "primary" : "neutral"} />
        </form>
      ))}
    </div>
  );
}

export default async function PlatformNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; error?: string; unavailable?: string }>;
}) {
  const query = await searchParams;
  const filter = normalizePlatformNotificationFilter(query.filter);
  const requestedPage = Number(query.page ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 50
    ? requestedPage : 1;
  const offset = (page - 1) * 15;
  await requirePlatformConsoleContext();
  let snapshot = null;
  const client = await createClient();
  try {
    const { data,error } = await client.rpc("nc32_platform_notifications_read", {
      p_filter:filter,p_limit:15,p_offset:offset,
    });
    if(!error) snapshot=parsePlatformNotificationSnapshot(data);
  } catch {snapshot=null;}

  const filterHref = (f: PlatformNotificationFilter, p=1) =>
    `${appRoutes.platform.notifications}?filter=${f}&page=${p}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#57776a]">Console Platform</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824] sm:text-3xl">
            Centro notifiche Platform
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66736e]">
            Aggiornamenti di registrazioni, claim e incidenti destinati al tuo ruolo amministrativo.
            Nessun dato della Commercial Memory delle aziende è disponibile in questa inbox.
          </p>

          <p className="mt-1 max-w-2xl text-xs text-[#70817a]">La campanella verifica automaticamente le novità; se la connessione è interrotta, usa Aggiorna.</p>        </div>
        <div className="flex flex-wrap gap-2">
          <NotificationRefreshButton />
          <Link href={appRoutes.platform.home}
            className="inline-flex min-h-10 items-center rounded-xl border border-[#d2dfd8] bg-white px-4 text-sm font-semibold text-[#365749] hover:bg-[#edf5f2]">
            Console Platform
          </Link>
        </div>
      </div>

      {query.error ? (
        <p role="alert" className="rounded-xl border border-[#edd5ad] bg-[#fffaf0] p-4 text-sm text-[#835f23]">
          {query.error === "update" ? "Non è stato possibile salvare la modifica. Aggiorna e riprova."
            : "Operazione non valida."}
        </p>
      ) : null}
      {query.unavailable ? (
        <p role="alert" className="rounded-xl border border-[#edd5ad] bg-[#fffaf0] p-4 text-sm text-[#835f23]">
          Collegamento non disponibile o accesso al contenuto non autorizzato.
          Il record originale potrebbe essere stato modificato oppure i tuoi permessi potrebbero essere cambiati.
        </p>
      ) : null}

      {!snapshot ? (
        <section role="alert" className="rounded-2xl border border-[#edd5ad] bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#946515]">Verifica non disponibile</p>
          <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">Impossibile verificare le notifiche Platform</h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Non è stato possibile recuperare un elenco attendibile. Questo non significa che non ci siano messaggi.
          </p>
          <Link href={filterHref(filter,page)} className="mt-4 inline-flex rounded-lg bg-[#173f35] px-4 py-2.5 text-sm font-semibold text-white">
            Riprova
          </Link>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="rounded-2xl border border-[#dce5e2] bg-white p-4">
              <p className="text-2xl font-semibold text-[#1d2824]">{snapshot.unreadCount.toLocaleString("it-IT")}</p>
              <p className="mt-1 text-xs text-[#66736e]">Da leggere</p>
            </div>
            <div className="rounded-2xl border border-[#dce5e2] bg-white p-4">
              <p className="text-2xl font-semibold text-[#1d2824]">{snapshot.totalCount.toLocaleString("it-IT")}</p>
              <p className="mt-1 text-xs text-[#66736e]">Non archiviate</p>
            </div>
          </div>

          <nav aria-label="Filtra le notifiche" className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <Link key={item.id} href={filterHref(item.id)}
                aria-current={filter === item.id ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-xl border px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                  filter === item.id
                    ? "border-[#173f35] bg-[#173f35] text-white"
                    : "border-[#dce5e2] bg-white text-[#456056] hover:bg-[#edf5f2]"
                }`}>
                {item.label}
              </Link>
            ))}
          </nav>

          {snapshot.items.length === 0 ? (
            <section className="rounded-2xl border border-[#dce5e2] bg-white p-8 text-center">
              <h2 className="text-lg font-semibold text-[#1d2824]">
                {snapshot.filteredCount === 0 ? "Nessuna notifica in questa vista" : "Nessun elemento in questa pagina"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#66736e]">
                {snapshot.filteredCount === 0
                  ? "L'elenco verificato non contiene notifiche per questo filtro. I processi di governance rimangono disponibili nei menu Platform."
                  : "Puoi tornare alla pagina precedente per visualizzare gli elementi disponibili."}
              </p>
              <Link href={filterHref("all")} className="mt-4 inline-flex rounded-xl border border-[#dce5e2] px-4 py-2 text-sm font-semibold text-[#173f35]">Mostra tutte</Link>
            </section>
          ) : (
            <ol className="space-y-3" aria-label="Elenco notifiche personali">
              {snapshot.items.map((item) => (
                <li key={item.id} className="rounded-2xl border border-[#dce5e2] bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? "bg-[#d5dfda]" : "bg-[#20785e]"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-[#edf5f2] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.07em] text-[#2e6150]">
                          {item.eventType.includes(".registration.") ? "Registrazioni" : item.eventType.includes(".claim.") ? "Claim" : "Incidenti"}
                        </span>
                        {item.priority === "critical" ? (
                          <span className="rounded-md bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">Critica</span>
                        ) : null}
                        {!item.readAt ? <span className="text-xs font-semibold text-[#187255]">Da leggere</span> : null}
                        <time className="text-xs text-[#76847d]">{formatNotificationTime(item.occurredAt)}</time>
                      </div>
                      <h2 className="mt-2 text-base font-semibold text-[#1d2824]">{item.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-[#66736e]">{item.description}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Link href={item.href}
                          className="inline-flex min-h-9 items-center rounded-lg bg-[#173f35] px-4 py-2 text-xs font-semibold text-white hover:bg-[#275e50]">
                          Apri attività
                        </Link>
                        <NotificationActions item={item} filter={filter} page={page} />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="flex items-center justify-between gap-3 text-sm text-[#66736e]">
            <span>{snapshot.filteredCount.toLocaleString("it-IT")} notifiche in questa vista</span>
            <div className="flex items-center gap-2">
              {page > 1 ? <Link href={filterHref(filter,page-1)}
                className="rounded-xl border border-[#dce5e2] bg-white px-3 py-2 font-semibold text-[#173f35]">
                Precedenti
              </Link> : null}
              {offset + snapshot.items.length < snapshot.filteredCount ? (
                <Link href={filterHref(filter,page+1)}
                  className="rounded-xl border border-[#dce5e2] bg-white px-3 py-2 font-semibold text-[#173f35]">
                  Successive
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
