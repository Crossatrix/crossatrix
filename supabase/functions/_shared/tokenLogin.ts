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
  return { user: { id: u.id, email: u.email, created_at: u.created_at } };
}
