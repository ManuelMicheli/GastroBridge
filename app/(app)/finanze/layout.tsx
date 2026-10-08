import type { ReactNode } from "react";
import { FinanzeNav } from "./_components/finanze-nav";

export default function FinanzeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <FinanzeNav />
      {children}
    </>
  );
}
