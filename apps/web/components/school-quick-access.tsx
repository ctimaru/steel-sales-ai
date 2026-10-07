"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const RECENT_KEY = "smart-steel-sales:school:recent:v1";
const FAVORITES_KEY = "smart-steel-sales:school:favorites:v1";

type SchoolEntry = {
  href: string;
  label: string;
};

const tools: SchoolEntry[] = [
  { href: "/school/tubes", label: "Calcolo pesi" },
  { href: "/school/norme", label: "Norme" },
  { href: "/school/gradi", label: "Gradi" },
  { href: "/school/explorer", label: "Documenti aziendali" },
];

function readEntries(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [] as SchoolEntry[];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [] as SchoolEntry[];
    return parsed.filter(
      (item): item is SchoolEntry =>
        Boolean(item) &&
        typeof item.href === "string" &&
        item.href.startsWith("/school") &&
        typeof item.label === "string",
    );
  } catch {
    return [] as SchoolEntry[];
  }
}

function writeEntries(key: string, entries: SchoolEntry[]) {
  window.localStorage.setItem(key, JSON.stringify(entries));
}

function labelForPath(pathname: string) {
  if (pathname.startsWith("/school/tubes")) return "Calcolo pesi";
  if (pathname.startsWith("/school/norme")) return "Norme";
  if (pathname.startsWith("/school/gradi")) return "Gradi";
  if (pathname.startsWith("/school/explorer")) return "Documenti aziendali";
  if (pathname.startsWith("/school/catalogo")) return "Catalogo completo";
  return "Scuola";
}

export function SchoolVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname === "/school" || !pathname.startsWith("/school/")) return;

    const entry = { href: pathname, label: labelForPath(pathname) };
    const current = readEntries(RECENT_KEY).filter((item) => item.href !== pathname);
    writeEntries(RECENT_KEY, [entry, ...current].slice(0, 5));
  }, [pathname]);

  return null;
}

export function SchoolQuickAccess() {
  const [favorites, setFavorites] = useState<SchoolEntry[]>([]);
  const [recent, setRecent] = useState<SchoolEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFavorites(readEntries(FAVORITES_KEY));
    setRecent(readEntries(RECENT_KEY));
    setReady(true);
  }, []);

  const favoriteHrefs = useMemo(
    () => new Set(favorites.map((item) => item.href)),
    [favorites],
  );

  function toggleFavorite(tool: SchoolEntry) {
    const next = favoriteHrefs.has(tool.href)
      ? favorites.filter((item) => item.href !== tool.href)
      : [...favorites, tool];
    setFavorites(next);
    writeEntries(FAVORITES_KEY, next);
  }

  return (
    <section aria-labelledby="school-quick-access">
      <div className="mb-3">
        <p className="app-kicker">Accesso rapido</p>
        <h2 id="school-quick-access" className="mt-1 text-xl font-semibold text-[#1d2824]">
          Recenti e preferiti
        </h2>
        <p className="mt-1 text-sm text-[#5d6a65]">
          Salvati su questo dispositivo, senza rendere pubblica la tua attività.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#5d6a65]">Preferiti</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {tools.map((tool) => {
              const active = favoriteHrefs.has(tool.href);
              return (
                <div
                  key={tool.href}
                  className={[
                    "flex min-h-11 items-center gap-2 rounded-xl border px-3",
                    active
                      ? "border-[#b8d2c8] bg-[#edf5f2]"
                      : "border-[#e1e7e4] bg-[#f8faf9]",
                  ].join(" ")}
                >
                  <Link
                    href={tool.href}
                    className="min-w-0 flex-1 truncate text-sm font-semibold text-[#173f35] hover:underline"
                  >
                    {tool.label}
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(tool)}
                    aria-pressed={active}
                    aria-label={active ? `Rimuovi ${tool.label} dai preferiti` : `Aggiungi ${tool.label} ai preferiti`}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#cfd9d5] bg-white text-base font-semibold text-[#173f35] hover:border-[#9db9af]"
                  >
                    {active ? "★" : "☆"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#5d6a65]">Recenti</p>
          {!ready ? (
            <p className="mt-3 text-sm text-[#5d6a65]">Caricamento…</p>
          ) : recent.length ? (
            <div className="mt-3 divide-y divide-[#edf1ef]">
              {recent.slice(0, 4).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm font-semibold text-[#1d2824] hover:text-[#173f35]"
                >
                  <span>{item.label}</span>
                  <span aria-hidden="true" className="text-[#173f35]">→</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[#5d6a65]">
              Le sezioni tecniche che apri compariranno qui automaticamente.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
