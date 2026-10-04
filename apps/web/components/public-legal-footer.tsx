"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const standalonePublicPrefixes = [
  "/login",
  "/register",
  "/azienda",
  "/privacy",
  "/cookies",
  "/terms",
  "/legal",
];

export function PublicLegalFooter() {
  const pathname = usePathname();

  if (!standalonePublicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) {
    return null;
  }

  return (
    <footer className="border-t border-[#dce2df] bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-[#66736e] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex flex-wrap gap-x-4 gap-y-2 font-semibold">
          <Link href="/privacy" className="hover:text-[#173f35]">Privacy</Link>
          <Link href="/cookies" className="hover:text-[#173f35]">Cookie & tracking</Link>
          <Link href="/terms" className="hover:text-[#173f35]">Termini d’uso</Link>
          <Link href="/legal" className="hover:text-[#173f35]">Informazioni legali</Link>
        </div>
        <span>Smart Steel Sales · Legal & Privacy Readiness WIP</span>
      </div>
    </footer>
  );
}
