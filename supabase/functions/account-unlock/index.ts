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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { email, passcode } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string" || !passcode || typeof passcode !== "string") {
      return json({ error: "Email and passcode are required" }, 400);
    }

    // Look up the user by email.
    const { data: list, error: listError } = await admin.auth.admin.listUsers();
    if (listError) {
      return json({ error: "Lookup failed" }, 500);
    }
    const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      return json({ error: "Invalid email or passcode" }, 401);
    }

    const { data: lock } = await admin
      .from("account_lockdowns")
      .select("locked, passcode_hash")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!lock?.locked) {
      return json({ error: "Account is not locked" }, 400);
    }

    const hash = await sha256Hex(passcode);
    if (hash !== lock.passcode_hash) {
      return json({ error: "Invalid email or passcode" }, 401);
    }

    // Lift the lockdown.
    const { error: updError } = await admin
      .from("account_lockdowns")
      .update({ locked: false, passcode_hash: null, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (updError) {
      return json({ error: "Failed to unlock" }, 500);
    }

    // Remove the ban so the user can sign in again.
    await admin.auth.admin.updateUserById(user.id, { ban_duration: "none" });

    return json({ ok: true, locked: false });
  } catch (err) {
    console.error("account-unlock error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
