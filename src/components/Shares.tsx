import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Plus, Trash2, Save, Tag } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { readCache, writeCache, useRefreshSignal } from "@/lib/dataCache";

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

interface Category {
  id: string;
  share_id: string;
  name: string;
  color: string;
  amount: number;
  threshold: number;
}

const chartConfig = { price: { label: "Price", color: "hsl(var(--primary))" } };

function ShareChart({ points, cats }: { points: PricePoint[]; cats: Category[] }) {
  const contrib = (c: Category) => (c.threshold > 0 ? c.amount / c.threshold : 0);

  const data = [...points]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((p) => {
      const row: Record<string, number | string> = {
        time: new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        price: Number(p.price),
      };
      for (const c of cats) row[`cat_${c.id}`] = contrib(c);
      return row;
    });

  if (data.length < 2) {
    return (
      <div className="h-[120px] w-full flex items-center justify-center text-xs text-muted-foreground">
        Not enough data yet — chart updates as the price changes.
      </div>
    );
  }

  const cfg: typeof chartConfig & Record<string, { label: string; color: string }> = { ...chartConfig };
  for (const c of cats) cfg[`cat_${c.id}`] = { label: c.name, color: c.color };

  return (
    <ChartContainer config={cfg} className="h-[120px] w-full">
      <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
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
        {cats.map((c) => (
          <Line
            key={c.id}
            type="monotone"
            dataKey={`cat_${c.id}`}
            stroke={c.color}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </ComposedChart>
    </ChartContainer>
  );
}

export default function Shares({ userId, userEmail, onTrade }: { userId: string; userEmail?: string; onTrade?: () => void }) {
  const isAdmin = userEmail === ADMIN;
  const [shares, setShares] = useState<Share[]>([]);
  const [holdings, setHoldings] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<Record<string, PricePoint[]>>({});
  const [categories, setCategories] = useState<Record<string, Category[]>>({});
  const [croinPrice, setCroinPrice] = useState<number>(1);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // admin: add share
  const [newSymbol, setNewSymbol] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("1.00");
  const [editPrice, setEditPrice] = useState<Record<string, string>>({});

  // admin: add category (per share)
  const [catName, setCatName] = useState<Record<string, string>>({});
  const [catColor, setCatColor] = useState<Record<string, string>>({});
  const [catAmount, setCatAmount] = useState<Record<string, string>>({});
  const [catThreshold, setCatThreshold] = useState<Record<string, string>>({});

  const load = async () => {
    const [{ data: s }, { data: h }, { data: ph }, { data: cats }, { data: cp }] = await Promise.all([
      supabase.from("shares").select("id, symbol, name, price").order("symbol"),
      supabase.from("share_holdings").select("share_id, quantity").eq("user_id", userId),
      supabase
        .from("share_price_history")
        .select("share_id, price, created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("share_categories").select("id, share_id, name, color, amount, threshold").order("created_at"),
      supabase.from("croin_price_history").select("price").order("created_at", { ascending: false }).limit(1),
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
    const catMap: Record<string, Category[]> = {};
    for (const row of (cats as Category[]) ?? []) {
      (catMap[row.share_id] ??= []).push(row);
    }
    setCategories(catMap);
    if (cp && cp[0]) setCroinPrice(Number((cp[0] as { price: number }).price) || 1);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("shares-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "shares" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "share_categories" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "croin_price_history" }, (payload) => {
        const p = payload.new as { price: number };
        setCroinPrice(Number(p.price) || 1);
      })
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

  // Effective cost = base price × croin price (rounded up), per unit.
  const effUnit = (price: number) => price * croinPrice;

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

  const addCategory = async (share_id: string) => {
    const nm = (catName[share_id] || "").trim();
    const color = (catColor[share_id] || "#22d3ee").trim();
    const amount = Number(catAmount[share_id] ?? "0");
    const threshold = Number(catThreshold[share_id] ?? "1");
    if (!nm) { toast.error("Category name required"); return; }
    if (!Number.isFinite(amount) || amount < 0) { toast.error("Invalid amount"); return; }
    if (!Number.isFinite(threshold) || threshold <= 0) { toast.error("Threshold must be > 0"); return; }
    const { error } = await supabase.from("share_categories").insert({ share_id, name: nm, color, amount, threshold });
    if (error) { toast.error(error.message); return; }
    toast.success("Category added");
    setCatName((s) => ({ ...s, [share_id]: "" }));
    setCatColor((s) => ({ ...s, [share_id]: "#22d3ee" }));
    setCatAmount((s) => ({ ...s, [share_id]: "" }));
    setCatThreshold((s) => ({ ...s, [share_id]: "" }));
    load();
  };

  const updateCategory = async (cat: Category, patch: Partial<Category>) => {
    const { error } = await supabase.from("share_categories").update(patch).eq("id", cat.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const removeCategory = async (id: string) => {
    const { error } = await supabase.from("share_categories").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <div className="mt-6 p-6 rounded-2xl border border-border bg-card shadow-vault space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Shares</h3>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          Croin price: <span className="text-primary">¢{croinPrice.toFixed(2)}</span>
        </span>
      </div>

      {shares.length === 0 && (
        <p className="text-sm text-muted-foreground">No shares listed yet.</p>
      )}

      <div className="space-y-3">
        {shares.map((s) => {
          const owned = holdings[s.id] ?? 0;
          const n = parseInt(qty[s.id] || "0", 10) || 0;
          const cost = Math.ceil(effUnit(s.price) * n);
          const points = history[s.id] ?? [];
          const cats = categories[s.id] ?? [];
          const sorted = [...points].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const prev = sorted.length > 1 ? Number(sorted[sorted.length - 2].price) : s.price;
          const change = s.price - prev;
          const up = change >= 0;
          return (
            <div key={s.id} className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{s.name} <span className="text-xs text-muted-foreground font-mono">({s.symbol})</span></p>
                  <p className="text-xs text-muted-foreground">
                    Worth: <span className="text-primary font-mono">¢{Number(s.price).toFixed(2)}</span>
                    <span className={`ml-2 font-mono inline-flex items-center gap-0.5 ${up ? "text-green-400" : "text-red-400"}`}>
                      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {up ? "+" : ""}{change.toFixed(2)}
                    </span>
                    · You own: <span className="text-foreground">{owned}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Trade price: <span className="text-foreground font-mono">¢{effUnit(s.price).toFixed(2)}</span> each
                    <span className="ml-1 opacity-70">(worth × croin price)</span>
                  </p>
                </div>
              </div>

              {cats.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {cats.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono border"
                      style={{ borderColor: c.color, color: c.color, backgroundColor: `${c.color}1a` }}
                      title={`${c.name}: ${c.amount} ÷ ${c.threshold} = +${(c.amount / c.threshold).toFixed(2)}`}
                    >
                      <Tag className="h-2.5 w-2.5" />
                      {c.name} ({c.amount}/{c.threshold})
                    </span>
                  ))}
                </div>
              )}

              <ShareChart points={points} cats={cats} />

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
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
                <div className="space-y-3 pt-2 border-t border-border/50">
                  {cats.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Categories</p>
                      {cats.map((c) => (
                        <div key={c.id} className="flex flex-wrap items-center gap-2">
                          <input
                            type="color"
                            value={c.color}
                            onChange={(e) => updateCategory(c, { color: e.target.value })}
                            className="h-9 w-9 rounded-md border border-input bg-transparent cursor-pointer"
                            title="Category color"
                          />
                          <Input
                            defaultValue={c.name}
                            onBlur={(e) => { if (e.target.value.trim() && e.target.value !== c.name) updateCategory(c, { name: e.target.value.trim() }); }}
                            className="h-9 flex-1 min-w-[120px]"
                          />
                          <Input
                            type="number"
                            defaultValue={c.amount}
                            onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== c.amount) updateCategory(c, { amount: v }); }}
                            className="h-9 w-24"
                            title="Amount"
                          />
                          <span className="text-xs text-muted-foreground">÷</span>
                          <Input
                            type="number"
                            min={0.0001}
                            defaultValue={c.threshold}
                            onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0 && v !== c.threshold) updateCategory(c, { threshold: v }); }}
                            className="h-9 w-24"
                            title="Units needed for +1 price"
                          />
                          <Button size="sm" variant="outline" onClick={() => removeCategory(c.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="color"
                      value={catColor[s.id] ?? "#22d3ee"}
                      onChange={(e) => setCatColor((p) => ({ ...p, [s.id]: e.target.value }))}
                      className="h-9 w-9 rounded-md border border-input bg-transparent cursor-pointer"
                      title="New category color"
                    />
                    <Input placeholder="Category name" value={catName[s.id] ?? ""} onChange={(e) => setCatName((p) => ({ ...p, [s.id]: e.target.value }))} className="h-9 flex-1 min-w-[120px]" />
                    <Input type="number" placeholder="Amount" value={catAmount[s.id] ?? ""} onChange={(e) => setCatAmount((p) => ({ ...p, [s.id]: e.target.value }))} className="h-9 w-24" />
                    <span className="text-xs text-muted-foreground">per +1</span>
                    <Input type="number" min={0.0001} placeholder="Threshold" value={catThreshold[s.id] ?? ""} onChange={(e) => setCatThreshold((p) => ({ ...p, [s.id]: e.target.value }))} className="h-9 w-24" />
                    <Button size="sm" variant="signal" onClick={() => addCategory(s.id)}><Plus className="h-4 w-4 mr-1" />Category</Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder={cats.length > 0 ? "Price is auto-calculated from categories" : `Manual price (now ${Number(s.price).toFixed(2)})`}
                      value={editPrice[s.id] ?? ""}
                      disabled={cats.length > 0}
                      onChange={(e) => setEditPrice((p) => ({ ...p, [s.id]: e.target.value }))}
                      className="h-9 flex-1"
                    />
                    <Button size="sm" variant="outline" disabled={cats.length > 0} onClick={() => updatePrice(s.id)}>
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => removeShare(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
            Add categories to a share to auto-calculate its worth. Buy/sell cost = worth × current Croin price.
          </p>
          <p className="text-xs text-muted-foreground">
            Set price: <code className="font-mono">/functions/v1/crossshare-api?share=SYMBOL&amp;api-key=KEY&amp;price=NEW</code>
          </p>
          <p className="text-xs text-muted-foreground">
            Set category: <code className="font-mono">…?share=SYMBOL&amp;api-key=KEY&amp;category=NAME&amp;amount=10&amp;threshold=5&amp;color=%23ff0000</code> (omit values to keep them; add <code className="font-mono">&amp;delete=true</code> to remove)
          </p>
        </div>
      )}
    </div>
  );
}
