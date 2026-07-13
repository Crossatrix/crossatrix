import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSiteDisabled, siteDisabledResponse } from "../_shared/killswitch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Public, read-only API for the Crossatrix news feed.
// Returns the latest news posts and newspaper issues. No auth required.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (await isSiteDisabled()) return siteDisabledResponse(corsHeaders);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const limitParam = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const limit = Math.min(Math.max(isNaN(limitParam) ? 50 : limitParam, 1), 100);

    const [postsRes, issuesRes] = await Promise.all([
      supabase
        .from("news_posts")
        .select("id,title,body,created_at")
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("newspaper_issues")
        .select("id,title,content,cover_url,created_at")
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    if (postsRes.error || issuesRes.error) {
      return new Response(
        JSON.stringify({ error: "Failed to load news" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        news: postsRes.data ?? [],
        newspaper: issuesRes.data ?? [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("News API error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
