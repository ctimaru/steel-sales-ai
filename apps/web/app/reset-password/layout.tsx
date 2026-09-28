import type { Metadata } from "next";
import type { ReactNode } from "react";

import { privateNoIndexRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Reset password",
  robots: privateNoIndexRobots,
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
