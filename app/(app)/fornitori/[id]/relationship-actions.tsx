"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PauseCircle, PlayCircle, Archive } from "lucide-react";
import {
  archiveRelationship,
  pauseRelationshipByRestaurant,
  resumeRelationshipByRestaurant,
} from "@/lib/relationships/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { RelationshipStatus } from "@/lib/relationships/types";

type Props = {
  relationshipId: string;
  status: RelationshipStatus;
};

export function RelationshipActions({ relationshipId, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, successMsg: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Errore");
        return;
      }
      toast.success(successMsg);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "active" && (
        <Button
          size="sm"
          variant="secondary"
          isLoading={isPending}
          onClick={() => run(() => pauseRelationshipByRestaurant(relationshipId), "Partnership in pausa")}
        >
          <PauseCircle className="h-4 w-4" /> Metti in pausa
        </Button>
      )}
      {status === "paused" && (
        <Button
          size="sm"
          isLoading={isPending}
          onClick={() => run(() => resumeRelationshipByRestaurant(relationshipId), "Partnership riattivata")}
        >
          <PlayCircle className="h-4 w-4" /> Riattiva
        </Button>
      )}
      {(status === "active" || status === "paused" || status === "pending" || status === "rejected") && (
        <Button
          size="sm"
          variant="ghost"
          isLoading={isPending}
          onClick={() => run(() => archiveRelationship(relationshipId), "Partnership archiviata")}
        >
          <Archive className="h-4 w-4" /> Archivia
        </Button>
      )}
    </div>
  );
}
