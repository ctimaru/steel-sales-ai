"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type WorkspaceNavItem = {
  href: string;
  label: string;
};

function isSelected(pathname: string, href: string) {
  if (href === "/dashboard" || href === "/network") return pathname === href;
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
