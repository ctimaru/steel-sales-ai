import Link from "next/link";

import type { PlatformPermissionKey } from "@/lib/platform-access-contract";

export const GOVERNANCE_WORKSPACES = [
  { key: "registrations", title: "Registrazioni", href: "/platform/registrations", permission: "registrations.read", detail: "Valuta richieste, verifica identità e attiva aziende solo dopo approvazione." },
  { key: "discovery", title: "Discovery", href: "/platform/company-discovery", permission: "discovery.read", detail: "Rivedi fonti e candidati prima di pubblicarli nel Network." },
  { key: "claims", title: "Claims", href: "/platform/company-claims", permission: "claims.read", detail: "Verifica la prova di ownership; un claim non equivale a una verifica." },
  { key: "trust", title: "Network Trust", href: "/platform/network-trust", permission: "network_trust.read", detail: "Controlla provenance, identity resolution e verifica senza merge automatici." },
  { key: "knowledge", title: "Knowledge", href: "/platform/knowledge", permission: "knowledge.read_drafts", detail: "Revisiona fonti e contenuti, pubblicando solo dopo approvazione." },
] as const satisfies ReadonlyArray<{ key: string; title: string; href: string; permission: PlatformPermissionKey; detail: string }>;

type GovernanceKey = (typeof GOVERNANCE_WORKSPACES)[number]["key"];

export function GovernanceWorkspaceNav({
  current,
  permissions,
}: {
  current: GovernanceKey;
  permissions: readonly PlatformPermissionKey[];
}) {
  const visible = GOVERNANCE_WORKSPACES.filter((item) => permissions.includes(item.permission));
  const selected = visible.find((item) => item.key === current);
  if (!selected) return null;
  return (
    <section aria-label="Governance workspaces" className="rounded-2xl border border-[#dce2df] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">PLR4 · Governance workspaces</p>
          <p className="mt-1 text-sm text-[#52615b]">{selected.detail}</p>
        </div>
        <Link href="/platform" className="shrink-0 text-xs font-semibold text-[#1a5144] underline-offset-4 hover:underline">Torna al cockpit</Link>
      </div>
      <nav aria-label="Aree di governance autorizzate" className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {visible.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.key === current ? "page" : undefined}
            className={["inline-flex min-h-10 shrink-0 items-center rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144]",
              item.key === current ? "border-[#1a5144] bg-[#1a5144] text-white" : "border-[#d7dfdb] bg-[#f8faf9] text-[#43524c] hover:bg-[#e1ece8]"].join(" ")}
          >{item.title}</Link>
        ))}
      </nav>
    </section>
  );
}
