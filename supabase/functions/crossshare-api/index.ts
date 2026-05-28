import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Public external API to read/update share price.
//   GET  /crossshare-api?share=symbol&api-key=KEY              -> read current price
//   GET  /crossshare-api?share=symbol&api-key=KEY&price=12.50  -> set price
//   POST /crossshare-api  body: { share, price }  header: x-api-key or ?api-key=
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const apiKey = Deno.env.get("CROSSSHARE");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const provided =
    url.searchParams.get("api-key") ||
    url.searchParams.get("api_key") ||
    req.headers.get("x-api-key") ||
    req.headers.get("X-Api-Key");

  if (provided !== apiKey) {
    return new Response(JSON.stringify({ error: "Invalid api-key" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let share = url.searchParams.get("share");
  let priceStr = url.searchParams.get("price");

  if (req.method === "POST") {
    try {
      const body = await req.json();
      share = share ?? body?.share ?? null;
      if (body?.price !== undefined) priceStr = String(body.price);
    } catch { /* ignore */ }
  }

  if (!share || typeof share !== "string") {
    return new Response(JSON.stringify({ error: "Missing share" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (priceStr !== null && priceStr !== "") {
    const price = Number(priceStr);
    if (!Number.isFinite(price) || price < 0) {
      return new Response(JSON.stringify({ error: "Invalid price" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data, error } = await admin
      .from("shares")
      .update({ price, updated_at: new Date().toISOString() })
      .eq("symbol", share)
      .select("symbol, name, price")
      .maybeSingle();
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!data) {
      return new Response(JSON.stringify({ error: "Share not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, share: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await admin
    .from("shares")
    .select("symbol, name, price, updated_at")
    .eq("symbol", share)
    .maybeSingle();
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!data) {
    return new Response(JSON.stringify({ error: "Share not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true, share: data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
