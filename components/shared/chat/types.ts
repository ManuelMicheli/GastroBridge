import type { PartnershipMessageRow, MessageRole } from "@/lib/messages/types";
import type { PairContext } from "@/lib/messages/context";
import type { ConversationSummary } from "@/lib/messages/queries";

export type ChatViewpoint = "restaurant" | "supplier";

export type ChatThreadProps = {
  relationshipId: string;
  orderSplitId?: string | null;
  currentUserId: string;
  viewpoint: ChatViewpoint;
  counterpartyName: string;
  initialMessages: PartnershipMessageRow[];
};

export type { PartnershipMessageRow, MessageRole, PairContext, ConversationSummary };
