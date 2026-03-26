import type { ReactNode } from "react";
import { SupplierSidebar } from "@/components/layout/supplier-sidebar";
import { TopBar } from "@/components/layout/topbar";

export default function SupplierLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-cream">
      <SupplierSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
