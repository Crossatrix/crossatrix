import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const ADMIN_EMAILS = ["cross.a.trix.owner@hotmail.com", "moritz.loeseke7@gmail.com"];

type Appeal = { id: string; user_id: string; email: string | null; message: string; status: string; admin_reply: string | null; created_at: string };
type Loan = { id: string; user_id: string; remaining: number; overdue: number; status: string };
type Penalty = { user_id: string; misses: number; lock_level: number };
type Lock = { user_id: string; locked: boolean };

async function callAdmin(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/loan-admin`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Request failed");
  return d;
}

const fmt = (n: number) => `¢${Number(n).toLocaleString()}`;

export default function LoanAdminPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [locks, setLocks] = useState<Lock[]>([]);
  const [locked, setLocked] = useState<{ user_id: string; email: string | null; lock_level: number; misses: number; account_locked: boolean }[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await callAdmin({ action: "list" });
      setAppeals(d.appeals ?? []);
      setLoans(d.loans ?? []);
      setPenalties(d.penalties ?? []);
      setLocks(d.locks ?? []);
      setLocked(d.locked ?? []);
    } catch (e) { toast.error((e as Error).message); }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email?.toLowerCase() ?? "";
      if (!ADMIN_EMAILS.includes(email)) { navigate("/dashboard"); return; }
      setReady(true);
      load();
    });
  }, [navigate, load]);

  const act = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      await callAdmin(body);
      toast.success(ok);
      await load();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen px-4 py-8 md:py-16">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Loan Appeals</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>Back</Button>
        </div>

        <section className="p-6 rounded-2xl border border-border bg-card shadow-vault space-y-3">
          <h2 className="text-lg font-semibold">Locked accounts</h2>
          {locked.length === 0 && <p className="text-sm text-muted-foreground">No locked accounts.</p>}
          {locked.map((l) => (
            <div key={l.user_id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{l.email ?? l.user_id}</p>
                <p className="text-xs font-mono text-destructive">
                  {l.account_locked || l.lock_level >= 3 ? "ACCOUNT LOCKED" : l.lock_level >= 2 ? "CROINS LOCKED" : "WARNING"} · misses {l.misses}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="signal" disabled={busy}
                  onClick={() => act({ action: "unlock", user_id: l.user_id }, "Locks removed")}>
                  Remove lock
                </Button>
                <Button size="sm" variant="outline" disabled={busy}
                  onClick={() => act({ action: "unlock", user_id: l.user_id, forgive: true }, "Unlocked and forgiven")}>
                  + forgive
                </Button>
              </div>
            </div>
          ))}
        </section>

        <h2 className="text-lg font-semibold">Appeals</h2>
        {appeals.length === 0 && <p className="text-sm text-muted-foreground">No appeals yet.</p>}

        {appeals.map((a) => {
          const p = penalties.find((x) => x.user_id === a.user_id);
          const userLoans = loans.filter((l) => l.user_id === a.user_id && l.status === "active");
          const locked = locks.find((l) => l.user_id === a.user_id)?.locked;
          return (
            <section key={a.id} className="p-6 rounded-2xl border border-border bg-card shadow-vault space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.email ?? a.user_id}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {new Date(a.created_at).toLocaleString()} · {a.status}
                  </p>
                </div>
                <span className={`text-xs font-mono ${locked ? "text-destructive" : "text-muted-foreground"}`}>
                  {locked ? "LOCKED" : "OPEN"}
                </span>
              </div>

              <p className="text-sm whitespace-pre-wrap">{a.message}</p>

              <p className="text-xs text-muted-foreground">
                Misses: {p?.misses ?? 0} · Lock level: {p?.lock_level ?? 0} · Active loans: {userLoans.length} ·
                {" "}Owed {fmt(userLoans.reduce((s, l) => s + Number(l.remaining), 0))} ·
                {" "}Overdue {fmt(userLoans.reduce((s, l) => s + Number(l.overdue), 0))}
              </p>

              {a.admin_reply && (
                <p className="text-xs text-primary">Reply sent: {a.admin_reply}</p>
              )}

              <Textarea
                rows={3}
                placeholder="Reply to the user…"
                value={reply[a.id] ?? ""}
                onChange={(e) => setReply((r) => ({ ...r, [a.id]: e.target.value }))}
              />

              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy}
                  onClick={() => act({ action: "resolve", appeal_id: a.id, reply: reply[a.id] ?? null }, "Appeal resolved")}>
                  Resolve
                </Button>
                <Button size="sm" variant="signal" disabled={busy}
                  onClick={() => act({ action: "unlock", user_id: a.user_id }, "Account unlocked")}>
                  Unlock account
                </Button>
                <Button size="sm" variant="outline" disabled={busy}
                  onClick={() => act({ action: "unlock", user_id: a.user_id, forgive: true }, "Unlocked and forgiven")}>
                  Unlock + forgive
                </Button>
                <Button size="sm" variant="ghost" disabled={busy}
                  onClick={() => act({ action: "reset_misses", user_id: a.user_id }, "Misses reset")}>
                  Reset misses
                </Button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
