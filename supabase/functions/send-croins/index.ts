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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the sender using getClaims
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { authorization: authHeader } },
    });
    
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const senderId = claimsData.claims.sub as string;
    const senderEmail = claimsData.claims.email as string;

    const { recipient_email, amount } = await req.json();

    if (!recipient_email || typeof recipient_email !== "string") {
      return new Response(JSON.stringify({ error: "recipient_email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!amount || typeof amount !== "number" || amount <= 0 || !Number.isInteger(amount)) {
      return new Response(JSON.stringify({ error: "amount must be a positive integer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (recipient_email.toLowerCase() === senderEmail?.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Cannot send Croins to yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find recipient by email using admin API
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      return new Response(JSON.stringify({ error: "Failed to look up recipient" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipient = users.find(
      (u) => u.email?.toLowerCase() === recipient_email.toLowerCase()
    );

    if (!recipient) {
      return new Response(JSON.stringify({ error: "Recipient not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check sender balance
    const { data: senderWallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", senderId)
      .maybeSingle();

    const senderBalance = senderWallet?.balance ?? 0;

    if (senderBalance < amount) {
      return new Response(JSON.stringify({ error: "Insufficient balance", balance: senderBalance }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Debit sender
    await supabase
      .from("wallets")
      .update({ balance: senderBalance - amount, updated_at: new Date().toISOString() })
      .eq("user_id", senderId);

    // Credit recipient (ensure wallet exists)
    const { data: recipientWallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", recipient.id)
      .maybeSingle();

    if (recipientWallet) {
      await supabase
        .from("wallets")
        .update({ balance: recipientWallet.balance + amount, updated_at: new Date().toISOString() })
        .eq("user_id", recipient.id);
    } else {
      await supabase.from("wallets").insert({ user_id: recipient.id, balance: amount });
    }

    // Log transactions
    await supabase.from("croin_transactions").insert([
      {
        user_id: sender.id,
        amount,
        type: "debit",
        description: `Sent to ${recipient_email}`,
      },
      {
        user_id: recipient.id,
        amount,
        type: "credit",
        description: `Received from ${sender.email}`,
      },
    ]);

    return new Response(
      JSON.stringify({ success: true, amount, recipient: recipient_email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Send croins error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
