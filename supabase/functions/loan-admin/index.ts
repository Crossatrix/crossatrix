import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSiteDisabled, siteDisabledResponse } from "../_shared/killswitch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAILS = ["cross.a.trix.owner@hotmail.com", "moritz.loeseke7@gmail.com"];

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

    const email = (claimsData.claims.email as string | undefined)?.toLowerCase();
    if (!email || !ADMIN_EMAILS.includes(email)) return json({ error: "Admin only" }, 403);

    const { action, appeal_id, user_id, reply, forgive } = await req.json();

    if (action === "list") {
      const { data: appeals } = await admin
        .from("loan_appeals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      const ids = [...new Set((appeals ?? []).map((a) => a.user_id))];
      const [{ data: loans }, { data: penalties }] = await Promise.all([
        ids.length
          ? admin.from("loans").select("*").in("user_id", ids)
          : Promise.resolve({ data: [] as unknown[] }),
        ids.length
          ? admin.from("loan_penalties").select("*").in("user_id", ids)
          : Promise.resolve({ data: [] as unknown[] }),
      ]);
      const { data: locks } = ids.length
        ? await admin.from("account_lockdowns").select("user_id, locked").in("user_id", ids)
        : { data: [] as unknown[] };

      return json({ appeals: appeals ?? [], loans: loans ?? [], penalties: penalties ?? [], locks: locks ?? [] });
    }

    if (action === "resolve") {
      if (!appeal_id) return json({ error: "appeal_id is required" }, 400);
      const { error } = await admin
        .from("loan_appeals")
        .update({ status: "resolved", admin_reply: reply ?? null, updated_at: new Date().toISOString() })
        .eq("id", appeal_id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "unlock") {
      if (!user_id) return json({ error: "user_id is required" }, 400);
      await admin
        .from("account_lockdowns")
        .update({ locked: false, updated_at: new Date().toISOString() })
        .eq("user_id", user_id);
      await admin.auth.admin.updateUserById(user_id, { ban_duration: "none" });
      await admin
        .from("loan_penalties")
        .update({
          lock_level: 0,
          misses: forgive ? 0 : 2,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user_id);
      return json({ success: true });
    }

    if (action === "reset_misses") {
      if (!user_id) return json({ error: "user_id is required" }, 400);
      await admin
        .from("loan_penalties")
        .update({ misses: 0, lock_level: 0, updated_at: new Date().toISOString() })
        .eq("user_id", user_id);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Loan admin error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
