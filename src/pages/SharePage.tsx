import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SharePage() {
  const [params] = useSearchParams();
  const referrerId = params.get("user") || "";
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) navigate("/dashboard");
    });
  }, [navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referrerId) {
      toast.error("Invalid invite link");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;

      // Wait briefly for session, then call reward function
      const session = data.session;
      if (session) {
        const { error: fnErr } = await supabase.functions.invoke("referral-reward", {
          body: { referrer_id: referrerId },
        });
        if (fnErr) console.error(fnErr);
        else toast.success("Welcome! Your inviter received 100 ¢");
        navigate("/dashboard");
      } else {
        toast.success("Account created! Check your email to confirm.");
      }
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px]"
      >
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-2 w-2 rounded-full bg-primary glow-primary" />
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              You've been invited
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight-brand text-foreground">
            Join Crossatrix.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Create your account — your inviter will receive <span className="text-primary font-semibold">100 ¢</span> as a thank you.
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <Button type="submit" variant="signal" className="w-full" disabled={loading || !referrerId}>
            {loading ? "Creating..." : "Create Identity"}
          </Button>
          {!referrerId && (
            <p className="text-xs text-destructive text-center">Missing invite parameter.</p>
          )}
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm text-muted-foreground hover:text-primary transition-brand"
          >
            Already have an identity? Sign in
          </button>
        </div>
      </motion.div>
    </div>
  );
}
