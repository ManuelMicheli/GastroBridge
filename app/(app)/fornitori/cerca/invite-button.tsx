"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Send } from "lucide-react";
import { inviteSupplier } from "@/lib/relationships/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { RelationshipStatusBadge } from "@/components/shared/relationship-status-badge";
import type { RelationshipStatus } from "@/lib/relationships/types";

type Props = {
  supplierId: string;
  existingStatus?: RelationshipStatus;
};

export function InviteSupplierButton({ supplierId, existingStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (existingStatus === "active") {
    return (
      <div className="flex items-center gap-2 text-sm text-forest">
        <Check className="h-4 w-4" />
        <span className="font-semibold">Già collegato</span>
      </div>
    );
  }

  if (existingStatus && existingStatus !== "rejected") {
    return <RelationshipStatusBadge status={existingStatus} />;
  }

  function onClick() {
    startTransition(async () => {
      const res = await inviteSupplier({ supplier_id: supplierId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Richiesta inviata al fornitore");
      router.refresh();
    });
  }

  return (
    <Button size="sm" onClick={onClick} isLoading={isPending}>
      <Send className="h-3.5 w-3.5" />
      {existingStatus === "rejected" ? "Rinvia richiesta" : "Invia richiesta"}
    </Button>
  );
}
