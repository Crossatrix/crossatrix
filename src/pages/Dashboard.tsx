import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";

const transition = { type: "spring", duration: 0.4, bounce: 0 };

const AppCard = ({
  name,
  domain,
  description,
  delay,
}: {
  name: string;
  domain: string;
  description: string;
  delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ ...transition, delay }}
    whileHover={{ y: -2 }}
    className="p-6 rounded-2xl border border-border bg-card shadow-vault"
  >
    <div className="flex items-center gap-3">
      <div className="h-2 w-2 rounded-full bg-primary glow-primary animate-pulse" />
      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        Available
      </span>
    </div>
    <h3 className="mt-4 text-xl font-semibold text-foreground">{name}</h3>
    <p className="text-sm text-muted-foreground mt-1">{description}</p>
    <p className="text-xs font-mono text-muted-foreground/60 mt-3">{domain}</p>
  </motion.div>
);

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) navigate("/");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) navigate("/");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-2 w-2 rounded-full bg-primary glow-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 md:py-16">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
          className="flex items-center justify-between mb-12"
        >
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-primary glow-primary" />
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Session Active
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
            Terminate Session
          </Button>
        </motion.div>

        {/* Identity Section */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Identity */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...transition, delay: 0.1 }}
          >
            <h1 className="text-3xl font-semibold tracking-tight-brand text-foreground mb-6">
              Command Center
            </h1>
            <div className="p-6 rounded-2xl border border-border bg-card shadow-vault">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Identity Details
              </h2>
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-muted-foreground">Email</span>
                  <p className="text-sm font-mono text-foreground mt-1">{user?.email}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">User ID</span>
                  <p className="text-xs font-mono text-muted-foreground/70 mt-1 break-all tabular-nums">
                    {user?.id}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Created</span>
                  <p className="text-sm font-mono text-foreground mt-1">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right: Connected Apps */}
          <div className="space-y-4">
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...transition, delay: 0.2 }}
              className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2"
            >
              Connected Services
            </motion.h2>
            <AppCard
              name="Cross-A Chat"
              domain="cross-a-chat.lovable.app"
              description="Real-time messaging • Authorized via API"
              delay={0.3}
            />
            <AppCard
              name="Cross-A AI"
              domain="cross-a-ai.lovable.app"
              description="AI assistant • Authorized via API"
              delay={0.4}
            />
          </div>
        </div>

        {/* API Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transition, delay: 0.5 }}
          className="mt-12 p-6 rounded-2xl border border-border bg-card shadow-vault"
        >
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
            API Endpoint
          </h2>
          <p className="text-xs font-mono text-muted-foreground/70 break-all tabular-nums">
            POST /functions/v1/crossatrix-auth — Verify credentials from external services
          </p>
        </motion.div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground/50 font-mono text-center">
            crossatrix.identity.v1 • encrypted at rest
          </p>
        </div>
      </div>
    </div>
  );
}
