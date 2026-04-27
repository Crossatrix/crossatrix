import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimData, error: claimErr } = await userClient.auth.getClaims(token);
    if (claimErr || !claimData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = claimData.claims.sub as string;
    const body = await req.json().catch(() => ({}));
    const referrerId = body?.referrer_id as string | undefined;

    if (!referrerId || typeof referrerId !== "string") {
      return new Response(JSON.stringify({ error: "referrer_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (referrerId === newUserId) {
      return new Response(JSON.stringify({ error: "Cannot refer yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, service);

    // Check that referrer exists
    const { data: refWallet } = await admin
      .from("wallets")
      .select("user_id, balance")
      .eq("user_id", referrerId)
      .maybeSingle();

    // Check duplicate
    const { data: existing } = await admin
      .from("referrals")
      .select("id")
      .eq("referred_user_id", newUserId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Already referred" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reward = 100;

    const { error: insErr } = await admin.from("referrals").insert({
      referrer_id: referrerId,
      referred_user_id: newUserId,
      reward_amount: reward,
    });
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Credit referrer
    const currentBalance = refWallet?.balance ?? 0;
    if (!refWallet) {
      await admin.from("wallets").insert({ user_id: referrerId, balance: reward });
    } else {
      await admin
        .from("wallets")
        .update({ balance: currentBalance + reward, updated_at: new Date().toISOString() })
        .eq("user_id", referrerId);
    }

    await admin.from("croin_transactions").insert({
      user_id: referrerId,
      amount: reward,
      type: "credit",
      description: "Referral reward",
    });

    return new Response(JSON.stringify({ success: true, reward }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("referral-reward error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
