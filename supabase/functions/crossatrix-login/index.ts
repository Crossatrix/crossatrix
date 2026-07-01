// Alias of crossatrix-auth for ecosystem apps (Cross Chat, Crossi-AI, Crosssino)
// that historically call /functions/v1/crossatrix-login.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSiteDisabled, siteDisabledResponse } from "../_shared/killswitch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (await isSiteDisabled()) return siteDisabledResponse(corsHeaders);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error("Missing Supabase env vars", {
        hasUrl: !!supabaseUrl,
        hasAnon: !!anonKey,
        hasService: !!serviceKey,
      });
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, anonKey);

    // Account lockdown: refuse login for a locked account.
    const lockAdmin = createClient(supabaseUrl, serviceKey);
    const { data: lockList } = await lockAdmin.auth.admin.listUsers();
    const lockUser = lockList?.users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
    if (lockUser) {
      const { data: lockRow } = await lockAdmin
        .from("account_lockdowns")
        .select("locked")
        .eq("user_id", lockUser.id)
        .maybeSingle();
      if (lockRow?.locked) {
        return new Response(
          JSON.stringify({ error: "Account is locked", code: "account_locked" }),
          { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const [profileRes, walletRes, memberRes] = await Promise.all([
      authed.from("profiles").select("cross_chat_id, crossi_ai_id").eq("user_id", data.user.id).maybeSingle(),
      authed.from("wallets").select("balance").eq("user_id", data.user.id).maybeSingle(),
      admin.from("school_members").select("role, school_id, username").eq("user_id", data.user.id).maybeSingle(),
    ]);

    const role = memberRes.data?.role || null;

    return new Response(
      JSON.stringify({
        user: { id: data.user.id, email: data.user.email, created_at: data.user.created_at },
        cross_chat_id: profileRes.data?.cross_chat_id || null,
        crossi_ai_id: profileRes.data?.crossi_ai_id || null,
        croins_balance: walletRes.data?.balance ?? 0,
        is_student: role === "student",
        is_teacher: role === "teacher",
        is_principal: role === "principal",
        school_role: role,
        school_id: memberRes.data?.school_id || null,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("crossatrix-login error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
