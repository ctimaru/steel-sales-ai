"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SCHOOL_PRIVATE_COPY, schoolWorkspaceHref, type SchoolWorkspaceLocale } from "@/lib/school-workspace-i18n";

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
        /^\/school(?:\/[a-z0-9-]+)*$/.test(item.href) &&
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

export function SchoolQuickAccess({locale="it"}:{locale?:SchoolWorkspaceLocale}) {
  const copy=SCHOOL_PRIVATE_COPY[locale];
  const localizedTool=(path:string,label:string)=>{
    if(path.startsWith("/school/tubes"))return copy.calculator;
    if(path.startsWith("/school/norme"))return copy.standards;
    if(path.startsWith("/school/gradi"))return copy.grades;
    if(path.startsWith("/school/explorer"))return copy.docs;
    return label;
  };
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
        <p className="app-kicker">{copy.kicker}</p>
        <h2 id="school-quick-access" className="mt-1 text-xl font-semibold text-[#1d2824]">
          {copy.latest}
        </h2>
        <p className="mt-1 text-sm text-[#5d6a65]">
          {copy.savedHint}
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#5d6a65]">{copy.favorites}</p>
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
                    href={schoolWorkspaceHref(tool.href,locale)}
                    className="min-w-0 flex-1 truncate text-sm font-semibold text-[#173f35] hover:underline"
                  >
                    {localizedTool(tool.href,tool.label)}
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(tool)}
                    aria-pressed={active}
                    aria-label={active ? `${copy.removeFavorite}: ${localizedTool(tool.href,tool.label)}` : `${copy.addFavorite}: ${localizedTool(tool.href,tool.label)}`}
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
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#5d6a65]">{copy.recent}</p>
          {!ready ? (
            <p className="mt-3 text-sm text-[#5d6a65]">{copy.loading}…</p>
          ) : recent.length ? (
            <div className="mt-3 divide-y divide-[#edf1ef]">
              {recent.slice(0, 4).map((item) => (
                <Link
                  key={item.href}
                  href={schoolWorkspaceHref(item.href,locale)}
                  className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm font-semibold text-[#1d2824] hover:text-[#173f35]"
                >
                  <span>{localizedTool(item.href,item.label)}</span>
                  <span aria-hidden="true" className="text-[#173f35]">→</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[#5d6a65]">
              {copy.emptyRecent}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
