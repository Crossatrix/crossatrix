import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Validates an access_token (+ optional email match) and returns the user, or an error response payload.
export async function verifyAccessToken(
  token: string,
  email: string | undefined,
): Promise<{ user?: { id: string; email: string; created_at: string }; status?: number; error?: string; code?: string }> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let res;
  try {
    res = await admin.auth.getUser(token);
  } catch {
    return { status: 401, error: "Invalid or expired token", code: "invalid_token" };
  }
  const u = res?.data?.user;
  if (res?.error || !u?.email) return { status: 401, error: "Invalid or expired token", code: "invalid_token" };
  if (email && email.trim().toLowerCase() !== u.email.toLowerCase()) {
    return { status: 401, error: "Email does not match token", code: "email_mismatch" };
  }
  const { data: lock } = await admin.from("account_lockdowns").select("locked").eq("user_id", u.id).maybeSingle();
  if (lock?.locked) return { status: 423, error: "Account is locked", code: "account_locked" };
  const t = await tosError(u.user_metadata);
  if (t) return t;
  return { user: { id: u.id, email: u.email, created_at: u.created_at } };
}

// Terms of Service: same version hash as the web app (first 8 bytes of SHA-256 of the English terms).
let tosCache: { v: string; at: number } | null = null;
async function currentTosVersion(): Promise<string | null> {
  if (tosCache && Date.now() - tosCache.at < 5 * 60_000) return tosCache.v;
  try {
    const r = await fetch("https://raw.githubusercontent.com/Cross-a-trix/legal/main/tos.md");
    if (!r.ok) return tosCache?.v ?? null;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode((await r.text()).trim()));
    const v = Array.from(new Uint8Array(buf)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
    tosCache = { v, at: Date.now() };
    return v;
  } catch { return tosCache?.v ?? null; }
}

// Returns a 403 payload if the user hasn't accepted the current terms, otherwise null.
export async function tosError(meta: Record<string, unknown> | undefined) {
  const m = meta ?? {};
  const v = await currentTosVersion();
  if (!m.tos_accepted_at || (v && m.tos_version !== v)) {
    return { status: 403, error: "Terms of Service not accepted. Accept them at https://crossatrix.lovable.app/tos", code: "tos_not_accepted" };
  }
  return null;
}
