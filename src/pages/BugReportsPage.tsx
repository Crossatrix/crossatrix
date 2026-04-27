import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Bug, Trash2, Coins } from "lucide-react";
import type { User } from "@supabase/supabase-js";

const OWNER_EMAIL = "cross.a.trix.owner@hotmail.com";
const STATUSES = ["open", "in_progress", "fixed", "wontfix"] as const;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface BugReport {
  id: string;
  user_id: string;
  app: string;
  app_version: string;
  title: string;
  description: string;
  status: string;
  reward_amount: number;
  created_at: string;
}

export default function BugReportsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [rewardInputs, setRewardInputs] = useState<Record<string, string>>({});
  const [rewardingId, setRewardingId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("bug_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setReports((data as BugReport[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    document.title = "Bug Reports — Crossatrix";
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/");
        return;
      }
      setUser(session.user);
      load();
    });
  }, [navigate]);

  const isOwner = user?.email === OWNER_EMAIL;

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("bug_reports")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    toast.success("Status updated");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("bug_reports").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReports((prev) => prev.filter((r) => r.id !== id));
    toast.success("Deleted");
  };

  if (!user) return null;
  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Owner access only.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <header className="mb-8 flex items-center gap-2">
          <Bug className="h-5 w-5 text-primary" />
          <h1 className="text-3xl font-semibold tracking-tight-brand">Bug Reports</h1>
        </header>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
        ) : reports.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border text-center text-muted-foreground">
            <p className="text-sm">No reports yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <article
                key={r.id}
                className="p-5 rounded-xl border border-border bg-card shadow-vault"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold tracking-tight-brand truncate">
                      {r.title}
                    </h2>
                    <p className="text-xs font-mono text-muted-foreground mt-1">
                      {r.app}
                      {r.app_version ? ` · v${r.app_version}` : ""} ·{" "}
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(r.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {r.description && (
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-3">
                    {r.description}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Status
                  </span>
                  <Select
                    value={r.status}
                    onValueChange={(v) => updateStatus(r.id, v)}
                  >
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs font-mono text-muted-foreground ml-auto truncate">
                    {r.user_id.slice(0, 8)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
