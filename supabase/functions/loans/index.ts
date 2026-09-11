import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSiteDisabled, siteDisabledResponse } from "../_shared/killswitch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (await isSiteDisabled()) return siteDisabledResponse(corsHeaders);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Not authenticated" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claimsData?.claims) return json({ error: "Invalid token" }, 401);

    const userId = claimsData.claims.sub as string;
    const email = (claimsData.claims.email as string | undefined) ?? null;

    const { action, amount, schedule, loan_id, message } = await req.json();

    // Appeals are the one action a locked account may still perform.
    if (action === "appeal") {
      if (!message || typeof message !== "string" || message.trim().length < 5) {
        return json({ error: "Please describe your situation" }, 400);
      }
      const { error } = await admin.from("loan_appeals").insert({
        user_id: userId,
        email,
        message: message.trim().slice(0, 4000),
      });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    const { data: lock } = await admin
      .from("account_lockdowns")
      .select("locked")
      .eq("user_id", userId)
      .maybeSingle();
    if (lock?.locked) return json({ error: "Account is locked", code: "account_locked" }, 423);

    // Always settle anything that has come due before answering.
    await admin.rpc("loan_sweep", { _user: userId });

    if (action === "take") {
      if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 10) {
        return json({ error: "amount must be a whole number of at least 10" }, 400);
      }
      if (schedule !== "week" && schedule !== "month") {
        return json({ error: "schedule must be 'week' or 'month'" }, 400);
      }
      const { data, error } = await admin.rpc("take_loan", {
        _user: userId,
        _amount: amount,
        _schedule: schedule,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, loan: Array.isArray(data) ? data[0] : data });
    }

    if (action === "pay") {
      if (!loan_id || typeof loan_id !== "string") return json({ error: "loan_id is required" }, 400);
      if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1) {
        return json({ error: "amount must be a positive whole number" }, 400);
      }
      const { data, error } = await admin.rpc("pay_loan", {
        _user: userId,
        _loan: loan_id,
        _amount: amount,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, loan: Array.isArray(data) ? data[0] : data });
    }

    // Default: status
    const [{ data: loans }, { data: penalty }, { data: appeals }] = await Promise.all([
      admin.from("loans").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      admin.from("loan_penalties").select("*").eq("user_id", userId).maybeSingle(),
      admin
        .from("loan_appeals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const active = (loans ?? []).filter((l) => l.status === "active");
    return json({
      loans: loans ?? [],
      appeals: appeals ?? [],
      misses: penalty?.misses ?? 0,
      lock_level: penalty?.lock_level ?? 0,
      outstanding: active.reduce((s, l) => s + Number(l.remaining), 0),
      overdue: active.reduce((s, l) => s + Number(l.overdue), 0),
      active_count: active.length,
      max_debt: 30000,
    });
  } catch (err) {
    console.error("Loans error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
