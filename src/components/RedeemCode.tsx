import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Gift, Plus, Trash2, Copy, ShoppingCart } from "lucide-react";

const ADMINS = ["cross.a.trix.owner@hotmail.com", "moritz.loeseke7@gmail.com"];
const CODE_RE = /^[a-z0-9]{4}-[a-z0-9]{4}--[a-z0-9]{4}-[a-z0-9]{4}$/i;

function randomCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const seg = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${seg(4)}-${seg(4)}--${seg(4)}-${seg(4)}`;
}

interface CroinCode {
  id: string;
  code: string;
  amount: number;
  max_uses: number;
  uses: number;
  active: boolean;
}

export default function RedeemCode({ userId, userEmail }: { userId: string; userEmail?: string }) {
  const isAdmin = !!userEmail && ADMINS.includes(userEmail);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const [codes, setCodes] = useState<CroinCode[]>([]);
  const [newCode, setNewCode] = useState(randomCode());
  const [amount, setAmount] = useState("100");
  const [maxUses, setMaxUses] = useState("10");
  const [creating, setCreating] = useState(false);

  // Buy code (any user)
  const [buyAmount, setBuyAmount] = useState("100");
  const [buyMaxUses, setBuyMaxUses] = useState("1");
  const [buying, setBuying] = useState(false);
  const [boughtCode, setBoughtCode] = useState<string | null>(null);

  const buyAmt = Math.max(0, Math.min(1000, parseInt(buyAmount, 10) || 0));
  const buyUses = Math.max(0, Math.min(100, parseInt(buyMaxUses, 10) || 0));
  const buyCost = Math.ceil(buyAmt * buyUses * 1.05);

  const loadCodes = async () => {
    if (!isAdmin) return;
    const { data } = await supabase
      .from("croin_codes")
      .select("*")
      .order("created_at", { ascending: false });
    setCodes((data as CroinCode[]) ?? []);
  };

  useEffect(() => { loadCodes(); }, [isAdmin]);

  const redeem = async () => {
    const c = code.trim();
    if (!CODE_RE.test(c)) {
      toast.error("Format: aaaa-1111--a1a1-1a1a");
      return;
    }
    setRedeeming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/redeem-code`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ code: c }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Redeem failed");
      toast.success(`+${json.amount} ¢ redeemed`);
      setCode("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRedeeming(false);
    }
  };

  const create = async () => {
    if (!CODE_RE.test(newCode)) { toast.error("Bad format"); return; }
    const amt = parseInt(amount, 10);
    const mu = parseInt(maxUses, 10);
    if (!amt || amt < 1) { toast.error("Invalid amount"); return; }
    if (!mu || mu < 1) { toast.error("Invalid max uses"); return; }
    setCreating(true);
    const { error } = await supabase.from("croin_codes").insert({
      code: newCode.toLowerCase(),
      amount: amt,
      max_uses: mu,
      created_by: userId,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Code created");
    setNewCode(randomCode());
    loadCodes();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("croin_codes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setCodes((p) => p.filter((c) => c.id !== id));
  };

  const toggleActive = async (id: string, active: boolean) => {
    setCodes((p) => p.map((c) => (c.id === id ? { ...c, active } : c)));
    const { error } = await supabase
      .from("croin_codes")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      setCodes((p) => p.map((c) => (c.id === id ? { ...c, active: !active } : c)));
    } else {
      toast.success(active ? "Code activated" : "Code deactivated");
    }
  };

  const copy = (c: string) => {
    navigator.clipboard.writeText(c);
    toast.success("Copied");
  };

  return (
    <div className="mt-4 p-4 rounded-2xl border border-border bg-card shadow-vault">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="h-4 w-4 text-primary" />
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Redeem Code
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="aaaa-1111--a1a1-1a1a"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="font-mono text-sm"
        />
        <Button onClick={redeem} disabled={redeeming} variant="signal">
          {redeeming ? "…" : "Redeem"}
        </Button>
      </div>

      {isAdmin && (
        <div className="mt-5 pt-4 border-t border-border space-y-3">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Admin · Create Code
          </p>
          <div className="flex gap-2">
            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setNewCode(randomCode())}
            >
              ↻
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="¢ amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input
              type="number"
              placeholder="max uses"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
            />
            <Button onClick={create} disabled={creating}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {codes.length > 0 && (
            <div className="space-y-2 mt-3 max-h-64 overflow-y-auto">
              {codes.map((c) => {
                const remaining = Math.max(0, c.max_uses - c.uses);
                const exhausted = remaining === 0;
                const effectiveActive = c.active && !exhausted;
                return (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border ${exhausted ? "opacity-50" : ""}`}
                >
                  <button
                    onClick={() => copy(c.code)}
                    className="flex-1 text-left text-xs font-mono text-foreground truncate hover:text-primary flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3 shrink-0" /> {c.code}
                  </button>
                  <span className="text-xs font-mono text-primary shrink-0">
                    {c.amount}¢
                  </span>
                  <span className={`text-xs font-mono shrink-0 ${exhausted ? "text-destructive" : "text-muted-foreground"}`}>
                    {exhausted ? "0 left" : `${remaining} left`}
                  </span>
                  <Switch
                    checked={effectiveActive}
                    disabled={exhausted}
                    onCheckedChange={(v) => toggleActive(c.id, v)}
                    aria-label="Toggle active"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(c.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
