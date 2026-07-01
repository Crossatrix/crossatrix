import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

const ADMIN_EMAILS = [
  "cross.a.trix.owner@hotmail.com",
  "moritz.loeseke7@gmail.com",
];

const TwoFactorSetup = lazy(() => import("@/components/TwoFactorSetup"));

type Method = "email" | "sms" | "file" | "face";

const METHODS: { v: Method; label: string; desc: string }[] = [
  { v: "email", label: "Email", desc: "Get codes by email (Mailjet)" },
  { v: "sms", label: "SMS", desc: "Get codes by text (seven.io)" },
  { v: "file", label: "Account File", desc: "Use Account.crossauth secret file" },
  { v: "face", label: "Face Scan", desc: "Recognize your face via camera" },
];

async function callFn(name: string, body: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Request failed");
  return d;
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [twofa, setTwofa] = useState<{ method: Method | null; enabled: boolean }>({ method: null, enabled: false });
  const [picker, setPicker] = useState<Method | null>(null);
  const [showLockdown, setShowLockdown] = useState(false);
  const [lkPassword, setLkPassword] = useState("");
  const [lkPasscode, setLkPasscode] = useState("");
  const [lkConfirm, setLkConfirm] = useState("");
  const [lkLoading, setLkLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [siteDisabled, setSiteDisabled] = useState(false);
  const [siteBusy, setSiteBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { navigate("/"); return; }
      setUser(session.user);
      loadTwofa(session.user.id);
      const admin = ADMIN_EMAILS.includes(session.user.email?.toLowerCase() ?? "");
      setIsAdmin(admin);
      if (admin) loadSite();
    });
  }, [navigate]);

  const loadTwofa = async (uid: string) => {
    const { data } = await supabase.from("user_2fa").select("method,enabled").eq("user_id", uid).maybeSingle();
    setTwofa({ method: (data?.method as Method) ?? null, enabled: !!data?.enabled });
  };

  const loadSite = async () => {
    const { data } = await supabase.from("site_settings").select("disabled").eq("id", 1).maybeSingle();
    setSiteDisabled(!!data?.disabled);
  };

  const toggleSite = async (next: boolean) => {
    setSiteBusy(true);
    const { error } = await supabase.from("site_settings").update({ disabled: next, updated_at: new Date().toISOString() }).eq("id", 1);
    setSiteBusy(false);
    if (error) { toast.error(error.message); return; }
    setSiteDisabled(next);
    toast.success(next ? "Site disabled for everyone" : "Site re-enabled");
  };


  const changePassword = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent to your email");
  };

  const disable2fa = async () => {
    try {
      await callFn("twofa-disable");
      toast.success("2-Step Authentication disabled");
      if (user) loadTwofa(user.id);
    } catch (e) { toast.error((e as Error).message); }
  };

  const enableLockdown = async () => {
    if (!lkPassword || lkPasscode.length < 4) {
      toast.error("Enter your password and a passcode of at least 4 characters");
      return;
    }
    if (lkPasscode !== lkConfirm) {
      toast.error("Passcodes do not match");
      return;
    }
    setLkLoading(true);
    try {
      await callFn("account-lockdown", { password: lkPassword, passcode: lkPasscode });
      toast.success("Account locked down. Signing out everywhere…");
      await supabase.auth.signOut();
      navigate("/");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLkLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 md:py-16">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>Back</Button>
        </div>

        <section className="p-6 rounded-2xl border border-border bg-card shadow-vault space-y-4">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Account</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-foreground">Change Password</p>
              <p className="text-xs text-muted-foreground">We'll email you a reset link</p>
            </div>
            <Button onClick={changePassword}>Send link</Button>
          </div>
        </section>

        <section className="p-6 rounded-2xl border border-border bg-card shadow-vault space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">2-Step Authentication</h2>
            <span className={`text-xs font-mono ${twofa.enabled ? "text-primary" : "text-muted-foreground"}`}>
              {twofa.enabled ? `ON · ${twofa.method}` : "OFF"}
            </span>
          </div>

          {twofa.enabled ? (
            <Button variant="destructive" className="w-full" onClick={disable2fa}>Disable 2-Step Authentication</Button>
          ) : (
            <div className="grid gap-3">
              {METHODS.map((m) => (
                <button key={m.v} onClick={() => setPicker(m.v)}
                  className="text-left p-4 rounded-xl border border-border hover:border-primary/40 transition-brand">
                  <p className="font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="p-6 rounded-2xl border border-destructive/40 bg-destructive/5 shadow-vault space-y-4">
          <div>
            <h2 className="text-sm font-mono uppercase tracking-widest text-destructive">Account Lockdown</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Instantly sign out everywhere, disable 2-Step Authentication, and block all Croin and login
              activity (the API returns <span className="font-mono">423 Locked</span>). Your account can only be
              unlocked again with the passcode you set below — keep it safe.
            </p>
          </div>

          {!showLockdown ? (
            <Button variant="destructive" className="w-full" onClick={() => setShowLockdown(true)}>
              Lock down my account
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="lk-password">Confirm password</Label>
                <Input
                  id="lk-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your account password"
                  value={lkPassword}
                  onChange={(e) => setLkPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lk-passcode">Unlock passcode</Label>
                <Input
                  id="lk-passcode"
                  type="password"
                  placeholder="Set a passcode (min 4 chars)"
                  value={lkPasscode}
                  onChange={(e) => setLkPasscode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lk-confirm">Confirm passcode</Label>
                <Input
                  id="lk-confirm"
                  type="password"
                  placeholder="Re-enter the passcode"
                  value={lkConfirm}
                  onChange={(e) => setLkConfirm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" disabled={lkLoading}
                  onClick={() => { setShowLockdown(false); setLkPassword(""); setLkPasscode(""); setLkConfirm(""); }}>
                  Cancel
                </Button>
                <Button variant="destructive" className="flex-1" disabled={lkLoading} onClick={enableLockdown}>
                  {lkLoading ? "Locking…" : "Confirm lockdown"}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>


      <Suspense fallback={null}>
        <TwoFactorSetup
          open={!!picker}
          method={picker}
          onClose={() => setPicker(null)}
          onEnabled={() => user && loadTwofa(user.id)}
        />
      </Suspense>
    </div>
  );
}
