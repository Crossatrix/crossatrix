import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteEnabled } from "@/hooks/useSiteEnabled";

const ADMIN_EMAILS = [
  "cross.a.trix.owner@hotmail.com",
  "moritz.loeseke7@gmail.com",
];

// Wraps the whole app. When an admin has disabled the site, every non-admin
// sees only a generic error and nothing else works. Admins pass through so they
// can re-enable the site from Settings.
export default function SiteGate({ children }: { children: ReactNode }) {
  const { disabled, loading } = useSiteEnabled();
  const [email, setEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email?.toLowerCase() ?? null);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email?.toLowerCase() ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading || authLoading) return null;

  const isAdmin = !!email && ADMIN_EMAILS.includes(email);

  if (disabled && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <p className="text-muted-foreground font-mono text-sm">An unknown error occurred.</p>
      </div>
    );
  }

  return <>{children}</>;
}
