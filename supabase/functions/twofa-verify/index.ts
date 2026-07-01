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

function distance(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
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
    const { code, secret_key, face_descriptor } = await req.json();

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cfg } = await admin.from("user_2fa").select("*").eq("user_id", userId).maybeSingle();
    if (!cfg?.enabled) {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (cfg.method === "email" || cfg.method === "sms") {
      if (!code) return new Response(JSON.stringify({ error: "missing code" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const hash = await sha256Hex(String(code));
      const { data: ch } = await admin.from("user_2fa_challenges")
        .select("*").eq("user_id", userId).eq("purpose", "login").eq("consumed", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!ch || ch.code_hash !== hash) {
        return new Response(JSON.stringify({ error: "Invalid code" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await admin.from("user_2fa_challenges").update({ consumed: true }).eq("id", ch.id);
    } else if (cfg.method === "file") {
      if (!secret_key || secret_key !== cfg.secret_key) {
        return new Response(JSON.stringify({ error: "Invalid account file" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else if (cfg.method === "face") {
      if (!Array.isArray(face_descriptor) || face_descriptor.length !== 128 || !Array.isArray(cfg.face_descriptor)) {
        return new Response(JSON.stringify({ error: "Invalid face data" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const d = distance(face_descriptor, cfg.face_descriptor as number[]);
      if (d > 0.5) {
        return new Response(JSON.stringify({ error: "Face does not match", distance: d }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("twofa-verify error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
