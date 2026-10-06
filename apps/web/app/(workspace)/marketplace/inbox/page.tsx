import Link from "next/link";

import { FocusHeader, FocusPage } from "@/components/focus-ui";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InboxPriority = "urgent" | "high" | "normal" | "waiting";
type InboxStage = "rfq" | "negotiation" | "po";

type InboxItem = {
  item_id: string;
  kind: "rfq" | "negotiation" | "purchase_order";
  stage: InboxStage;
  priority: InboxPriority;
  requires_action: boolean;
  rfq_id: string;
  rfq_title: string;
  supplier_id: string | null;
  supplier_name: string | null;
  source_id: string;
  source_status: string;
  headline: string;
  detail: string;
  action_label: string;
  action_code: string;
  due_at: string | null;
  activity_at: string | null;
  sort_rank: number;
};

type InboxData = {
  contract?: string;
  generated_at?: string;
  summary?: {
    attention_total?: number;
    urgent?: number;
    due_24h?: number;
    overdue?: number;
    awaiting_buyer?: number;
    waiting_supplier?: number;
    po_attention?: number;
    active_rfqs?: number;
  };
  items?: InboxItem[];
};

type SearchParams = Promise<{
  view?: string;
  stage?: string;
}>;

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTime(value: string | null) {
  if (!value) return "Nessuna scadenza";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Nessuna scadenza";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function dueLabel(value: string | null) {
  if (!value) return null;
  const due = new Date(value).getTime();
  if (!Number.isFinite(due)) return null;
  const deltaMs = due - Date.now();
  const hours = Math.round(Math.abs(deltaMs) / 3_600_000);

  if (deltaMs < 0) {
    if (hours < 24) return "Scaduta da " + Math.max(1, hours) + "h";
    return "Scaduta da " + Math.max(1, Math.round(hours / 24)) + "g";
  }

  if (hours < 24) return "Scade tra " + Math.max(1, hours) + "h";
  return "Scade tra " + Math.max(1, Math.round(hours / 24)) + "g";
}

function priorityMeta(priority: InboxPriority) {
  if (priority === "urgent") {
    return {
      label: "Urgente",
      badge: "bg-[#fff0ee] text-[#8a3e35]",
      border: "border-[#e8c7c2]",
    };
  }
  if (priority === "high") {
    return {
      label: "Alta",
      badge: "bg-[#fff7e8] text-[#7a5a20]",
      border: "border-[#ead9b6]",
    };
  }
  if (priority === "waiting") {
    return {
      label: "In attesa",
      badge: "bg-[#f2f4f3] text-[#66736e]",
      border: "border-[#dce2df]",
    };
  }
  return {
    label: "Normale",
    badge: "bg-[#edf5f2] text-[#173f35]",
    border: "border-[#cfe1da]",
  };
}

function stageLabel(stage: InboxStage) {
  if (stage === "po") return "Purchase Order";
  if (stage === "negotiation") return "Negoziazione";
  return "RFQ";
}

function filterHref(view: string, stage: string) {
  const params = new URLSearchParams();
  if (view !== "attention") params.set("view", view);
  if (stage !== "all") params.set("stage", stage);
  const query = params.toString();
  return appRoutes.marketplace.procurementInbox + (query ? "?" + query : "");
}

function InboxCard({ item }: { item: InboxItem }) {
  const meta = priorityMeta(item.priority);
  const due = dueLabel(item.due_at);

  return (
    <article className={"rounded-2xl border bg-white p-4 sm:p-5 " + meta.border}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={"rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] " + meta.badge}>
              {meta.label}
            </span>
            <span className="rounded-full bg-[#f7f9f8] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]">
              {stageLabel(item.stage)}
            </span>
            {item.requires_action ? (
              <span className="rounded-full bg-[#173f35] px-2.5 py-1 text-[10px] font-bold text-white">
                Azione buyer
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 text-base font-semibold text-[#1d2824] sm:text-lg">
            {item.headline}
          </h3>
          <p className="mt-1 text-sm font-semibold text-[#43524c]">
            {item.rfq_title}
          </p>
          {item.supplier_name ? (
            <p className="mt-1 text-xs text-[#718078]">
              Supplier: {item.supplier_name}
            </p>
          ) : null}
          <p className="mt-2 text-xs leading-5 text-[#66736e]">
            {item.detail}
          </p>
        </div>

        <div className="shrink-0 text-right">
          {due ? (
            <p className={[
              "text-xs font-bold",
              item.due_at && new Date(item.due_at).getTime() < Date.now()
                ? "text-[#9a4f45]"
                : "text-[#6f5b29]",
            ].join(" ")}>
              {due}
            </p>
          ) : (
            <p className="text-[10px] text-[#87908c]">
              {formatDateTime(item.activity_at)}
            </p>
          )}
          {item.due_at ? (
            <p className="mt-1 text-[10px] text-[#87908c]">
              {formatDateTime(item.due_at)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0ee] pt-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#87908c]">
          {item.source_status.replaceAll("_", " ")}
        </span>
        <Link
          href={appRoutes.marketplace.rfqCampaign(item.rfq_id)}
          className="inline-flex min-h-10 items-center rounded-xl bg-[#173f35] px-4 text-xs font-bold text-white"
        >
          {item.action_label} →
        </Link>
      </div>
    </article>
  );
}

export default async function ProcurementInboxPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const view =
    params.view === "waiting" || params.view === "all"
      ? params.view
      : "attention";
  const stage =
    params.stage === "rfq" ||
    params.stage === "negotiation" ||
    params.stage === "po"
      ? params.stage
      : "all";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rfqh10_procurement_inbox", {
    p_limit: 200,
  });

  const inbox =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as InboxData)
      : null;

  const allItems = inbox?.items ?? [];
  const filteredItems = allItems.filter((item) => {
    const viewMatch =
      view === "all"
        ? true
        : view === "waiting"
          ? !item.requires_action
          : item.requires_action;
    const stageMatch = stage === "all" ? true : item.stage === stage;
    return viewMatch && stageMatch;
  });

  const attentionItems = filteredItems.filter((item) => item.priority === "urgent");
  const highItems = filteredItems.filter((item) => item.priority === "high");
  const otherItems = filteredItems.filter(
    (item) => item.priority !== "urgent" && item.priority !== "high",
  );

  const summary = inbox?.summary ?? {};

  return (
    <FocusPage>
      <FocusHeader
        eyebrow="RFQH10 · Procurement Inbox"
        title="Cosa richiede attenzione adesso"
        description={
          <>
            Una coda operativa unica per RFQ, negoziazioni e Purchase Order.
            Le priorità derivano da stati e scadenze reali, non da uno score opaco.
            <span className="mt-2 block text-xs font-semibold text-[#78857f]">
              {number(summary.attention_total)} azioni buyer · {number(summary.urgent)} urgenti ·{" "}
              {number(summary.overdue)} scadute
            </span>
          </>
        }
        actions={
          <>
            <Link
              href={appRoutes.marketplace.rfqHub}
              className="app-secondary inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
            >
              RFQ Hub
            </Link>
            <Link
              href="/distinta"
              className="app-primary inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
            >
              Crea distinta
            </Link>
          </>
        }
      />

      {error ? (
        <section className="rounded-2xl border border-[#ead0cb] bg-[#fff7f5] p-5">
          <p className="text-sm font-semibold text-[#8a3e35]">
            La Procurement Inbox non è temporaneamente disponibile.
          </p>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#e8c7c2] bg-[#fff8f6] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a5b54]">
            Da fare
          </p>
          <p className="mt-1 text-3xl font-semibold text-[#8a3e35]">
            {number(summary.attention_total)}
          </p>
          <p className="mt-1 text-xs text-[#7b6a66]">
            Azioni che richiedono il buyer
          </p>
        </div>
        <div className="rounded-2xl border border-[#ead9b6] bg-[#fffaf1] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#7a652e]">
            Entro 24h
          </p>
          <p className="mt-1 text-3xl font-semibold text-[#6f5b29]">
            {number(summary.due_24h)}
          </p>
          <p className="mt-1 text-xs text-[#766b53]">
            Scadenze operative imminenti
          </p>
        </div>
        <div className="rounded-2xl border border-[#cfe1da] bg-[#f3f8f6] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#527268]">
            Buyer response
          </p>
          <p className="mt-1 text-3xl font-semibold text-[#173f35]">
            {number(summary.awaiting_buyer)}
          </p>
          <p className="mt-1 text-xs text-[#66736e]">
            Negoziazioni / PO da gestire
          </p>
        </div>
        <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#718078]">
            RFQ attive
          </p>
          <p className="mt-1 text-3xl font-semibold text-[#1d2824]">
            {number(summary.active_rfqs)}
          </p>
          <p className="mt-1 text-xs text-[#718078]">
            Escluse chiuse e cancellate
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-[#dce2df] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            ["attention", "Da fare"],
            ["waiting", "In attesa"],
            ["all", "Tutto"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={filterHref(key, stage)}
              className={[
                "rounded-xl px-3 py-2 text-xs font-bold",
                view === key
                  ? "bg-[#173f35] text-white"
                  : "bg-[#f2f4f3] text-[#52615b] hover:bg-[#e8ecea]",
              ].join(" ")}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ["all", "Tutti"],
            ["rfq", "RFQ"],
            ["negotiation", "Negoziazioni"],
            ["po", "PO"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={filterHref(view, key)}
              className={[
                "rounded-xl border px-3 py-2 text-xs font-semibold",
                stage === key
                  ? "border-[#86a99e] bg-[#edf5f2] text-[#173f35]"
                  : "border-[#dce2df] text-[#66736e] hover:border-[#b8c8c2]",
              ].join(" ")}
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      {filteredItems.length === 0 ? (
        <section className="rounded-3xl border border-[#cfe1da] bg-[#f3f8f6] p-7 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#527268]">
            Inbox pulita
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#173f35]">
            Nessuna attività in questa vista
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#66736e]">
            Le nuove quote, negoziazioni, scadenze e risposte PO appariranno qui automaticamente.
          </p>
        </section>
      ) : (
        <div className="space-y-7">
          {attentionItems.length ? (
            <section>
              <div className="mb-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9a4f45]">
                  Priorità immediata
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
                  Da gestire per primi
                </h2>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {attentionItems.map((item) => (
                  <InboxCard key={item.item_id} item={item} />
                ))}
              </div>
            </section>
          ) : null}

          {highItems.length ? (
            <section>
              <div className="mb-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7a652e]">
                  Priorità alta
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
                  Prossime decisioni
                </h2>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {highItems.map((item) => (
                  <InboxCard key={item.item_id} item={item} />
                ))}
              </div>
            </section>
          ) : null}

          {otherItems.length ? (
            <section>
              <div className="mb-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#718078]">
                  Monitoraggio
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
                  In attesa o attività normali
                </h2>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {otherItems.map((item) => (
                  <InboxCard key={item.item_id} item={item} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <section className="rounded-2xl border border-[#dce2df] bg-white px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#718078]">
          Regola RFQH10
        </p>
        <p className="mt-1 text-xs leading-5 text-[#66736e]">
          La Inbox non esegue automaticamente launch, reminder, award o emissioni PO.
          Aggrega lo stato reale e porta il buyer al workflow governato che possiede già l&apos;azione.
        </p>
      </section>
    </FocusPage>
  );
}
