import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import { Link as LinkIcon, Plus, Trash2, ExternalLink } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OWNER_EMAIL = "cross.a.trix.owner@hotmail.com";

const ICON_OPTIONS = [
  "Link", "Globe", "FileText", "File", "Image", "Video", "Music",
  "Github", "Youtube", "Twitter", "Instagram", "Mail", "Cloud",
  "Download", "Folder", "Star", "Heart", "Code", "Bookmark",
];

interface OwnerLink {
  id: string;
  title: string;
  url: string;
  icon: string;
  kind: string;
}

const renderIcon = (name: string) => {
  const Cmp = (Icons as any)[name] ?? LinkIcon;
  return <Cmp className="h-5 w-5" />;
};

export default function OtherStuff({ userEmail }: { userEmail?: string | null }) {
  const isOwner = userEmail === OWNER_EMAIL;
  const [links, setLinks] = useState<OwnerLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState("Link");
  const [kind, setKind] = useState("website");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("owner_links")
      .select("id,title,url,icon,kind")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load links");
    setLinks((data as OwnerLink[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!title.trim() || !url.trim()) {
      toast.error("Title and URL are required");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("owner_links").insert({
      title: title.trim(),
      url: url.trim(),
      icon,
      kind,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Link added");
    setTitle("");
    setUrl("");
    setIcon("Link");
    setKind("website");
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("owner_links").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed");
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", duration: 0.4, bounce: 0 }}
      className="space-y-6"
    >
      {isOwner && (
        <div className="p-6 rounded-2xl border border-primary/30 bg-primary/5 shadow-vault space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-mono uppercase tracking-widest text-primary">
              Add Link
            </h3>
          </div>

          <div className="space-y-3">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input
              placeholder="https://example.com or file URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger>
                  <SelectValue placeholder="Icon" />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((name) => (
                    <SelectItem key={name} value={name}>
                      <div className="flex items-center gap-2">
                        {renderIcon(name)}
                        <span>{name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="file">File</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="signal"
              className="w-full"
              onClick={handleAdd}
              disabled={saving}
            >
              {saving ? "Adding…" : "Add Link"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nothing here yet.
          </p>
        ) : (
          links.map((link) => (
            <div
              key={link.id}
              className="p-4 rounded-xl border border-border bg-card flex items-center gap-3 group"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                {renderIcon(link.icon)}
              </div>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-foreground truncate flex items-center gap-1">
                  {link.title}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </p>
                <p className="text-xs text-muted-foreground truncate font-mono">
                  {link.url}
                </p>
              </a>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(link.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
