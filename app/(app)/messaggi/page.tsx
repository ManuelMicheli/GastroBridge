import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listConversationsForCurrentUser } from "@/lib/messages/queries";
import { markSectionSeen } from "@/lib/nav/section-seen";
import { ConversationList } from "@/components/shared/chat/ConversationList";
import { MessagesEmptyState } from "./_components/empty-state";

export const metadata: Metadata = { title: "Messaggi" };

export default async function MessagesIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const conversations = await listConversationsForCurrentUser();
  await markSectionSeen("restaurant_messages");

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 overflow-hidden">
      <ConversationList
        conversations={conversations}
        viewpoint="restaurant"
        activeRelationshipId={null}
        baseHref="/messaggi"
      />
      <MessagesEmptyState />
    </div>
  );
}
