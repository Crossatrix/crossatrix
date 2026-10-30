import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useSiteEnabled } from "@/hooks/useSiteEnabled";

const ADMIN_EMAILS = [
  "cross.a.trix.owner@hotmail.com",
  "moritz.loeseke7@gmail.com",
];

// Pages reachable without having accepted the Terms of Service.
const TOS_EXEMPT = ["/", "/tos", "/reset-password"];

// Wraps the whole app. Handles the admin kill switch and forces signed-in
// users who haven't accepted the Terms of Service to /tos.
export default function SiteGate({ children }: { children: ReactNode }) {
  const { disabled, loading } = useSiteEnabled();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const tosAccepted = !!session?.user?.user_metadata?.tos_accepted_at;
  const needsTos = !!session && !tosAccepted && !TOS_EXEMPT.includes(location.pathname);

  useEffect(() => {
    if (!authLoading && needsTos) {
      navigate(`/tos?redirect=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
    }
  }, [authLoading, needsTos, location.pathname, location.search, navigate]);

  if (loading || authLoading) return null;

  const email = session?.user?.email?.toLowerCase() ?? null;
  const isAdmin = !!email && ADMIN_EMAILS.includes(email);

  if (disabled && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <p className="text-muted-foreground font-mono text-sm">An unknown error occurred.</p>
      </div>
    );
  }

  if (needsTos) return null;
  return <>{children}</>;
}
