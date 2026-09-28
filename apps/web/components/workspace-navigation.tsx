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
      <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b9792]">
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
                  ? "bg-[#e1ece8] text-[#173f35] shadow-[inset_0_0_0_1px_#d9e8e2]"
                  : "text-[#5d6a65] hover:bg-white hover:text-[#1d2824]",
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
          ? "bg-[#e1ece8] text-[#173f35] shadow-[inset_0_0_0_1px_#d9e8e2]"
          : "text-[#5d6a65] hover:bg-white hover:text-[#1d2824]",
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
      scope: "Pubblico",
      description: "Norme, gradi, pesi e strumenti tecnici",
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
        <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b9792]">
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
                    ? "border-[#c7ddd5] bg-[#e1ece8] shadow-[0_1px_2px_rgba(23,63,53,0.07)]"
                    : "border-transparent bg-transparent hover:border-[#dce2df] hover:bg-white",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={selected ? "text-sm font-semibold text-[#173f35]" : "text-sm font-semibold text-[#3e4a45]"}>
                    {item.label}
                  </span>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]",
                      item.scope === "Privato"
                        ? "bg-[#ecefed] text-[#65716c]"
                        : "bg-[#edf5f2] text-[#173f35]",
                    ].join(" ")}
                  >
                    {item.scope}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[#78857f]">{item.description}</p>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-[#dfe5e2] pt-4">
        {space === "workspace" ? (
          <div className="space-y-5">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b9792]">
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
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b9792]">
                {space === "network" ? "Steel Network" : space === "marketplace" ? "Marketplace" : "Steel Knowledge"}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-[#78857f]">
                {space === "network"
                  ? "Superficie condivisa tra organizzazioni."
                  : space === "marketplace"
                    ? "Superficie comune per domanda e opportunità."
                    : "Base tecnica pubblica e indicizzabile."}
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
        <p className="truncate text-sm font-semibold text-[#1d2824]">Steel Network</p>
        <p className="truncate text-xs text-[#78857f]">Spazio condiviso tra aziende</p>
      </Link>
    );
  }

  if (space === "marketplace") {
    return (
      <Link href={appRoutes.marketplace.home} className="min-w-0 shrink">
        <p className="truncate text-sm font-semibold text-[#1d2824]">Marketplace</p>
        <p className="truncate text-xs text-[#78857f]">Spazio condiviso · domanda e opportunità</p>
      </Link>
    );
  }

  if (space === "knowledge") {
    return (
      <Link href={appRoutes.knowledge.home} className="min-w-0 shrink">
        <p className="truncate text-sm font-semibold text-[#1d2824]">Steel Knowledge</p>
        <p className="truncate text-xs text-[#78857f]">Base tecnica pubblica</p>
      </Link>
    );
  }

  return (
    <Link href={appRoutes.home} className="min-w-0 shrink">
      <p className="truncate text-sm font-semibold text-[#1d2824]">{organizationName}</p>
      <p className="truncate text-xs text-[#78857f]">Workspace privato · {roleLabel}</p>
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
              ? "border-[#c7ddd5] bg-[#e1ece8] text-[#173f35]"
              : "border-[#d7dfdb] bg-white text-[#43524c]",
          ].join(" ")}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}
