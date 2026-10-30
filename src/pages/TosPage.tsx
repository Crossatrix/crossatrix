import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TOS_LANGUAGES, fetchTos, currentTosVersion } from "@/lib/tos";

export default function TosPage() {
  const [md, setMd] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem("tos_lang") || "en");
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  useEffect(() => {
    localStorage.setItem("tos_lang", lang);
    setMd(null);
    setError(false);
    fetchTos(lang)
      // Allow "#Heading" without a space to still render as a heading
      .then((t) => setMd(t.replace(/^(#{1,6})([^\s#])/gm, "$1 $2")))
      .catch(() => setError(true));
  }, [lang]);

  const accept = async () => {
    setSaving(true);
    let version = "";
    try { version = await currentTosVersion(); } catch { /* keep empty */ }
    const { error } = await supabase.auth.updateUser({
      data: { tos_accepted_at: new Date().toISOString(), tos_version: version, tos_language: lang },
    });
    setSaving(false);
    if (!error) navigate(params.get("redirect") || "/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen px-4 py-10 flex justify-center">
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Terms of Service</h1>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
            aria-label="Language"
          >
            {TOS_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 max-h-[65vh] overflow-y-auto">
          {error ? (
            <p className="text-destructive">The Terms of Service aren't available in this language yet.</p>
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
