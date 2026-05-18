import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CODE_RE = /^[a-z0-9]{4}-[a-z0-9]{4}--[a-z0-9]{4}-[a-z0-9]{4}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader =
      req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim().toLowerCase();
    if (!CODE_RE.test(code)) {
      return new Response(JSON.stringify({ error: "Invalid code format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: codeRow, error: codeErr } = await admin
      .from("croin_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (codeErr || !codeRow) {
      return new Response(JSON.stringify({ error: "Code not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!codeRow.active) {
      return new Response(JSON.stringify({ error: "Code inactive" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (codeRow.uses >= codeRow.max_uses) {
      return new Response(JSON.stringify({ error: "Code fully redeemed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: redErr } = await admin
      .from("croin_code_redemptions")
      .insert({ code_id: codeRow.id, user_id: userId, amount: codeRow.amount });
    if (redErr) {
      if (redErr.code === "23505") {
        return new Response(
          JSON.stringify({ error: "Already redeemed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw redErr;
    }

    const { error: incErr } = await admin
      .from("croin_codes")
      .update({ uses: codeRow.uses + 1 })
      .eq("id", codeRow.id);
    if (incErr) throw incErr;

    // Credit wallet
    const { data: wallet } = await admin
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();
    const newBal = (wallet?.balance ?? 0) + codeRow.amount;
    if (wallet) {
      await admin.from("wallets").update({ balance: newBal }).eq("user_id", userId);
    } else {
      await admin.from("wallets").insert({ user_id: userId, balance: newBal });
    }
    await admin.from("croin_transactions").insert({
      user_id: userId,
      amount: codeRow.amount,
      type: "credit",
      description: `Redeem code: ${code}`,
    });

    return new Response(
      JSON.stringify({ ok: true, amount: codeRow.amount, balance: newBal }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
