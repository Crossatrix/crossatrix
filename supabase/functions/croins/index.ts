import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAILS = [
  "cross.a.trix.owner@hotmail.com",
  "moritz.loeseke7@gmail.com",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Require authenticated caller
    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerId = claimsData.claims.sub as string;
    const callerEmail = (claimsData.claims.email as string | undefined)?.toLowerCase();
    const isAdmin = !!callerEmail && ADMIN_EMAILS.includes(callerEmail);

    const { action, user_id, amount, description } = await req.json();

    if (!user_id || !action) {
      return new Response(
        JSON.stringify({ error: "user_id and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only admins can act on other users' wallets.
    if (user_id !== callerId && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    if (action !== "credit" && action !== "debit" && action !== "set") {
      return new Response(
        JSON.stringify({ error: "action must be 'balance', 'credit', 'debit', or 'set'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only admins can credit, debit, or set balances.
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "set") {
      if (typeof amount !== "number" || amount < 0 || !Number.isFinite(amount)) {
        return new Response(
          JSON.stringify({ error: "amount must be a non-negative number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: w } = await supabase
        .from("wallets").select("balance").eq("user_id", user_id).maybeSingle();
      if (!w) {
        await supabase.from("wallets").insert({ user_id, balance: amount });
      } else {
        await supabase.from("wallets")
          .update({ balance: amount, updated_at: new Date().toISOString() })
          .eq("user_id", user_id);
      }
      await supabase.from("croin_transactions").insert({
        user_id, amount, type: "credit",
        description: description || `Admin set balance to ${amount}`,
      });
      return new Response(
        JSON.stringify({ user_id, action, new_balance: amount }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "amount must be a positive number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingWallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user_id)
      .maybeSingle();

    const currentBalance = existingWallet?.balance ?? 0;

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
