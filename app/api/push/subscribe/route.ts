import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SubscribePayload = {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  userAgent?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  let body: SubscribePayload;
  try {
    body = (await request.json()) as SubscribePayload;
  } catch {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const auth = body.subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Sottoscrizione mancante o incompleta (endpoint, p256dh, auth)" },
      { status: 400 }
    );
  }

  const { error } = await (supabase as unknown as {
    from: (t: string) => {
      upsert: (
        values: Record<string, unknown>,
        options?: { onConflict?: string }
      ) => Promise<{ error: { message: string } | null }>;
    };
  })
    .from("push_subscriptions")
    .upsert(
      {
        profile_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: body.userAgent ?? null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
