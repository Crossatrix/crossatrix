import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "cross.a.trix.owner@hotmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is authenticated
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin
    if (user.email !== ADMIN_EMAIL) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: admin only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, magnitude } = await req.json();

    // Get latest price
    const { data: latest } = await supabase
      .from("croin_price_history")
      .select("price")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const currentPrice = Number(latest?.price ?? 1);

    // Use magnitude (0.01 to 1.00) if provided, otherwise random 0.01-0.05
    const change = typeof magnitude === "number" && magnitude > 0
      ? Math.round(magnitude * 100) / 100
      : Math.round((Math.random() * 4 + 1)) / 100;
    let newPrice: number;

    if (action === "up") {
      newPrice = Math.round((currentPrice + change) * 100) / 100;
    } else if (action === "down") {
      newPrice = Math.max(0.01, Math.round((currentPrice - change) * 100) / 100);
    } else {
      return new Response(
        JSON.stringify({ error: "action must be 'up' or 'down'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: insertError } = await supabase
      .from("croin_price_history")
      .insert({ price: newPrice, changed_by: user.id });

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to update price" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ previous_price: currentPrice, new_price: newPrice, action }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Croin price error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
