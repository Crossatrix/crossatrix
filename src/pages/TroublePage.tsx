import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

const transition = { type: "spring", duration: 0.4, bounce: 0 };

export default function TroublePage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, duration: 0.6 }}
        className="w-full max-w-[400px]"
      >
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight-brand text-foreground">
            Trouble signing in?
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email and we'll send a password reset link.
          </p>
        </div>

        {sent ? (
          <div className="p-6 rounded-2xl border border-border bg-card">
            <p className="text-sm text-foreground">
              Reset link sent. Check your email.
            </p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="signal" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-6 text-sm text-muted-foreground hover:text-primary transition-brand block"
        >
          ← Back to authentication
        </button>
      </motion.div>
    </div>
  );
}
