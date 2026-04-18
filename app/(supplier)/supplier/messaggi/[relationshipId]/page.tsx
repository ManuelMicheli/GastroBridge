import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  listConversationsForCurrentUser,
  getMessagesForRelationship,
} from "@/lib/messages/queries";
import { markSectionSeen } from "@/lib/nav/section-seen";
import { loadPairContext } from "@/lib/messages/context";
import { ConversationList } from "@/components/shared/chat/ConversationList";
import { ChatThread } from "@/components/shared/chat/ChatThread";
import { ContextPanel } from "@/components/shared/chat/ContextPanel";

export const metadata: Metadata = { title: "Messaggi Fornitore" };

export default async function SupplierMessagesThreadPage({
  params,
}: {
  params: Promise<{ relationshipId: string }>;
}) {
  const { relationshipId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [conversations, context, messages] = await Promise.all([
    listConversationsForCurrentUser(),
    loadPairContext(relationshipId),
    getMessagesForRelationship(relationshipId, null),
  ]);

  if (!context) notFound();
  await markSectionSeen("supplier_messages");

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 overflow-hidden">
      <ConversationList
        conversations={conversations}
        viewpoint="supplier"
        activeRelationshipId={relationshipId}
        baseHref="/supplier/messaggi"
      />
      <section className="flex-1 min-w-0 h-full min-h-0">
        <ChatThread
          relationshipId={relationshipId}
          orderSplitId={null}
          currentUserId={user.id}
          viewpoint="supplier"
          counterpartyName={context.restaurantName}
          initialMessages={messages}
        />
      </section>
      <ContextPanel context={context} viewpoint="supplier" />
    </div>
  );
}
