import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

interface BugApp {
  id: string;
  name: string;
  versions: string[];
}

export default function BugPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [apps, setApps] = useState<BugApp[]>([]);
  const [app, setApp] = useState(params.get("app") ?? "");
  const [appVersion, setAppVersion] = useState(params.get("appversion") ?? "");
  const [title, setTitle] = useState(params.get("title") ?? "");
  const [description, setDescription] = useState(params.get("description") ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/");
        return;
      }
      setUser(session.user);
    });
    supabase
      .from("bug_apps")
      .select("id,name,versions")
      .order("sort_order")
      .then(({ data }) => setApps((data as BugApp[]) ?? []));
  }, [navigate]);

  const selectedApp = useMemo(() => apps.find((a) => a.name === app), [apps, app]);

  const submit = async () => {
    if (!user) return;
    if (!app.trim() || !title.trim()) {
      toast.error("App and title are required");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("bug_reports").insert({
      user_id: user.id,
      app: app.trim().slice(0, 100),
      app_version: appVersion.trim().slice(0, 50),
      title: title.trim().slice(0, 200),
      description: description.trim().slice(0, 4000),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bug reported. Thank you!");
    setTitle("");
    setDescription("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Report a Bug</h1>
          <p className="text-sm text-muted-foreground">Help us improve by sending a detailed report.</p>
        </div>

        <div className="space-y-2">
          <Label>App</Label>
          {apps.length > 0 ? (
            <Select
              value={app}
              onValueChange={(v) => {
                setApp(v);
                const next = apps.find((a) => a.name === v);
                if (next && !next.versions.includes(appVersion)) setAppVersion("");
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select an app" /></SelectTrigger>
              <SelectContent>
                {apps.map((a) => (
                  <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input value={app} onChange={(e) => setApp(e.target.value)} placeholder="App name" />
          )}
        </div>

        <div className="space-y-2">
          <Label>App Version</Label>
          {selectedApp && selectedApp.versions.length > 0 ? (
            <Select value={appVersion} onValueChange={setAppVersion}>
              <SelectTrigger><SelectValue placeholder="Select version" /></SelectTrigger>
              <SelectContent>
                {selectedApp.versions.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input value={appVersion} onChange={(e) => setAppVersion(e.target.value)} placeholder="e.g. 1.2.0" />
          )}
        </div>

        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Short summary" />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={4000}
            rows={8}
            placeholder="Steps to reproduce, expected vs actual behavior…"
          />
        </div>

        <Button onClick={submit} disabled={submitting} className="w-full" variant="signal">
          {submitting ? "Sending…" : "Submit Bug Report"}
        </Button>
      </div>
    </div>
  );
}
