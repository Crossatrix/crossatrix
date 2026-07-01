import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Global site kill switch. When an admin disables the site, every edge function
// must behave as if it does not exist (HTTP 404). This is checked at the very
// top of each function before any other work is done.
export async function isSiteDisabled(): Promise<boolean> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await admin
      .from("site_settings")
      .select("disabled")
      .eq("id", 1)
      .maybeSingle();
    return !!data?.disabled;
  } catch {
    return false;
  }
}

export function siteDisabledResponse(cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
