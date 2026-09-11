import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Loan = {
  id: string;
  principal: number;
  total_owed: number;
  remaining: number;
  overdue: number;
  schedule: "week" | "month";
  instalment: number;
  next_due_at: string;
  status: string;
};

type Status = {
  loans: Loan[];
  misses: number;
  lock_level: number;
  outstanding: number;
  overdue: number;
  active_count: number;
  max_debt: number;
};

async function callLoans(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/loans`, {
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
const when = (s: string) => new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

export default function Loans({ onChange }: { onChange?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [schedule, setSchedule] = useState<"week" | "month">("month");
  const [busy, setBusy] = useState(false);
  const [payAmt, setPayAmt] = useState<Record<string, string>>({});
  const [appeal, setAppeal] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await callLoans({ action: "status" });
      setStatus(d);
    } catch (e) {
      // A locked account still gets a friendly panel below.
      setStatus((s) => s ?? { loans: [], misses: 0, lock_level: 3, outstanding: 0, overdue: 0, active_count: 0, max_debt: 30000 });
      if ((e as Error).message !== "Account is locked") console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const take = async () => {
    const n = parseInt(amount, 10);
    if (!Number.isInteger(n) || n < 100) { toast.error("Enter at least 100 Croins"); return; }
    setBusy(true);
    try {
      const d = await callLoans({ action: "take", amount: n, schedule });
      toast.success(`Loan approved — you owe ${fmt(d.loan?.total_owed ?? 0)}`);
      setAmount("");
      await load();
      onChange?.();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const pay = async (loan: Loan) => {
    const raw = payAmt[loan.id];
    const n = raw ? parseInt(raw, 10) : Number(loan.instalment) + Number(loan.overdue);
    if (!Number.isInteger(n) || n < 1) { toast.error("Enter a valid amount"); return; }
    setBusy(true);
    try {
      await callLoans({ action: "pay", loan_id: loan.id, amount: n });
      toast.success(`Paid ${fmt(n)}`);
      setPayAmt((p) => ({ ...p, [loan.id]: "" }));
      await load();
      onChange?.();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const sendAppeal = async () => {
    if (appeal.trim().length < 5) { toast.error("Please describe your situation"); return; }
    setBusy(true);
    try {
      await callLoans({ action: "appeal", message: appeal });
      toast.success("Appeal sent to support");
      setAppeal("");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  if (loading) return null;

  const active = (status?.loans ?? []).filter((l) => l.status === "active");
  const lvl = status?.lock_level ?? 0;

  return (
    <section className="mt-6 p-6 rounded-2xl border border-border bg-card shadow-vault space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Loans</h2>
        <span className="text-xs font-mono text-muted-foreground">
          {fmt(status?.outstanding ?? 0)} owed · {active.length}/3
        </span>
      </div>

      {lvl > 0 && (
        <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/5 text-xs text-destructive space-y-1">
          <p className="font-medium">
            {lvl === 1 && "Warning: you missed a payment."}
            {lvl === 2 && "Croin transfers and the Croin API are locked until the overdue amount is paid."}
            {lvl >= 3 && "Your account is locked. Send an appeal to support below."}
          </p>
          <p>Missed payments: {status?.misses ?? 0} · Overdue: {fmt(status?.overdue ?? 0)}</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          {active.map((l) => (
            <div key={l.id} className="p-4 rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{fmt(l.remaining)} left</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {l.schedule === "week" ? "weekly 2%" : "monthly 5%"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Next {fmt(Number(l.instalment) + Number(l.overdue))} due {when(l.next_due_at)}
                {Number(l.overdue) > 0 && ` · ${fmt(l.overdue)} overdue`}
              </p>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  placeholder={`${Number(l.instalment) + Number(l.overdue)}`}
                  value={payAmt[l.id] ?? ""}
                  onChange={(e) => setPayAmt((p) => ({ ...p, [l.id]: e.target.value }))}
                />
                <Button variant="signal" disabled={busy} onClick={() => pay(l)}>Pay now</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lvl < 2 && (
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="loan-amount">Take a new loan</Label>
            <Input
              id="loan-amount"
              inputMode="numeric"
              placeholder="Amount (min 100)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {(["week", "month"] as const).map((s) => (
              <Button
                key={s}
                variant={schedule === s ? "signal" : "outline"}
                className="flex-1"
                onClick={() => setSchedule(s)}
              >
                {s === "week" ? "Weekly · 2%" : "Monthly · 5%"}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            A one-time 5% fee is added. Max 3 loans and {fmt(status?.max_debt ?? 30000)} total debt.
            {amount && ` You would owe ${fmt(Math.ceil(Number(amount) * 1.05) || 0)}.`}
          </p>
          <Button variant="signal" className="w-full" disabled={busy} onClick={take}>
            {busy ? "Working…" : "Borrow Croins"}
          </Button>
        </div>
      )}

      {lvl >= 3 && (
        <div className="space-y-2 pt-1">
          <Label htmlFor="loan-appeal">Contact support</Label>
          <Textarea
            id="loan-appeal"
            rows={4}
            placeholder="Explain your situation…"
            value={appeal}
            onChange={(e) => setAppeal(e.target.value)}
          />
          <Button className="w-full" disabled={busy} onClick={sendAppeal}>Send appeal</Button>
        </div>
      )}
    </section>
  );
}
