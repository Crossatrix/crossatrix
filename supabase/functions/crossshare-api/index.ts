import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Public external API to read/update a share and its categories.
//
// Share price:
//   GET  /crossshare-api?share=symbol&api-key=KEY              -> read current price + categories
//   GET  /crossshare-api?share=symbol&api-key=KEY&price=12.50  -> set price (ignored if share has categories)
//
// Categories (price is auto-calculated from categories: SUM(amount / threshold)):
//   .../crossshare-api?share=symbol&api-key=KEY&category=NAME&amount=10&threshold=5&color=%23ff0000
//        -> create or update the category NAME on that share
//   .../crossshare-api?share=symbol&api-key=KEY&category=NAME&delete=true
//        -> remove the category NAME from that share
//
// All params can also be sent in a JSON POST body. api-key may be sent as
// ?api-key= / ?api_key= or the x-api-key header.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const url = new URL(req.url);
  const apiKey = Deno.env.get("CROSSSHARE");
  if (!apiKey) return json({ error: "Server not configured" }, 500);

  const provided =
    url.searchParams.get("api-key") ||
    url.searchParams.get("api_key") ||
    req.headers.get("x-api-key") ||
    req.headers.get("X-Api-Key");
  if (provided !== apiKey) return json({ error: "Invalid api-key" }, 401);

  // Gather params from query string and optional JSON body.
  let share = url.searchParams.get("share");
  let priceStr = url.searchParams.get("price");
  let category = url.searchParams.get("category");
  let amountStr = url.searchParams.get("amount");
  let thresholdStr = url.searchParams.get("threshold");
  let color = url.searchParams.get("color");
  let del = url.searchParams.get("delete");

  if (req.method === "POST") {
    try {
      const body = await req.json();
      share = share ?? body?.share ?? null;
      if (body?.price !== undefined) priceStr = String(body.price);
      category = category ?? body?.category ?? null;
      if (body?.amount !== undefined) amountStr = String(body.amount);
      if (body?.threshold !== undefined) thresholdStr = String(body.threshold);
      color = color ?? body?.color ?? null;
      if (body?.delete !== undefined) del = String(body.delete);
    } catch { /* ignore */ }
  }

  if (!share || typeof share !== "string") return json({ error: "Missing share" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Resolve the share row.
  const { data: shareRow, error: shareErr } = await admin
    .from("shares")
    .select("id, symbol, name, price")
    .eq("symbol", share)
    .maybeSingle();
  if (shareErr) return json({ error: shareErr.message }, 400);
  if (!shareRow) return json({ error: "Share not found" }, 404);

  // ---------- Category operations ----------
  if (category && typeof category === "string") {
    const isDelete = del === "true" || del === "1" || del === "yes";

    if (isDelete) {
      const { error } = await admin
        .from("share_categories")
        .delete()
        .eq("share_id", shareRow.id)
        .eq("name", category);
      if (error) return json({ error: error.message }, 400);
    } else {
      // Find existing category (by name within this share).
      const { data: existing } = await admin
        .from("share_categories")
        .select("id")
        .eq("share_id", shareRow.id)
        .eq("name", category)
        .maybeSingle();

      const patch: Record<string, unknown> = {};
      if (amountStr !== null && amountStr !== undefined) {
        const a = Number(amountStr);
        if (!Number.isFinite(a) || a < 0) return json({ error: "Invalid amount" }, 400);
        patch.amount = a;
      }
      if (thresholdStr !== null && thresholdStr !== undefined) {
        const t = Number(thresholdStr);
        if (!Number.isFinite(t) || t <= 0) return json({ error: "Threshold must be > 0" }, 400);
        patch.threshold = t;
      }
      if (color) patch.color = color;

      if (existing) {
        if (Object.keys(patch).length === 0) return json({ error: "Nothing to update" }, 400);
        const { error } = await admin.from("share_categories").update(patch).eq("id", existing.id);
        if (error) return json({ error: error.message }, 400);
      } else {
        const { error } = await admin.from("share_categories").insert({
          share_id: shareRow.id,
          name: category,
          color: (patch.color as string) ?? "#22d3ee",
          amount: (patch.amount as number) ?? 0,
          threshold: (patch.threshold as number) ?? 1,
        });
        if (error) return json({ error: error.message }, 400);
      }
    }

    // Return the share with its updated categories (price was recomputed by trigger).
    const [{ data: updatedShare }, { data: cats }] = await Promise.all([
      admin.from("shares").select("symbol, name, price, updated_at").eq("id", shareRow.id).maybeSingle(),
      admin.from("share_categories").select("name, color, amount, threshold").eq("share_id", shareRow.id).order("created_at"),
    ]);
    return json({ ok: true, share: updatedShare, categories: cats ?? [] });
  }

  // ---------- Price set ----------
  if (priceStr !== null && priceStr !== "" && priceStr !== undefined) {
    const price = Number(priceStr);
    if (!Number.isFinite(price) || price < 0) return json({ error: "Invalid price" }, 400);
    const { data, error } = await admin
      .from("shares")
      .update({ price, updated_at: new Date().toISOString() })
      .eq("id", shareRow.id)
      .select("symbol, name, price")
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, share: data });
  }

  // ---------- Read ----------
  const { data: cats } = await admin
    .from("share_categories")
    .select("name, color, amount, threshold")
    .eq("share_id", shareRow.id)
    .order("created_at");
  return json({
    ok: true,
    share: { symbol: shareRow.symbol, name: shareRow.name, price: shareRow.price },
    categories: cats ?? [],
  });
});
