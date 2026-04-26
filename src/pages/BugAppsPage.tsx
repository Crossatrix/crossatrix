import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

const OWNER_EMAIL = "cross.a.trix.owner@hotmail.com";

interface BugApp {
  id: string;
  name: string;
  versions: string[];
  sort_order: number;
}

export default function BugAppsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [apps, setApps] = useState<BugApp[]>([]);
  const [name, setName] = useState("");
  const [versions, setVersions] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("bug_apps").select("*").order("sort_order");
    setApps((data as BugApp[]) ?? []);
  };

  useEffect(() => {
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

  const addApp = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    setLoading(true);
    const versionList = versions
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const { error } = await supabase.from("bug_apps").insert({
      name: name.trim().slice(0, 100),
      versions: versionList,
      sort_order: apps.length,
      created_by: user.id,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setVersions("");
    toast.success("App added");
    load();
  };

  const removeApp = async (id: string) => {
    const { error } = await supabase.from("bug_apps").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  };

  const updateVersions = async (id: string, raw: string) => {
    const versionList = raw.split(",").map((v) => v.trim()).filter(Boolean);
    const { error } = await supabase.from("bug_apps").update({ versions: versionList }).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-xl mx-auto">
          <h1 className="text-2xl font-bold">Bug Apps</h1>
          <p className="text-sm text-muted-foreground mt-2">Only the owner can manage this list.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Manage Bug Apps</h1>
          <p className="text-sm text-muted-foreground">Apps and versions shown on /bug.</p>
        </div>

        <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/10">
          <div className="space-y-2">
            <Label>App name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cross Chat" />
          </div>
          <div className="space-y-2">
            <Label>Versions (comma separated)</Label>
            <Input value={versions} onChange={(e) => setVersions(e.target.value)} placeholder="1.0.0, 1.1.0" />
          </div>
          <Button onClick={addApp} disabled={loading} variant="signal" className="w-full">
            Add App
          </Button>
        </div>

        <div className="space-y-3">
          {apps.map((a) => (
            <div key={a.id} className="p-4 rounded-lg border border-border bg-muted/10 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{a.name}</h3>
                <Button size="icon" variant="ghost" onClick={() => removeApp(a.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                defaultValue={a.versions.join(", ")}
                onBlur={(e) => updateVersions(a.id, e.target.value)}
                placeholder="versions, comma separated"
              />
            </div>
          ))}
          {apps.length === 0 && <p className="text-sm text-muted-foreground">No apps yet.</p>}
        </div>
      </div>
    </div>
  );
}
