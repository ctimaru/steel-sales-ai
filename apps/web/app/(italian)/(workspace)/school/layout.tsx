import type { ReactNode } from "react";

import { SchoolVisitTracker } from "@/components/school-quick-access";

export default function SchoolLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SchoolVisitTracker />
      {children}
    </>
  );
}
