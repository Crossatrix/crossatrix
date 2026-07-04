import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const ADMIN_EMAILS = [
  "cross.a.trix.owner@hotmail.com",
  "moritz.loeseke7@gmail.com",
];

type State = "up" | "degraded" | "down";
interface Item {
  name: string;
  state: State;
  note?: string;
}

const STATE_META: Record<State, { label: string; dot: string }> = {
  up: { label: "Operational", dot: "#22c55e" },
  degraded: { label: "Degraded", dot: "#eab308" },
  down: { label: "Down", dot: "#ef4444" },
};

const PRESET_COLORS = ["#22c55e", "#eab308", "#ef4444", "#3b82f6", "#a855f7", "#6b7280"];

export default function StatusLight() {
  const [color, setColor] = useState("#22c55e");
  const [items, setItems] = useState<Item[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("status_light")
      .select("color,items")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      setColor(data.color ?? "#22c55e");
      setItems(Array.isArray(data.items) ? (data.items as unknown as Item[]) : []);
    }
    setLoaded(true);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdmin(ADMIN_EMAILS.includes(session?.user?.email?.toLowerCase() ?? ""));
    });
    load();
  }, []);

  // Automatic polling: refresh service health every 30s and when the tab
  // regains focus. Paused while the panel is open so it never clobbers an
  // admin's unsaved edits.
  useEffect(() => {
    const tick = () => {
      if (!open) load();
    };
    const id = window.setInterval(tick, 30_000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [open]);

  const save = async () => {
    setSaving(true);
    const clean = items
      .map((i) => ({ name: i.name.trim(), state: i.state, note: (i.note ?? "").trim() }))
      .filter((i) => i.name);
    const { error } = await supabase
      .from("status_light")
      .update({ color, items: clean as unknown as never, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setItems(clean);
    toast.success("Status updated");
  };

  const updateItem = (idx: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  if (!loaded) return null;

  return (
    <div className="fixed top-3 right-3 z-[60]">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            aria-label="System status"
            className="relative flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card/80 shadow-vault backdrop-blur transition-transform hover:scale-110"
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
            />
            <span
              className="absolute inline-flex h-3 w-3 animate-ping rounded-full opacity-60"
              style={{ backgroundColor: color }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-3">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
            />
            <h3 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
              System Status
            </h3>
          </div>

          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">No status information available.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {isAdmin ? (
                    <div className="flex-1 space-y-1.5 rounded-lg border border-border p-2">
                      <div className="flex gap-1.5">
                        <Input
                          value={it.name}
                          placeholder="Service"
                          className="h-8"
                          onChange={(e) => updateItem(i, { name: e.target.value })}
                        />
                        <button
                          aria-label="Remove"
                          className="text-muted-foreground hover:text-destructive px-1"
                          onClick={() => setItems((p) => p.filter((_, x) => x !== i))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex gap-1">
                        {(Object.keys(STATE_META) as State[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => updateItem(i, { state: s })}
                            className={`flex-1 rounded-md py-1 text-xs transition-colors ${
                              it.state === s
                                ? "text-background"
                                : "text-muted-foreground border border-border"
                            }`}
                            style={it.state === s ? { backgroundColor: STATE_META[s].dot } : undefined}
                          >
                            {STATE_META[s].label}
                          </button>
                        ))}
                      </div>
                      <Input
                        value={it.note ?? ""}
                        placeholder="Note (optional)"
                        className="h-8"
                        onChange={(e) => updateItem(i, { note: e.target.value })}
                      />
                    </div>
                  ) : (
                    <>
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: STATE_META[it.state]?.dot ?? "#6b7280" }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-foreground">{it.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {STATE_META[it.state]?.label ?? it.state}
                          </span>
                        </div>
                        {it.note && <p className="text-xs text-muted-foreground">{it.note}</p>}
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isAdmin && (
            <div className="space-y-3 border-t border-border pt-3">
              <button
                onClick={() => setItems((p) => [...p, { name: "", state: "up", note: "" }])}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Add service
              </button>
              <div>
                <p className="mb-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Light color
                </p>
                <div className="flex items-center gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      aria-label={c}
                      onClick={() => setColor(c)}
                      className={`h-6 w-6 rounded-full border-2 ${
                        color.toLowerCase() === c ? "border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-6 w-6 cursor-pointer rounded-full border border-border bg-transparent p-0"
                  />
                </div>
              </div>
              <Button size="sm" className="w-full" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save status"}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
