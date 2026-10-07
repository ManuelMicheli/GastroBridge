import type { Metadata } from "next";
import { AppearanceSettings } from "@/components/fernly/appearance-settings";

export const metadata: Metadata = { title: "Aspetto — Impostazioni" };

export default function SupplierAppearancePage() {
  return <AppearanceSettings />;
}
