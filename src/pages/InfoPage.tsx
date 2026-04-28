import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Pencil, Save, X } from "lucide-react";

const OWNER_EMAIL = "cross.a.trix.owner@hotmail.com";

const InfoPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [title, setTitle] = useState("About Crossatrix");
  const [content, setContent] = useState("");

  useEffect(() => {
    document.title = "Info — Crossatrix";
  }, []);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      setIsOwner(sess.session?.user?.email === OWNER_EMAIL);

      const { data, error } = await supabase
        .from("info_page")
        .select("*")
        .eq("slug", "main")
        .maybeSingle();

      if (error) {
        toast.error("Failed to load info");
      } else if (data) {
        setId(data.id);
        setTitle(data.title);
        setContent(data.content);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = { title, content, slug: "main", updated_by: (await supabase.auth.getUser()).data.user?.id };
    const { error } = id
      ? await supabase.from("info_page").update(payload).eq("id", id)
      : await supabase.from("info_page").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Saved");
      setEditing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Card className="p-8 bg-card border-border">
          {editing ? (
            <div className="space-y-4">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Content (Markdown allowed)"
                rows={20}
                className="font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  <X className="w-4 h-4 mr-2" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <article>
              <header className="flex items-start justify-between gap-4 mb-6">
                <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
                {isOwner && (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    <Pencil className="w-4 h-4 mr-2" /> Edit
                  </Button>
                )}
              </header>
              <div className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
                {content || "No information yet."}
              </div>
            </article>
          )}
        </Card>
      </div>
    </div>
  );
};

export default InfoPage;
