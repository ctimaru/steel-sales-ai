"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DataMode } from "@/lib/data/commercial";
import type { CommercialRow, ItemRole } from "@/lib/demo-data";

function roleTone(role: ItemRole) {
  if (role === "requested") return "blue" as const;
  if (role === "offered") return "green" as const;
  if (role === "ordered") return "violet" as const;
  return "neutral" as const;
}

export function CommercialExplorer({ rows, mode }: { rows: CommercialRow[]; mode: DataMode }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<ItemRole | "all">("all");
  const [grade, setGrade] = useState("all");
  const [standard, setStandard] = useState("all");

  const grades = Array.from(new Set(rows.map((row) => row.grade))).sort();
  const standards = Array.from(new Set(rows.map((row) => row.standard))).sort();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesQuery =
        !q ||
        [row.product, row.company, row.grade, row.standard, row.price]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      const matchesRole = role === "all" || row.role === role;
      const matchesGrade = grade === "all" || row.grade === grade;
      const matchesStandard = standard === "all" || row.standard === standard;

      return matchesQuery && matchesRole && matchesGrade && matchesStandard;
    });
  }, [grade, query, role, rows, standard]);

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_180px_180px]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca 406 x 6,3, S355J2H..."
            aria-label="Cerca nel Commercial Explorer"
          />
          <select
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            value={role}
            onChange={(event) => setRole(event.target.value as ItemRole | "all")}
          >
            <option value="all">Tutti i ruoli</option>
            <option value="requested">Requested</option>
            <option value="offered">Offered</option>
            <option value="ordered">Ordered</option>
            <option value="delivered">Delivered</option>
          </select>
          <select
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
          >
            <option value="all">Tutte le qualità</option>
            {grades.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            value={standard}
            onChange={(event) => setStandard(event.target.value)}
          >
            <option value="all">Tutte le norme</option>
            {standards.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-4 text-xs text-slate-500">
        <span>{filtered.length} risultati</span>
        <span>
          {mode === "live"
            ? "Supabase live · RLS owner-scoped"
            : mode === "empty"
              ? "Supabase collegato · dataset non assegnato"
              : "Modalità demo"}
        </span>
      </div>

      <div className="space-y-3">
        {filtered.map((row) => (
          <Link href={`/conversations/${row.conversationId}`} key={row.id}>
            <Card className="grid gap-4 p-4 transition hover:border-slate-400 md:grid-cols-[1.5fr_0.8fr_0.7fr_0.55fr] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={roleTone(row.role)}>{row.role}</Badge>
                  {row.availability === "stock" ? <Badge tone="green">stock</Badge> : null}
                  {row.availability === "production" ? <Badge tone="amber">production</Badge> : null}
                </div>
                <p className="mt-2 font-semibold text-slate-950">{row.product}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {row.grade} · {row.standard}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Origine</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{row.company}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Prezzo</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{row.price ?? "—"}</p>
              </div>
              <div className="md:text-right">
                <p className="text-xs text-slate-400">{row.date}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  {Math.round(row.confidence * 100)}% confidence
                </p>
              </div>
            </Card>
          </Link>
        ))}

        {filtered.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="font-semibold text-slate-800">
              {mode === "empty" ? "Dataset non ancora assegnato" : "Nessun risultato"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {mode === "empty"
                ? "Dopo il primo accesso Auth assegneremo il dataset validato a questo utente."
                : "Modifica i filtri o la ricerca."}
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
