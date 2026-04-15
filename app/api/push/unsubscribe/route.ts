import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type UnsubscribePayload = { endpoint?: string };

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  let body: UnsubscribePayload;
  try {
    body = (await request.json()) as UnsubscribePayload;
  } catch {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  if (!body.endpoint) {
    return NextResponse.json({ error: "Endpoint mancante" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("profile_id", user.id)
    .eq("endpoint", body.endpoint);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
