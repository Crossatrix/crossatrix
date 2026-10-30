import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const TOS_URL = "https://raw.githubusercontent.com/Cross-a-trix/legal/main/tos.md";

export default function TosPage() {
  const [md, setMd] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(TOS_URL, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      // Allow "#Heading" without a space to still render as a heading
      .then((t) => setMd(t.replace(/^(#{1,6})([^\s#])/gm, "$1 $2")))
      .catch(() => setError(true));
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  const accept = async () => {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { tos_accepted_at: new Date().toISOString() },
    });
    setSaving(false);
    if (!error) navigate(params.get("redirect") || "/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen px-4 py-10 flex justify-center">
      <div className="w-full max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Terms of Service</h1>
        <div className="rounded-lg border border-border bg-card p-6 max-h-[65vh] overflow-y-auto">
          {error ? (
            <p className="text-destructive">Could not load the Terms of Service.</p>
          ) : md === null ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <article className="prose prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
            </article>
          )}
        </div>
        {signedIn && (
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => navigate("/"))}>
              Decline & sign out
            </Button>
            <Button onClick={accept} disabled={saving || md === null}>
              {saving ? "Saving…" : "I accept"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
