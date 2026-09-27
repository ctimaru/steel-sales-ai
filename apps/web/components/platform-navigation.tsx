"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const platformNav = [
  { href: "/platform", label: "Platform Home", icon: "home" },
  { href: "/platform/registrations", label: "Registrazioni aziende", icon: "registrations" },
  { href: "/platform/company-discovery", label: "Company Discovery", icon: "discovery" },
] as const;

function NavIcon({ name }: { name: (typeof platformNav)[number]["icon"] }) {
  if (name === "registrations") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M6 3.75h12A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75Z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    );
  }

  if (name === "discovery") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 20.25V8.5L12 4l8 4.5v11.75" />
        <path d="M8 20.25v-6h8v6M8 10h.01M12 10h.01M16 10h.01" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m3.75 10.5 8.25-6.75 8.25 6.75v8.25A1.5 1.5 0 0 1 18.75 20.25H5.25a1.5 1.5 0 0 1-1.5-1.5V10.5Z" />
      <path d="M9.25 20.25v-6.5h5.5v6.5" />
    </svg>
  );
}

export function PlatformNavigation() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {platformNav.map((item) => {
        const selected =
          item.href === "/platform"
            ? pathname === "/platform"
            : pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={[
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
              selected
                ? "bg-[#eaf2ff] text-[#2f6fed] shadow-[inset_0_0_0_1px_#d7e5ff]"
                : "text-[#53637a] hover:bg-white hover:text-[#1e2b45]",
            ].join(" ")}
          >
            <span className={selected ? "text-[#2f6fed]" : "text-[#7d8da4]"}>
              <NavIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
