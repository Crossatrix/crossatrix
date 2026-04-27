import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper } from "lucide-react";

interface NewsPost {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

export default function NewsPage() {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "News — Crossatrix";
    supabase
      .from("news_posts")
      .select("id,title,body,created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPosts((data as NewsPost[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Newspaper className="h-5 w-5 text-primary" />
            <h1 className="text-3xl font-semibold tracking-tight-brand">News</h1>
          </div>
          <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest">
            Crossatrix Public Feed
          </p>
        </header>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
        ) : posts.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border text-center text-muted-foreground">
            <p className="text-sm">No news yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-xl border border-border bg-card shadow-vault"
              >
                <h2 className="text-base font-semibold text-foreground tracking-tight-brand mb-2">
                  {post.title}
                </h2>
                {post.body && (
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-3">
                    {post.body}
                  </p>
                )}
                <p className="text-xs font-mono text-muted-foreground">
                  {new Date(post.created_at).toLocaleString()}
                </p>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
