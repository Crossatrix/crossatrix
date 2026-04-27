import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper as NewspaperIcon, Megaphone } from "lucide-react";
import { renderContent } from "@/lib/newspaperRender";

interface NewsPost {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

interface Issue {
  id: string;
  title: string;
  content: string;
  cover_url: string | null;
  created_at: string;
}

export default function NewsPage() {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "News — Crossatrix";
    Promise.all([
      supabase
        .from("news_posts")
        .select("id,title,body,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("newspaper_issues")
        .select("id,title,content,cover_url,created_at")
        .order("created_at", { ascending: false }),
    ]).then(([n, p]) => {
      setPosts((n.data as NewsPost[]) ?? []);
      setIssues((p.data as Issue[]) ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-12">
        <header>
          <div className="flex items-center gap-2 mb-2">
            <NewspaperIcon className="h-5 w-5 text-primary" />
            <h1 className="text-3xl font-semibold tracking-tight-brand">News</h1>
          </div>
          <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest">
            Crossatrix Public Feed
          </p>
        </header>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-mono uppercase tracking-widest text-primary">
                  Latest News
                </h2>
              </div>
              {posts.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-border text-center text-muted-foreground">
                  <p className="text-sm">No news yet.</p>
                </div>
              ) : (
                posts.map((post) => (
                  <motion.article
                    key={post.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-xl border border-border bg-card shadow-vault"
                  >
                    <h3 className="text-base font-semibold tracking-tight-brand mb-2">
                      {post.title}
                    </h3>
                    {post.body && (
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-3">
                        {post.body}
                      </p>
                    )}
                    <p className="text-xs font-mono text-muted-foreground">
                      {new Date(post.created_at).toLocaleString()}
                    </p>
                  </motion.article>
                ))
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <NewspaperIcon className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-mono uppercase tracking-widest text-primary">
                  Crossatrix Newspaper
                </h2>
              </div>
              {issues.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-border text-center text-muted-foreground">
                  <p className="text-sm">No issues yet.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {issues.map((issue) => (
                    <article
                      key={issue.id}
                      className="rounded-2xl border border-border bg-card overflow-hidden shadow-vault"
                    >
                      {issue.cover_url && (
                        <img
                          src={issue.cover_url}
                          alt=""
                          className="w-full max-h-64 object-cover border-b border-border"
                        />
                      )}
                      <div className="p-5">
                        <h3 className="text-xl font-semibold text-foreground tracking-tight-brand mb-2">
                          {issue.title}
                        </h3>
                        <p className="text-xs font-mono text-muted-foreground mb-3">
                          {new Date(issue.created_at).toLocaleString()}
                        </p>
                        <div className="text-sm text-foreground leading-relaxed">
                          {renderContent(issue.content)}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
