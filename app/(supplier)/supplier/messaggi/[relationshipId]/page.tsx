import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
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
    <div className="flex h-[calc(100vh-var(--chrome-top,80px))] lg:h-[calc(100vh-4rem)] min-h-0 overflow-hidden">
      {/* Sidebar: hidden on mobile (back button in ChatThread handles navigation) */}
      <div className="hidden lg:block">
        <ConversationList
          conversations={conversations}
          viewpoint="supplier"
          activeRelationshipId={relationshipId}
          baseHref="/supplier/messaggi"
        />
      </div>

      {/* Mobile: back bar to conversation list */}
      <div className="lg:hidden sticky top-0 z-20 flex items-center gap-2 border-b border-[color:var(--ios-separator)] bg-[color:var(--ios-chrome-bg)] px-2 py-2 [backdrop-filter:var(--ios-chrome-blur)] [-webkit-backdrop-filter:var(--ios-chrome-blur)]">
        <Link
          href="/supplier/messaggi"
          className="flex h-10 items-center gap-1 rounded-lg pr-2 text-[color:var(--color-brand-primary)] transition active:bg-[color:var(--color-brand-primary-subtle)]"
          aria-label="Torna a conversazioni"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path
              d="M10 3L5 8l5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[15px] font-normal">Messaggi</span>
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <div
            className="truncate font-serif text-[15px] font-medium text-[color:var(--color-text-primary)]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {context.restaurantName}
          </div>
        </div>
        <div className="w-[72px]" aria-hidden="true" />
      </div>

      <section className="flex-1 min-w-0 h-full min-h-0 flex flex-col">
        <ChatThread
          relationshipId={relationshipId}
          orderSplitId={null}
          currentUserId={user.id}
          viewpoint="supplier"
          counterpartyName={context.restaurantName}
          initialMessages={messages}
        />
      </section>

      {/* Context panel: desktop only */}
      <div className="hidden lg:block">
        <ContextPanel context={context} viewpoint="supplier" />
      </div>
    </div>
  );
}
