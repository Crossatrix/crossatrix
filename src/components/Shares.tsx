import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Plus, Trash2, Save } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis } from "recharts";

const ADMIN = "cross.a.trix.owner@hotmail.com";

interface Share {
  id: string;
  symbol: string;
  name: string;
  price: number;
}

interface Holding {
  share_id: string;
  quantity: number;
}

interface PricePoint {
  share_id: string;
  price: number;
  created_at: string;
}

const chartConfig = { price: { label: "Price", color: "hsl(var(--primary))" } };

function ShareChart({ points }: { points: PricePoint[] }) {
  const data = [...points]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((p) => ({
      time: new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      price: Number(p.price),
    }));

  if (data.length < 2) {
    return (
      <div className="h-[120px] w-full flex items-center justify-center text-xs text-muted-foreground">
        Not enough data yet — chart updates as the price changes.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[120px] w-full">
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="sharePriceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} minTickGap={20} />
        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={36} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#sharePriceGrad)" />
      </AreaChart>
    </ChartContainer>
  );
}

export default function Shares({ userId, userEmail, onTrade }: { userId: string; userEmail?: string; onTrade?: () => void }) {
  const isAdmin = userEmail === ADMIN;
  const [shares, setShares] = useState<Share[]>([]);
  const [holdings, setHoldings] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<Record<string, PricePoint[]>>({});
  const [qty, setQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // admin
  const [newSymbol, setNewSymbol] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("1.00");
  const [editPrice, setEditPrice] = useState<Record<string, string>>({});

  const load = async () => {
    const [{ data: s }, { data: h }, { data: ph }] = await Promise.all([
      supabase.from("shares").select("id, symbol, name, price").order("symbol"),
      supabase.from("share_holdings").select("share_id, quantity").eq("user_id", userId),
      supabase
        .from("share_price_history")
        .select("share_id, price, created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);
    setShares((s as Share[]) ?? []);
    const map: Record<string, number> = {};
    for (const row of (h as Holding[]) ?? []) map[row.share_id] = row.quantity;
    setHoldings(map);
    const hist: Record<string, PricePoint[]> = {};
    for (const row of (ph as PricePoint[]) ?? []) {
      (hist[row.share_id] ??= []).push(row);
    }
    setHistory(hist);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("shares-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "shares" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "share_price_history" }, (payload) => {
        const p = payload.new as PricePoint;
        setHistory((prev) => ({
          ...prev,
          [p.share_id]: [p, ...(prev[p.share_id] ?? [])].slice(0, 200),
        }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const trade = async (share_id: string, type: "buy" | "sell") => {
    const n = parseInt(qty[share_id] || "0", 10);
    if (!n || n < 1) { toast.error("Enter a quantity"); return; }
    setBusy(share_id + type);
    const { data, error } = await supabase.functions.invoke("trade-share", {
      body: { share_id, quantity: n, type },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Trade failed");
      return;
    }
    toast.success(`${type === "buy" ? "Bought" : "Sold"} ${n} share(s)`);
    setQty((q) => ({ ...q, [share_id]: "" }));
    load();
    onTrade?.();
  };

  const addShare = async () => {
    const sym = newSymbol.trim().toLowerCase();
    const nm = newName.trim();
    const p = Number(newPrice);
    if (!sym || !nm || !Number.isFinite(p) || p < 0) { toast.error("Invalid fields"); return; }
    const { error } = await supabase.from("shares").insert({ symbol: sym, name: nm, price: p });
    if (error) { toast.error(error.message); return; }
    toast.success("Share added");
    setNewSymbol(""); setNewName(""); setNewPrice("1.00");
    load();
  };

  const updatePrice = async (id: string) => {
    const p = Number(editPrice[id]);
    if (!Number.isFinite(p) || p < 0) { toast.error("Invalid price"); return; }
    const { error } = await supabase.from("shares").update({ price: p }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Price updated");
    setEditPrice((e) => ({ ...e, [id]: "" }));
    load();
  };

  const removeShare = async (id: string) => {
    if (!confirm("Remove this share? All holdings will be deleted.")) return;
    const { error } = await supabase.from("shares").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Share removed");
    load();
  };

  return (
    <div className="mt-6 p-6 rounded-2xl border border-border bg-card shadow-vault space-y-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Shares</h3>
      </div>

      {shares.length === 0 && (
        <p className="text-sm text-muted-foreground">No shares listed yet.</p>
      )}

      <div className="space-y-3">
        {shares.map((s) => {
          const owned = holdings[s.id] ?? 0;
          const n = parseInt(qty[s.id] || "0", 10) || 0;
          const cost = Math.ceil(s.price * n);
          return (
            <div key={s.id} className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{s.name} <span className="text-xs text-muted-foreground font-mono">({s.symbol})</span></p>
                  <p className="text-xs text-muted-foreground">Worth: <span className="text-primary font-mono">¢{Number(s.price).toFixed(2)}</span> · You own: <span className="text-foreground">{owned}</span> / 1000</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  placeholder="Qty"
                  value={qty[s.id] ?? ""}
                  onChange={(e) => setQty((q) => ({ ...q, [s.id]: e.target.value }))}
                  className="h-9 w-24"
                />
                <Button size="sm" variant="signal" disabled={busy === s.id + "buy" || n < 1} onClick={() => trade(s.id, "buy")}>
                  Buy {n > 0 ? `(¢${cost})` : ""}
                </Button>
                <Button size="sm" variant="outline" disabled={busy === s.id + "sell" || n < 1 || n > owned} onClick={() => trade(s.id, "sell")}>
                  Sell {n > 0 ? `(¢${cost})` : ""}
                </Button>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder={`New price (now ${Number(s.price).toFixed(2)})`}
                    value={editPrice[s.id] ?? ""}
                    onChange={(e) => setEditPrice((p) => ({ ...p, [s.id]: e.target.value }))}
                    className="h-9 flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={() => updatePrice(s.id)}>
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => removeShare(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <div className="pt-4 border-t border-border space-y-2">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Add Share</p>
          <div className="flex flex-wrap gap-2">
            <Input placeholder="symbol" value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} className="h-9 w-32" />
            <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9 flex-1 min-w-[140px]" />
            <Input placeholder="Price" type="number" step="0.01" min={0} value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className="h-9 w-24" />
            <Button size="sm" variant="signal" onClick={addShare}><Plus className="h-4 w-4 mr-1" />Add</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            API: <code className="font-mono">/functions/v1/crossshare-api?share=SYMBOL&amp;api-key=KEY&amp;price=NEW</code>
          </p>
        </div>
      )}
    </div>
  );
}
