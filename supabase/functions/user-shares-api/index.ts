import { createClient } from "npm:@supabase/supabase-js@2";
import { isSiteDisabled, siteDisabledResponse } from "../_shared/killswitch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Public, read-only API to list every share a user owns.
//   GET /user-shares-api?user=USER_ID
// Returns each owned share with its quantity (amount) and the price of one share.
// No API key required; the user id identifies whose holdings to read.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (await isSiteDisabled()) return siteDisabledResponse(corsHeaders);

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const url = new URL(req.url);
  let userId = url.searchParams.get("user") || url.searchParams.get("user_id");

  if (!userId && req.method === "POST") {
    try {
      const body = await req.json();
      userId = body?.user ?? body?.user_id ?? null;
    } catch { /* ignore */ }
  }

  if (!userId || typeof userId !== "string") {
    return json({ error: "Missing user id" }, 400);
  }
  // Basic UUID sanity check.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return json({ error: "Invalid user id" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await admin
    .from("share_holdings")
    .select("quantity, shares ( symbol, name, price )")
    .eq("user_id", userId)
    .gt("quantity", 0);

  if (error) return json({ error: error.message }, 400);

  const shares = (data ?? [])
    .filter((row: any) => row.shares)
    .map((row: any) => ({
      symbol: row.shares.symbol,
      name: row.shares.name,
      amount: row.quantity,
      price: Number(row.shares.price),
      total: Number(row.shares.price) * row.quantity,
    }));

  return json({ ok: true, user_id: userId, shares });
});
