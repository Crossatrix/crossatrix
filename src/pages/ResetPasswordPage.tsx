import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

const transition = { type: "spring" as const, duration: 0.4, bounce: 0 };

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => navigate("/dashboard"), 2000);
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
        <h1 className="text-2xl font-semibold tracking-tight-brand text-foreground mb-6">
          Set New Password
        </h1>

        {done ? (
          <p className="text-sm text-foreground">Password updated. Redirecting...</p>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="signal" className="w-full" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
