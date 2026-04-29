import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { callSchool } from "@/lib/schoolApi";

export default function SchoolsAdminPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [funds, setFunds] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const r = await callSchool("list_schools");
      setSchools(r.schools || []);
    } catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  const approve = async (id: string, approved: boolean) => {
    await callSchool("approve_school", { school_id: id, approved });
    load();
  };
  const fund = async (id: string) => {
    const amt = Number(funds[id]);
    if (!amt) return;
    await callSchool("fund_pool", { school_id: id, amount: amt });
    setFunds({ ...funds, [id]: "" });
    load();
  };

  return (
    <div className="min-h-screen px-4 py-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight-brand">Schools</h1>
      {schools.map((s) => (
        <div key={s.id} className="p-4 rounded-lg border border-border bg-muted/10 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-muted-foreground">Pool: {s.pool_balance} ¢ • {s.approved ? "approved" : "pending"}</div>
            </div>
            <Button size="sm" variant={s.approved ? "outline" : "signal"} onClick={() => approve(s.id, !s.approved)}>
              {s.approved ? "Revoke" : "Approve"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input type="number" placeholder="Add to pool ¢" value={funds[s.id] || ""} onChange={(e) => setFunds({ ...funds, [s.id]: e.target.value })} />
            <Button onClick={() => fund(s.id)}>Fund</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
