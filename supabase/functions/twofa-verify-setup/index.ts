import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSiteDisabled, siteDisabledResponse } from "../_shared/killswitch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getAuthHeader(req: Request): string | null {
  for (const [k, v] of req.headers) if (k.toLowerCase() === "authorization") return v;
  return null;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (await isSiteDisabled()) return siteDisabledResponse(corsHeaders);
  try {
    const authHeader = getAuthHeader(req);
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;
    const { method, code, secret_key, face_descriptor, phone } = await req.json();
    if (!["email", "sms", "file", "face"].includes(method)) {
      return new Response(JSON.stringify({ error: "Invalid method" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (method === "email" || method === "sms" || method === "file") {
      const valueToHash = method === "file" ? secret_key : code;
      if (!valueToHash) return new Response(JSON.stringify({ error: "missing value" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const hash = await sha256Hex(String(valueToHash));
      const { data: ch } = await admin.from("user_2fa_challenges")
        .select("*").eq("user_id", userId).eq("method", method).eq("purpose", "setup")
        .eq("consumed", false).gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!ch || ch.code_hash !== hash) {
        return new Response(JSON.stringify({ error: "Invalid or expired" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await admin.from("user_2fa_challenges").update({ consumed: true }).eq("id", ch.id);
    } else {
      // face
      if (!Array.isArray(face_descriptor) || face_descriptor.length !== 128) {
        return new Response(JSON.stringify({ error: "Invalid face descriptor" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const upsertRow: Record<string, unknown> = { user_id: userId, method, enabled: true, updated_at: new Date().toISOString() };
    if (method === "sms") upsertRow.phone = phone ?? null;
    if (method === "file") upsertRow.secret_key = secret_key;
    if (method === "face") upsertRow.face_descriptor = face_descriptor;

    await admin.from("user_2fa").upsert(upsertRow, { onConflict: "user_id" });
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("twofa-verify-setup error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
