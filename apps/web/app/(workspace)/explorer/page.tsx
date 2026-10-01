import { CommercialExplorer } from "@/components/commercial-explorer";
import { canWriteWorkspace } from "@/lib/access-policy";
import { getExplorerData, type ExplorerFilters } from "@/lib/commercial-data";
import type { ItemRole } from "@/lib/demo-data";
import { getWorkspaceContext } from "@/lib/workspace-context";

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

  const [data, context] = await Promise.all([
    getExplorerData(filters),
    getWorkspaceContext(),
  ]);
  const canWrite = canWriteWorkspace(context.role);

  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <p className="text-sm font-semibold text-slate-500">Commercial Intelligence</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Commercial Explorer
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Workspace operativo normalizzato per prodotto, qualità, norma e ruolo. RFQ, offerte e ordini
          diventano la fonte operativa; le osservazioni storiche restano evidenza e provenienza.
        </p>
      </div>
      <div className="mt-7">
        <CommercialExplorer {...data} filters={filters} canWrite={canWrite} />
      </div>
    </div>
  );
}
