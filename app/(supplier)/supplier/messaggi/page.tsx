import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listConversationsForCurrentUser } from "@/lib/messages/queries";
import { markSectionSeen } from "@/lib/nav/section-seen";
import { ConversationList } from "@/components/shared/chat/ConversationList";
import { MessagesEmptyState } from "@/app/(app)/messaggi/_components/empty-state";

export const metadata: Metadata = { title: "Messaggi Fornitore" };

export default async function SupplierMessagesIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const conversations = await listConversationsForCurrentUser();
  await markSectionSeen("supplier_messages");

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 overflow-hidden">
      <ConversationList
        conversations={conversations}
        viewpoint="supplier"
        activeRelationshipId={null}
        baseHref="/supplier/messaggi"
      />
      <MessagesEmptyState />
    </div>
  );
}
