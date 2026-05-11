import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authorize via user JWT
    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization");

    let authorized = false;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error } = await userClient.auth.getClaims(token);
      if (!error && data?.claims?.sub) authorized = true;
    }

    if (!authorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, user_id, amount, description } = await req.json();

    if (!user_id || !action) {
      return new Response(
        JSON.stringify({ error: "user_id and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET BALANCE
    if (action === "balance") {
      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user_id)
        .maybeSingle();

      return new Response(
        JSON.stringify({ user_id, balance: wallet?.balance ?? 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CREDIT or DEBIT
    if (action !== "credit" && action !== "debit") {
      return new Response(
        JSON.stringify({ error: "action must be 'balance', 'credit', or 'debit'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "amount must be a positive number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure wallet exists
    const { data: existingWallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user_id)
      .maybeSingle();

    let currentBalance = existingWallet?.balance ?? 0;

    if (!existingWallet) {
      await supabase.from("wallets").insert({ user_id, balance: 0 });
    }

    if (action === "debit" && currentBalance < amount) {
      return new Response(
        JSON.stringify({ error: "Insufficient Croins balance", balance: currentBalance }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newBalance = action === "credit" ? currentBalance + amount : currentBalance - amount;

    const { error: updateError } = await supabase
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", user_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update balance" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log transaction
    await supabase.from("croin_transactions").insert({
      user_id,
      amount,
      type: action,
      description: description || "",
    });

    return new Response(
      JSON.stringify({
        user_id,
        action,
        amount,
        previous_balance: currentBalance,
        new_balance: newBalance,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Croins error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
