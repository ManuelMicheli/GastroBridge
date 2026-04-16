"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, PauseCircle, PlayCircle } from "lucide-react";
import {
  acceptInvitation,
  rejectInvitation,
  pauseRelationshipBySupplier,
  resumeRelationshipBySupplier,
} from "@/lib/relationships/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { RelationshipStatus } from "@/lib/relationships/types";

type Props = {
  relationshipId: string;
  status: RelationshipStatus;
};

export function ClientActions({ relationshipId, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Errore");
        return;
      }
      toast.success(msg);
      router.refresh();
    });
  }

  if (status === "pending") {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          isLoading={isPending}
          onClick={() => run(() => acceptInvitation(relationshipId), "Richiesta accettata")}
        >
          <Check className="h-4 w-4" /> Accetta
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isLoading={isPending}
          onClick={() => run(() => rejectInvitation(relationshipId), "Richiesta rifiutata")}
        >
          <X className="h-4 w-4" /> Rifiuta
        </Button>
      </div>
    );
  }

  if (status === "active") {
    return (
      <Button
        size="sm"
        variant="secondary"
        isLoading={isPending}
        onClick={() => run(() => pauseRelationshipBySupplier(relationshipId), "Cliente in pausa")}
      >
        <PauseCircle className="h-4 w-4" /> Metti in pausa
      </Button>
    );
  }

  if (status === "paused") {
    return (
      <Button
        size="sm"
        isLoading={isPending}
        onClick={() => run(() => resumeRelationshipBySupplier(relationshipId), "Cliente riattivato")}
      >
        <PlayCircle className="h-4 w-4" /> Riattiva
      </Button>
    );
  }

  return null;
}
