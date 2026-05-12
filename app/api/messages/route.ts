import { NextResponse } from "next/server";
import { getMessagesForRelationship } from "@/lib/messages/queries";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  // Require an authenticated session — RLS already filters rows but we add
  // an explicit auth check so unauthenticated callers don't probe the API.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const relationshipId = searchParams.get("relationshipId");
  const orderSplitId   = searchParams.get("orderSplitId");

  if (!relationshipId || !UUID_RE.test(relationshipId)) {
    return NextResponse.json({ error: "Invalid relationshipId" }, { status: 400 });
  }
  if (orderSplitId !== null && !UUID_RE.test(orderSplitId)) {
    return NextResponse.json({ error: "Invalid orderSplitId" }, { status: 400 });
  }

  // RLS on partnership_messages ensures non-members get empty results.
  const messages = await getMessagesForRelationship(
    relationshipId,
    orderSplitId === null ? undefined : orderSplitId,
  );

  return NextResponse.json({ messages }, {
    headers: { "cache-control": "no-store" },
  });
}
