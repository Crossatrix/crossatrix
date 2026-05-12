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

function randomKey(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
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
        Subject: "Your Crossatrix verification code",
        TextPart: `Your verification code is: ${code}\n\nIt expires in 10 minutes.`,
        HTMLPart: `<p>Your verification code is:</p><h1 style="letter-spacing:6px">${code}</h1><p>Expires in 10 minutes.</p>`,
      }],
    }),
  });
  if (!r.ok) throw new Error(`Mailjet error: ${await r.text()}`);
}

async function sendSms(to: string, code: string) {
  const key = Deno.env.get("SEVENOI_KEY")!;
  const r = await fetch("https://gateway.seven.io/api/sms", {
    method: "POST",
    headers: { "X-Api-Key": key, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ to, text: `Crossatrix code: ${code} (10 min)`, from: "Crossatrix" }),
  });
  if (!r.ok) throw new Error(`seven.io error: ${await r.text()}`);
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

    const { method, phone } = await req.json();
    if (!["email", "sms", "file", "face"].includes(method)) {
      return new Response(JSON.stringify({ error: "Invalid method" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (method === "email" || method === "sms") {
      const code = randomCode();
      const codeHash = await sha256Hex(code);
      await admin.from("user_2fa_challenges").insert({
        user_id: userId, method, code_hash: codeHash, purpose: "setup",
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      if (method === "email") await sendEmail(userEmail, code);
      else {
        if (!phone) return new Response(JSON.stringify({ error: "phone required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await sendSms(phone, code);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "file") {
      const secretKey = randomKey();
      // store pending in challenges (used during verify-setup to confirm download)
      await admin.from("user_2fa_challenges").insert({
        user_id: userId, method: "file", code_hash: await sha256Hex(secretKey), purpose: "setup",
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
      return new Response(JSON.stringify({ ok: true, secret_key: secretKey, user_id: userId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // face: nothing to do; client will post descriptor to verify-setup
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("twofa-setup error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
