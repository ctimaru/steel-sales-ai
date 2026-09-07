import { CommercialExplorer } from "@/components/commercial-explorer";
import { getExplorerData, type ExplorerFilters } from "@/lib/commercial-data";
import type { ItemRole } from "@/lib/demo-data";

export default async function ExplorerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const read = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const roleValue = read("role");
  const filters: ExplorerFilters = {
    q: read("q") ?? "",
    role:
      roleValue === "requested" || roleValue === "offered" || roleValue === "ordered" || roleValue === "delivered"
        ? (roleValue as ItemRole)
        : "all",
    grade: read("grade") || "all",
    standard: read("standard") || "all",
    page: Number(read("page") ?? 1),
  };

  const data = await getExplorerData(filters);

  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <p className="text-sm font-semibold text-slate-500">Commercial Intelligence</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Commercial Explorer
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Cerca nell’archivio commerciale per prodotto, qualità, norma e ruolo. I filtri sono
          eseguiti server-side sulle tabelle app-facing protette da RLS.
        </p>
      </div>
      <div className="mt-7">
        <CommercialExplorer {...data} filters={filters} />
      </div>
    </div>
  );
}
