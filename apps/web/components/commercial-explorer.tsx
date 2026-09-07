import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DataMode, ExplorerFilters } from "@/lib/commercial-data";
import type { CommercialRow, ItemRole } from "@/lib/demo-data";

function roleTone(role: ItemRole) {
  if (role === "requested") return "blue" as const;
  if (role === "offered") return "green" as const;
  if (role === "ordered") return "violet" as const;
  return "neutral" as const;
}

function pageHref(filters: ExplorerFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.role && filters.role !== "all") params.set("role", filters.role);
  if (filters.grade && filters.grade !== "all") params.set("grade", filters.grade);
  if (filters.standard && filters.standard !== "all") params.set("standard", filters.standard);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/explorer?${query}` : "/explorer";
}

export function CommercialExplorer({
  rows,
  total,
  page,
  pageSize,
  filters,
  mode,
}: {
  rows: CommercialRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: ExplorerFilters;
  mode: DataMode;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <form className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_180px_180px_auto]">
          <Input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Cerca 406 x 6,3, S355J2H..."
            aria-label="Cerca nel Commercial Explorer"
          />
          <select
            name="role"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            defaultValue={filters.role ?? "all"}
          >
            <option value="all">Tutti i ruoli</option>
            <option value="requested">Requested</option>
            <option value="offered">Offered</option>
            <option value="ordered">Ordered</option>
            <option value="delivered">Delivered</option>
          </select>
          <Input name="grade" defaultValue={filters.grade === "all" ? "" : filters.grade ?? ""} placeholder="Qualità, es. S355J2H" />
          <Input name="standard" defaultValue={filters.standard === "all" ? "" : filters.standard ?? ""} placeholder="Norma, es. EN 10219" />
          <button className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">
            Filtra
          </button>
        </form>
      </Card>

      {mode === "awaiting_assignment" ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Il dataset live è già caricato e protetto da RLS, ma non è ancora assegnato a un utente Auth.
          Dopo il primo accesso verrà associato al tuo account e questi risultati diventeranno live.
        </Card>
      ) : null}

      <div className="flex flex-col justify-between gap-1 text-xs text-slate-500 sm:flex-row">
        <span>{total.toLocaleString("it-IT")} risultati {mode === "live" ? "nel database live" : "in modalità demo"}</span>
        <span>Pagina {page} di {totalPages} · max {pageSize} righe</span>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <Link href={`/conversations/${row.conversationId}`} key={row.id}>
            <Card className="grid gap-4 p-4 transition hover:border-slate-400 md:grid-cols-[1.5fr_1fr_0.7fr_0.55fr] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={roleTone(row.role)}>{row.role}</Badge>
                  {row.availability === "stock" ? <Badge tone="green">stock</Badge> : null}
                  {row.availability === "production" ? <Badge tone="amber">production</Badge> : null}
                </div>
                <p className="mt-2 font-semibold text-slate-950">{row.product}</p>
                <p className="mt-1 text-xs text-slate-500">{row.grade} · {row.standard}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Thread / fonte</p>
                <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">{row.company}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Prezzo</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{row.price ?? "—"}</p>
              </div>
              <div className="md:text-right">
                <p className="text-xs text-slate-400">{row.date}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{Math.round(row.confidence * 100)}% confidence</p>
              </div>
            </Card>
          </Link>
        ))}

        {rows.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="font-semibold text-slate-800">Nessun risultato</p>
            <p className="mt-2 text-sm text-slate-500">Modifica i filtri o la ricerca.</p>
          </Card>
        ) : null}
      </div>

      {mode === "live" && totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          {page > 1 ? (
            <Link href={pageHref(filters, page - 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">← Precedente</Link>
          ) : null}
          {page < totalPages ? (
            <Link href={pageHref(filters, page + 1)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">Successiva →</Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
