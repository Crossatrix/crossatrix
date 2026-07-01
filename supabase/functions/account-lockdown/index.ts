import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSiteDisabled, siteDisabledResponse } from "../_shared/killswitch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getAuthHeader(req: Request): string | null {
  for (const [k, v] of req.headers) if (k.toLowerCase() === "authorization") return v;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (await isSiteDisabled()) return siteDisabledResponse(corsHeaders);

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = getAuthHeader(req);
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Not authenticated" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Invalid token" }, 401);
    }
    const userId = claimsData.claims.sub as string;
    const email = claimsData.claims.email as string | undefined;

    const { password, passcode } = await req.json().catch(() => ({}));
    if (!password || typeof password !== "string") {
      return json({ error: "Password is required" }, 400);
    }
    if (!passcode || typeof passcode !== "string" || passcode.length < 4) {
      return json({ error: "A passcode of at least 4 characters is required" }, 400);
    }
    if (!email) {
      return json({ error: "Account has no email" }, 400);
    }

    // Verify the password by attempting a sign-in.
    const verifyClient = createClient(supabaseUrl, anonKey);
    const { error: pwError } = await verifyClient.auth.signInWithPassword({ email, password });
    if (pwError) {
      return json({ error: "Incorrect password" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Activate lockdown.
    const { error: upsertError } = await admin
      .from("account_lockdowns")
      .upsert(
        {
          user_id: userId,
          locked: true,
          passcode_hash: await sha256Hex(passcode),
          locked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (upsertError) {
      console.error("Lockdown upsert error:", upsertError);
      return json({ error: "Failed to activate lockdown" }, 500);
    }

    // Disable any 2-Step Authentication for this account.
    await admin.from("user_2fa").delete().eq("user_id", userId);
    await admin.from("user_2fa_challenges").delete().eq("user_id", userId);

    // Ban the user so all sessions are invalidated and no one can sign in.
    await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });

    return json({ ok: true, locked: true });
  } catch (err) {
    console.error("account-lockdown error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
