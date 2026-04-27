import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Plus, Image as ImageIcon, Paperclip, Link as LinkIcon, Pencil, Save, X } from "lucide-react";

const OWNER_EMAIL = "cross.a.trix.owner@hotmail.com";

interface Issue {
  id: string;
  title: string;
  content: string;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  userEmail?: string | null;
  userId?: string;
}

// Render inline markdown: **bold**, *italic* within a plain text segment.
function renderInline(text: string, keyPrefix: string) {
  // Tokenize for ** and *.
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) {
      nodes.push(<strong key={`${keyPrefix}-b-${i++}`} className="font-bold">{m[2]}</strong>);
    } else {
      nodes.push(<em key={`${keyPrefix}-i-${i++}`} className="italic">{m[4]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// Render content: supports markdown-ish images ![](url), links [t](url),
// ### heading lines (bold), **bold**, *italic*, and plain text/newlines.
function renderContent(text: string) {
  if (!text) return null;

  // First split into lines so we can detect ### headings.
  const lines = text.split("\n");

  return lines.map((line, lineIdx) => {
    const headingMatch = line.match(/^\s*#{1,6}\s+(.*)$/);
    const isHeading = !!headingMatch;
    const lineContent = isHeading ? headingMatch![1] : line;

    // Parse images/links inside the line.
    const parts: Array<{ type: "text" | "img" | "link"; value: string; href?: string }> = [];
    const regex = /(!\[[^\]]*\]\(([^)]+)\))|(\[([^\]]+)\]\(([^)]+)\))/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(lineContent)) !== null) {
      if (m.index > lastIndex) parts.push({ type: "text", value: lineContent.slice(lastIndex, m.index) });
      if (m[1]) parts.push({ type: "img", value: "", href: m[2] });
      else parts.push({ type: "link", value: m[4], href: m[5] });
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < lineContent.length) parts.push({ type: "text", value: lineContent.slice(lastIndex) });

    const rendered = parts.map((p, i) => {
      if (p.type === "img") {
        return (
          <img
            key={`${lineIdx}-${i}`}
            src={p.href}
            alt=""
            className="my-3 rounded-lg border border-border max-h-96 w-auto"
            loading="lazy"
          />
        );
      }
      if (p.type === "link") {
        return (
          <a
            key={`${lineIdx}-${i}`}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
          >
            {p.value}
          </a>
        );
      }
      return (
        <span key={`${lineIdx}-${i}`}>
          {renderInline(p.value, `${lineIdx}-${i}`)}
        </span>
      );
    });

    if (isHeading) {
      return (
        <p key={lineIdx} className="font-bold text-base my-1">
          {rendered}
        </p>
      );
    }
    return (
      <p key={lineIdx} className="whitespace-pre-wrap">
        {rendered}
        {line === "" ? "\u00A0" : null}
      </p>
    );
  });
}

export default function Newspaper({ userEmail, userId }: Props) {
  const isOwner = userEmail === OWNER_EMAIL;
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCover, setEditCover] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("newspaper_issues")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load newspaper");
    setIssues((data as Issue[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const uploadFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("newspaper").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from("newspaper").getPublicUrl(path);
    return data.publicUrl;
  };

  const insertAtCursor = (
    setter: (v: string) => void,
    current: string,
    snippet: string
  ) => {
    setter(current ? `${current}\n${snippet}\n` : `${snippet}\n`);
  };

  const handleAttach = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "new" | "edit"
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadFile(file);
    if (!url) return;
    const isImage = file.type.startsWith("image/");
    const snippet = isImage ? `![](${url})` : `[${file.name}](${url})`;
    if (target === "new") insertAtCursor(setContent, content, snippet);
    else insertAtCursor(setEditContent, editContent, snippet);
    toast.success(isImage ? "Image inserted" : "File linked");
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadFile(file);
    if (url) setCoverUrl(url);
  };

  const handlePublish = async () => {
    if (!isOwner || !userId) return;
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("newspaper_issues").insert({
      title: title.trim(),
      content,
      cover_url: coverUrl || null,
      created_by: userId,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Issue published");
    setTitle("");
    setContent("");
    setCoverUrl("");
    setComposing(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this issue?")) return;
    const { error } = await supabase.from("newspaper_issues").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  };

  const startEdit = (issue: Issue) => {
    setEditingId(issue.id);
    setEditTitle(issue.title);
    setEditContent(issue.content);
    setEditCover(issue.cover_url);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
    setEditCover(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase
      .from("newspaper_issues")
      .update({
        title: editTitle.trim(),
        content: editContent,
        cover_url: editCover,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    cancelEdit();
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight-brand text-foreground">
            Crossatrix Newspaper
          </h2>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
            Issues & dispatches from the owner
          </p>
        </div>
        {isOwner && !composing && (
          <Button variant="signal" size="sm" onClick={() => setComposing(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Issue
          </Button>
        )}
      </div>

      {/* Composer */}
      {isOwner && composing && (
        <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-4">
          <Input
            placeholder="Issue title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {coverUrl && (
            <div className="relative">
              <img src={coverUrl} alt="cover" className="rounded-lg border border-border max-h-48 w-auto" />
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => setCoverUrl("")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Textarea
            placeholder="Write your issue… use the buttons below to add images, files, and links."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <input
              type="file"
              accept="image/*"
              ref={coverInputRef}
              className="hidden"
              onChange={handleCoverUpload}
            />
            <Button size="sm" variant="outline" onClick={() => coverInputRef.current?.click()}>
              <ImageIcon className="h-4 w-4 mr-1" /> Cover
            </Button>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => handleAttach(e, "new")}
            />
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-4 w-4 mr-1" /> Image / File
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const url = prompt("Link URL:");
                if (!url) return;
                const label = prompt("Link text:", url) || url;
                insertAtCursor(setContent, content, `[${label}](${url})`);
              }}
            >
              <LinkIcon className="h-4 w-4 mr-1" /> Link
            </Button>

            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setComposing(false); setTitle(""); setContent(""); setCoverUrl(""); }}>
                Cancel
              </Button>
              <Button size="sm" variant="signal" onClick={handlePublish} disabled={saving}>
                {saving ? "Publishing…" : "Publish"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Issues */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : issues.length === 0 ? (
        <p className="text-sm text-muted-foreground">No issues yet.</p>
      ) : (
        <div className="space-y-5">
          {issues.map((issue) => (
            <article
              key={issue.id}
              className="rounded-2xl border border-border bg-card overflow-hidden shadow-vault"
            >
              {editingId === issue.id ? (
                <div className="p-5 space-y-3">
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  {editCover && (
                    <div className="relative">
                      <img src={editCover} alt="" className="rounded-lg border border-border max-h-48" />
                      <Button size="sm" variant="ghost" className="absolute top-2 right-2" onClick={() => setEditCover(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="file"
                      ref={editFileInputRef}
                      className="hidden"
                      onChange={(e) => handleAttach(e, "edit")}
                    />
                    <Button size="sm" variant="outline" onClick={() => editFileInputRef.current?.click()}>
                      <Paperclip className="h-4 w-4 mr-1" /> Image / File
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const url = prompt("Cover image URL (or leave blank to upload):");
                        if (url) setEditCover(url);
                      }}
                    >
                      <ImageIcon className="h-4 w-4 mr-1" /> Cover URL
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const url = prompt("Link URL:");
                        if (!url) return;
                        const label = prompt("Link text:", url) || url;
                        insertAtCursor(setEditContent, editContent, `[${label}](${url})`);
                      }}
                    >
                      <LinkIcon className="h-4 w-4 mr-1" /> Link
                    </Button>
                    <div className="ml-auto flex gap-2">
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                      <Button size="sm" variant="signal" onClick={saveEdit}>
                        <Save className="h-4 w-4 mr-1" /> Save
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {issue.cover_url && (
                    <img
                      src={issue.cover_url}
                      alt=""
                      className="w-full max-h-64 object-cover border-b border-border"
                    />
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-foreground tracking-tight-brand">
                        {issue.title}
                      </h3>
                      {isOwner && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(issue)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(issue.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-mono text-muted-foreground mb-3">
                      {new Date(issue.created_at).toLocaleString()}
                    </p>
                    <div className="text-sm text-foreground leading-relaxed">
                      {renderContent(issue.content)}
                    </div>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}

      {isOwner && (
        <p className="text-xs text-muted-foreground/60 font-mono">
          Tip: use <code>![](url)</code> for images and <code>[text](url)</code> for links — buttons insert these for you.
        </p>
      )}
    </div>
  );
}
