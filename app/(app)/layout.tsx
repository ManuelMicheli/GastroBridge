import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { CartProvider } from "@/lib/hooks/useCart";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-screen bg-cream">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 p-4 sm:p-6 pb-20 lg:pb-6">
            {children}
          </main>
        </div>
        <MobileNav />
      </div>
    </CartProvider>
  );
}
