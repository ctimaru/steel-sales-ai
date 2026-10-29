import type { Metadata } from "next";
import SchoolArticlesPage from "@/app/(public)/knowledge/articoli/page";
import { privateNoIndexRobots } from "@/lib/seo";

/** Authenticated School guide index reuses original published articles and sources. */
export const metadata: Metadata = {
  title: "Guide tecniche · Scuola",
  robots: privateNoIndexRobots,
};
export default function SchoolGuidesWorkspacePage() {
  return <SchoolArticlesPage />;
}
