"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { appRoutes } from "@/lib/routes";

export type WorkspaceNavItem = {
  href: string;
  label: string;
};

export type WorkspaceNavGroup = {
  title: string;
  items: WorkspaceNavItem[];
  alertHref?: string;
};

type ProductSpace = "workspace" | "network" | "marketplace" | "knowledge";

function currentSpace(pathname: string): ProductSpace {
  if (pathname === appRoutes.network.directory || pathname.startsWith(appRoutes.network.directory + "/")) {
    return "network";
  }
  if (pathname === appRoutes.marketplace.home || pathname.startsWith(appRoutes.marketplace.home + "/")) {
    return "marketplace";
  }
  if (pathname === appRoutes.knowledge.home || pathname.startsWith(appRoutes.knowledge.home + "/")) {
    return "knowledge";
  }
  return "workspace";
}

function isSelected(pathname: string, href: string) {
  if (
    href === appRoutes.home ||
    href === appRoutes.network.directory ||
    href === appRoutes.marketplace.home ||
    href === appRoutes.knowledge.home
  ) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(href + "/");
}

export function WorkspaceNavSection({
  title,
  items,
  alertHref,
  alertActiveCount,
}: {
  title: string;
  items: WorkspaceNavItem[];
  alertHref?: string;
  alertActiveCount?: number;
}) {
  const pathname = usePathname();

  if (!items.length) return null;

  return (
    <div>
      <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9ba8b9]">
        {title}
      </p>
      <nav className="space-y-1">
        {items.map((item) => {
          const selected = isSelected(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={selected ? "page" : undefined}
              className={[
                "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                selected
                  ? "bg-[#eaf2ff] text-[#2f6fed] shadow-[inset_0_0_0_1px_#d7e5ff]"
                  : "text-[#5f7088] hover:bg-white hover:text-[#1e2b45]",
              ].join(" ")}
            >
              <span>{item.label}</span>
              {item.href === alertHref && (alertActiveCount ?? 0) > 0 ? (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200">
                  {alertActiveCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function WorkspaceHomeLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const selected = pathname === href;

  return (
    <Link
      href={href}
      aria-current={selected ? "page" : undefined}
      className={[
        "flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition",
        selected
          ? "bg-[#eaf2ff] text-[#2f6fed] shadow-[inset_0_0_0_1px_#d7e5ff]"
          : "text-[#5f7088] hover:bg-white hover:text-[#1e2b45]",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export function WorkspaceSpaceNavigation({
  workspaceGroups,
  networkItems,
  marketplaceItems,
  knowledgeItems,
  alertActiveCount,
  networkEnabled,
}: {
  workspaceGroups: WorkspaceNavGroup[];
  networkItems: WorkspaceNavItem[];
  marketplaceItems: WorkspaceNavItem[];
  knowledgeItems: WorkspaceNavItem[];
  alertActiveCount: number;
  networkEnabled: boolean;
}) {
  const pathname = usePathname();
  const space = currentSpace(pathname);

  const spaces = [
    {
      key: "workspace" as const,
      href: appRoutes.home,
      label: "Home Workspace",
      scope: "Privato",
      description: "Memoria e operatività aziendale",
    },
    ...(networkEnabled
      ? [
          {
            key: "network" as const,
            href: appRoutes.network.directory,
            label: "Network",
            scope: "Condiviso",
            description: "Aziende, profili e relazioni B2B",
          },
          {
            key: "marketplace" as const,
            href: appRoutes.marketplace.home,
            label: "Marketplace",
            scope: "Condiviso",
            description: "Domanda e opportunità di mercato",
          },
        ]
      : []),
    {
      key: "knowledge" as const,
      href: appRoutes.knowledge.home,
      label: "Knowledge",
      scope: "Condiviso",
      description: "Norme, pesi e riferimenti tecnici",
    },
  ];

  const contextItems =
    space === "network"
      ? networkItems
      : space === "marketplace"
        ? marketplaceItems
        : space === "knowledge"
          ? knowledgeItems
          : [];

  return (
    <div className="space-y-5">
      <div>
        <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9ba8b9]">
          Spazi
        </p>
        <nav className="space-y-1.5">
          {spaces.map((item) => {
            const selected = item.key === space;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={selected ? "page" : undefined}
                className={[
                  "block rounded-2xl border px-3.5 py-3 transition",
                  selected
                    ? "border-[#cfe0ff] bg-[#eaf2ff] shadow-[0_1px_2px_rgba(47,111,237,0.06)]"
                    : "border-transparent bg-transparent hover:border-[#e3eaf5] hover:bg-white",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={selected ? "text-sm font-semibold text-[#2f6fed]" : "text-sm font-semibold text-[#34445c]"}>
                    {item.label}
                  </span>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]",
                      item.scope === "Privato"
                        ? "bg-[#f2f5f9] text-[#64748b]"
                        : "bg-[#eef5ff] text-[#2f6fed]",
                    ].join(" ")}
                  >
                    {item.scope}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[#7e8da1]">{item.description}</p>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-[#e8eef7] pt-4">
        {space === "workspace" ? (
          <div className="space-y-5">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9ba8b9]">
              Workspace privato
            </p>
            {workspaceGroups.map((group) => (
              <WorkspaceNavSection
                key={group.title}
                title={group.title}
                items={group.items}
                alertHref={group.alertHref}
                alertActiveCount={alertActiveCount}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="px-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9ba8b9]">
                {space === "network" ? "Steel Network" : space === "marketplace" ? "Marketplace" : "Steel Knowledge"}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-[#8090a5]">
                {space === "network"
                  ? "Superficie condivisa tra organizzazioni."
                  : space === "marketplace"
                    ? "Superficie comune per domanda e opportunità."
                    : "Riferimenti tecnici comuni e riutilizzabili."}
              </p>
            </div>
            <WorkspaceNavSection title="Navigazione" items={contextItems} alertActiveCount={alertActiveCount} />
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkspaceHeaderContext({
  organizationName,
  roleLabel,
}: {
  organizationName: string;
  roleLabel: string;
}) {
  const pathname = usePathname();
  const space = currentSpace(pathname);

  if (space === "network") {
    return (
      <Link href={appRoutes.network.directory} className="min-w-0 shrink">
        <p className="truncate text-sm font-semibold text-[#1e2b45]">Steel Network</p>
        <p className="truncate text-xs text-[#7e8da1]">Spazio condiviso tra aziende</p>
      </Link>
    );
  }

  if (space === "marketplace") {
    return (
      <Link href={appRoutes.marketplace.home} className="min-w-0 shrink">
        <p className="truncate text-sm font-semibold text-[#1e2b45]">Marketplace</p>
        <p className="truncate text-xs text-[#7e8da1]">Spazio condiviso · domanda e opportunità</p>
      </Link>
    );
  }

  if (space === "knowledge") {
    return (
      <Link href={appRoutes.knowledge.home} className="min-w-0 shrink">
        <p className="truncate text-sm font-semibold text-[#1e2b45]">Steel Knowledge</p>
        <p className="truncate text-xs text-[#7e8da1]">Base tecnica condivisa</p>
      </Link>
    );
  }

  return (
    <Link href={appRoutes.home} className="min-w-0 shrink">
      <p className="truncate text-sm font-semibold text-[#1e2b45]">{organizationName}</p>
      <p className="truncate text-xs text-[#7e8da1]">Workspace privato · {roleLabel}</p>
    </Link>
  );
}

export function WorkspaceMobileSpaceTabs({ networkEnabled }: { networkEnabled: boolean }) {
  const pathname = usePathname();
  const space = currentSpace(pathname);
  const items = [
    { key: "workspace" as const, href: appRoutes.home, label: "Workspace" },
    ...(networkEnabled ? [{ key: "network" as const, href: appRoutes.network.directory, label: "Network" }] : []),
    ...(networkEnabled ? [{ key: "marketplace" as const, href: appRoutes.marketplace.home, label: "Market" }] : []),
    { key: "knowledge" as const, href: appRoutes.knowledge.home, label: "Knowledge" },
  ];

  return (
    <>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === space ? "page" : undefined}
          className={[
            "shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold",
            item.key === space
              ? "border-[#cfe0ff] bg-[#eaf2ff] text-[#2f6fed]"
              : "border-[#dbe5f1] bg-white text-[#40516a]",
          ].join(" ")}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}
