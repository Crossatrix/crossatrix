import { lazy, Suspense, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
const TwoFactorChallenge = lazy(() => import("@/components/TwoFactorChallenge"));

const transition = { type: "spring" as const, duration: 0.4, bounce: 0 };

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

const PasswordStrength = ({ password }: { password: string }) => {
  const getStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };

  const strength = getStrength(password);
  const labels = ["Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-destructive", "bg-yellow-500", "bg-primary/60", "bg-primary"];

  if (!password) return null;

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex gap-1 flex-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-0.5 flex-1 rounded-full transition-brand ${
              i < strength ? colors[strength - 1] : "bg-muted/30"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground font-mono">
        {labels[strength - 1] || ""}
      </span>
    </div>
  );
};

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const navigate = useNavigate();

  const [twofaMethod, setTwofaMethod] = useState<"email" | "sms" | "file" | "face" | null>(null);

  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockEmail, setUnlockEmail] = useState("");
  const [unlockCode, setUnlockCode] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockMsg, setUnlockMsg] = useState("");

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockMsg("");
    setUnlockLoading(true);
    try {
      await callFn("account-unlock", { email: unlockEmail, passcode: unlockCode });
      setUnlockMsg("Account unlocked. You can sign in again.");
      setUnlockCode("");
      setTimeout(() => { setUnlockOpen(false); setMode("login"); setEmail(unlockEmail); }, 1200);
    } catch (err: any) {
      setUnlockMsg(err.message || "Unlock failed");
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Check if 2FA required
        const r = await callFn("twofa-challenge");
        if (r.required) setTwofaMethod(r.method);
        else navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  if (twofaMethod) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-2 w-2 rounded-full bg-primary glow-primary animate-pulse" /></div>}>
        <TwoFactorChallenge
          method={twofaMethod}
          onSuccess={() => navigate("/dashboard")}
          onCancel={async () => { await supabase.auth.signOut(); setTwofaMethod(null); }}
        />
      </Suspense>
    );
  }

  if (unlockOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transition, duration: 0.6 }}
          className="w-full max-w-[400px]"
        >
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-2 w-2 rounded-full bg-destructive" />
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Account Locked
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight-brand text-foreground">
              Unlock your account.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Enter your email and the passcode you set when locking down your account.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <Input
              type="email"
              placeholder="Email address"
              value={unlockEmail}
              onChange={(e) => setUnlockEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Unlock passcode"
              value={unlockCode}
              onChange={(e) => setUnlockCode(e.target.value)}
              required
            />
            {unlockMsg && <p className="text-sm text-muted-foreground">{unlockMsg}</p>}
            <Button type="submit" variant="signal" className="w-full" disabled={unlockLoading}>
              {unlockLoading ? "Unlocking…" : "Unlock account"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => { setUnlockOpen(false); setUnlockMsg(""); }}
              className="text-sm text-muted-foreground hover:text-primary transition-brand"
            >
              Back to sign in
            </button>
          </div>
        </motion.div>
      </div>
    );
  }



  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, duration: 0.6 }}
        className="w-full max-w-[400px]"
      >
        {/* Brand */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-2 w-2 rounded-full bg-primary glow-primary" />
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Identity Nexus
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight-brand text-foreground">
            {mode === "signup"
              ? "Provision your Crossatrix Identity."
              : "Verify your Identity."}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {mode === "signup"
              ? "Create a unified credential for the Cross-A ecosystem."
              : "Authenticate to access your connected services."}
          </p>
        </div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          animate={shake ? { x: [0, -8, 8, -4, 4, 0] } : {}}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="space-y-4"
        >
          <div>
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            {mode === "signup" && <PasswordStrength password={password} />}
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-destructive"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <Button
            type="submit"
            variant="signal"
            className="w-full"
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : mode === "signup"
              ? "Create Identity"
              : "Authenticate"}
          </Button>
        </motion.form>

        {/* Toggle mode */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError("");
            }}
            className="text-sm text-muted-foreground hover:text-primary transition-brand"
          >
            {mode === "signup"
              ? "Already have an identity? Authenticate"
              : "Need an identity? Create one"}
          </button>
        </div>

        {mode === "login" && (
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={() => navigate("/trouble")}
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-brand"
            >
              Trouble signing in?
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-border space-y-2">
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            <button type="button" onClick={() => navigate("/school/new-school")} className="hover:text-primary transition-brand">Register a school</button>
            <span>•</span>
            <button type="button" onClick={() => navigate("/school/teacher")} className="hover:text-primary transition-brand">Teacher / Student login</button>
          </div>
          <p className="text-xs text-muted-foreground/50 font-mono text-center">
            crossatrix.identity.v1 • encrypted at rest
          </p>
        </div>
      </motion.div>
    </div>
  );
}
