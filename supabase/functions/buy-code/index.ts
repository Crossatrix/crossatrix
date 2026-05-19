import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CODE_RE = /^[a-z0-9]{4}-[a-z0-9]{4}--[a-z0-9]{4}-[a-z0-9]{4}$/i;

function randomCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const seg = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${seg(4)}-${seg(4)}--${seg(4)}-${seg(4)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const maxUses = Number(body.max_uses);
    let code = String(body.code || "").trim().toLowerCase();

    if (!Number.isInteger(amount) || amount < 1 || amount > 1000) {
      return new Response(
        JSON.stringify({ error: "Amount must be an integer between 1 and 1000" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) {
      return new Response(
        JSON.stringify({ error: "Max uses must be an integer between 1 and 100" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!code) {
      code = randomCode();
    } else if (!CODE_RE.test(code)) {
      return new Response(
        JSON.stringify({ error: "Invalid code format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Try the purchase; on code collision, retry with fresh random codes.
    let lastError: string | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data, error } = await admin.rpc("purchase_croin_code", {
        _buyer: userId,
        _code: code,
        _amount: amount,
        _max_uses: maxUses,
      });
      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        return new Response(JSON.stringify({ ok: true, ...row }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      lastError = error.message || "Purchase failed";
      if (/already exists/i.test(lastError) && !body.code) {
        code = randomCode();
        continue;
      }
      const status = /Insufficient|Invalid|between|format|already/i.test(lastError)
        ? 400
        : 500;
      return new Response(JSON.stringify({ error: lastError }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: lastError || "Purchase failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("buy-code error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
