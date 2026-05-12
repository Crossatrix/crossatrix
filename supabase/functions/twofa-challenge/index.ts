import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendEmail(to: string, code: string) {
  const key = Deno.env.get("MAILJET_KEY")!;
  const secret = Deno.env.get("MAILJET_SECRET")!;
  const auth = btoa(`${key}:${secret}`);
  const r = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      Messages: [{
        From: { Email: "no-reply@crossatrix.app", Name: "Crossatrix" },
        To: [{ Email: to }],
        Subject: "Your Crossatrix login code",
        TextPart: `Your login code is: ${code}\nExpires in 10 minutes.`,
        HTMLPart: `<p>Your login code:</p><h1 style="letter-spacing:6px">${code}</h1>`,
      }],
    }),
  });
  if (!r.ok) throw new Error(`Mailjet: ${await r.text()}`);
}

async function sendSms(to: string, code: string) {
  const key = Deno.env.get("SEVENOI_KEY")!;
  const r = await fetch("https://gateway.seven.io/api/sms", {
    method: "POST",
    headers: { "X-Api-Key": key, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ to, text: `Crossatrix code: ${code}`, from: "Crossatrix" }),
  });
  if (!r.ok) throw new Error(`seven.io: ${await r.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
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
    const userEmail = claimsData.claims.email as string;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cfg } = await admin.from("user_2fa").select("*").eq("user_id", userId).maybeSingle();
    if (!cfg?.enabled) {
      return new Response(JSON.stringify({ ok: true, required: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const method = cfg.method;
    if (method === "email" || method === "sms") {
      const code = randomCode();
      await admin.from("user_2fa_challenges").insert({
        user_id: userId, method, code_hash: await sha256Hex(code), purpose: "login",
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      if (method === "email") await sendEmail(userEmail, code);
      else await sendSms(cfg.phone, code);
    }
    return new Response(JSON.stringify({ ok: true, required: true, method }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("twofa-challenge error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
