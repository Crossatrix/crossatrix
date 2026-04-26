import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Newspaper, Send, Trash2 } from "lucide-react";

const OWNER_EMAIL = "cross.a.trix.owner@hotmail.com";

interface NewsPost {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

export default function News({ userEmail }: { userEmail?: string | null }) {
  const isOwner = userEmail === OWNER_EMAIL;
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("news_posts")
      .select("id,title,body,created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load news");
    setPosts((data as NewsPost[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handlePost = async () => {
    const t = title.trim();
    const b = body.trim();
    if (!t) {
      toast.error("Title is required");
      return;
    }
    if (t.length > 120) {
      toast.error("Title must be 120 characters or less");
      return;
    }
    if (b.length > 4000) {
      toast.error("Body must be 4000 characters or less");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSending(true);
    const { error } = await supabase.from("news_posts").insert({
      title: t,
      body: b,
      created_by: user.id,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("News posted");
    setTitle("");
    setBody("");
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("news_posts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== id));
    toast.success("Removed");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", duration: 0.4, bounce: 0 }}
      className="space-y-6"
    >
      {isOwner && (
        <div className="p-6 rounded-2xl border border-primary/30 bg-primary/5 shadow-vault space-y-4">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-mono uppercase tracking-widest text-primary">
              Post News
            </h3>
          </div>
          <Input
            placeholder="Headline"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="What's the news?"
            value={body}
            maxLength={4000}
            rows={4}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button
            variant="signal"
            className="w-full"
            onClick={handlePost}
            disabled={sending}
          >
            {sending ? "Posting…" : "Send to Everyone"}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
        ) : posts.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border text-center text-muted-foreground">
            <Newspaper className="h-6 w-6 mx-auto mb-2 opacity-60" />
            <p className="text-sm">No news yet.</p>
          </div>
        ) : (
          posts.map((post) => (
            <article
              key={post.id}
              className="p-5 rounded-xl border border-border bg-card shadow-vault"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h4 className="text-base font-semibold text-foreground tracking-tight-brand">
                  {post.title}
                </h4>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(post.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0 -mt-1 -mr-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {post.body && (
                <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-3">
                  {post.body}
                </p>
              )}
              <p className="text-xs font-mono text-muted-foreground">
                {new Date(post.created_at).toLocaleString()}
              </p>
            </article>
          ))
        )}
      </div>
    </motion.div>
  );
}
