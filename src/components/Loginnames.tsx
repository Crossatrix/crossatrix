import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Row = { id: string; name: string; slot_index: number };

export default function Loginnames() {
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("user_loginnames")
      .select("id,name,slot_index")
      .order("slot_index", { ascending: true });
    setRows((data as Row[]) || []);
  };

  useEffect(() => { load(); }, []);

  const nextCost = rows.length === 0 ? 0 : 50;
  const atMax = rows.length >= 5;

  const add = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/loginname-purchase`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      toast.success(nextCost > 0 ? `Added — ${nextCost}¢ deducted` : "Loginname added (free)");
      setName("");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("user_loginnames").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removed");
    load();
  };

  return (
    <section className="p-6 rounded-2xl border border-border bg-card shadow-vault space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Loginnames</h2>
        <span className="text-xs font-mono text-muted-foreground">{rows.length}/5</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Faster login: sign in with a loginname instead of your email. First one is free, each
        additional costs <span className="font-mono">50¢</span>.
      </p>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-border">
            <div>
              <p className="font-mono text-sm">{r.name}</p>
              <p className="text-xs text-muted-foreground">Slot {r.slot_index}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => del(r.id)}>Remove</Button>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No loginnames yet.</p>
        )}
      </div>

      {!atMax && (
        <div className="flex gap-2">
          <Input
            placeholder="new_loginname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
          <Button onClick={add} disabled={loading || !name.trim()}>
            {nextCost === 0 ? "Add (free)" : `Add · ${nextCost}¢`}
          </Button>
        </div>
      )}
    </section>
  );
}
