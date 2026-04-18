import { NextResponse } from "next/server";
import { getMessagesForRelationship } from "@/lib/messages/queries";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const relationshipId = searchParams.get("relationshipId");
  const orderSplitId   = searchParams.get("orderSplitId");

  if (!relationshipId) {
    return NextResponse.json({ error: "relationshipId missing" }, { status: 400 });
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
