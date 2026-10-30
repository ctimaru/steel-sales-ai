"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import {
  commercialDirectorGroups,
  commercialDirectorLinkSelected,
} from "@/lib/commercial-director-navigation";
import { getWorkspaceNavigationContext } from "@/lib/workspace-information-architecture";

function DirectorMenuGroups({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const view = params.get("view");

  return (
    <div className="space-y-1.5" data-testid="commercial-director-groups">
      {commercialDirectorGroups.map((group, index) => {
        const active = group.items.some(item =>
          commercialDirectorLinkSelected(item.href, pathname, view)
        );
        return (
          <details
            key={group.key + ":" + pathname + ":" + (view ?? "")}
            open={undefined}
            defaultOpen={active || (!mobile && index < 2)}
            className="group rounded-xl border border-transparent open:border-[#e1ebe5] open:bg-[#f8fbf9]"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-bold text-[#25483b] hover:bg-[#edf5ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block">{group.label}</span>
                <span className="mt-0.5 block text-[10px] font-normal text-[#687d72]">{group.description}</span>
              </span>
              <span aria-hidden="true" className="shrink-0 text-sm text-[#547666] transition group-open:rotate-90">›</span>
            </summary>
            <div className="space-y-0.5 px-1.5 pb-2 pt-0.5">
              {group.items.map(item => {
                const current = commercialDirectorLinkSelected(item.href, pathname, view);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={[
                      "block min-h-9 rounded-md px-3 py-2 text-xs leading-5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]",
                      current
                        ? "bg-[#175640] font-bold text-white"
                        : "font-medium text-[#476458] hover:bg-[#eaf3ed] hover:text-[#123a2b]",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function CommercialDirectorNavigation({ mobile = false }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <details className="rounded-xl border border-[#cddfd2] bg-white shadow-sm xl:hidden"
        data-testid="commercial-director-mobile">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-[#173f35] [&::-webkit-details-marker]:hidden">
          <span>Sezioni Commerciale</span>
          <span aria-hidden="true" className="text-lg text-[#34664d]">☰</span>
        </summary>
        <nav aria-label="Menu Commerciale mobile" className="border-t border-[#e0e9e3] p-2.5">
          <DirectorMenuGroups mobile />
        </nav>
      </details>
    );
  }
  return (
    <aside data-testid="commercial-director-sidebar"
      className="hidden min-w-0 self-start xl:sticky xl:top-[80px] xl:block">
      <nav aria-label="Menu Commerciale" className="rounded-2xl border border-[#d7e5dc] bg-white px-2.5 py-3 shadow-[0_10px_30px_-27px_rgba(10,56,35,0.5)]">
        <div className="mb-2 border-b border-[#e4ece7] px-3 pb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#478068]">Smart Steel Sales</p>
          <h2 className="mt-1 text-sm font-bold tracking-tight text-[#173f35]">Direzione commerciale</h2>
        </div>
        <DirectorMenuGroups />
      </nav>
    </aside>
  );
}

/** Commercial is one workspace, including the existing private RFQ Hub.
 * The shell is navigation only: all routes and RLS gates remain unchanged.
 */
export function WorkspaceCommercialDirectorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (getWorkspaceNavigationContext(pathname).primary !== "commercial") {
    return <div className="mx-auto w-full max-w-[1216px]">{children}</div>;
  }
  return (
    <div data-testid="commercial-director-shell" className="min-w-0">
      <div className="mb-3 xl:hidden">
        <Suspense fallback={<div className="h-12 rounded-xl bg-white" />}>
          <CommercialDirectorNavigation mobile />
        </Suspense>
      </div>
      <div className="min-w-0 xl:grid xl:grid-cols-[214px_minmax(0,1fr)] xl:items-start xl:gap-5 2xl:grid-cols-[232px_minmax(0,1fr)]">
        <Suspense fallback={<div className="hidden xl:block" />}>
          <CommercialDirectorNavigation />
        </Suspense>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
