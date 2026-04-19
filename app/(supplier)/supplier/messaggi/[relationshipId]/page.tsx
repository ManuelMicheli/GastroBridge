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

      {/* Mobile: WhatsApp-style back bar — arrow + avatar + name */}
      <div className="lg:hidden sticky top-0 z-20 flex items-center gap-2 border-b border-[color:var(--ios-separator)] bg-[color:var(--ios-chrome-bg)] px-1.5 py-2 [backdrop-filter:var(--ios-chrome-blur)] [-webkit-backdrop-filter:var(--ios-chrome-blur)]">
        <Link
          href="/supplier/messaggi"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--color-brand-primary)] transition active:bg-[color:var(--color-brand-primary-subtle)] shrink-0"
          aria-label="Torna a conversazioni"
        >
          <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden="true">
            <path
              d="M10 3L5 8l5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] text-white text-[13px] font-semibold shrink-0 shadow-sm"
          aria-hidden
        >
          {context.restaurantName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold leading-tight text-[color:var(--color-text-primary)]">
            {context.restaurantName}
          </div>
          <div className="truncate text-[11px] leading-tight text-[color:var(--color-text-tertiary,#8e8e93)]">
            Cliente
          </div>
        </div>
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
