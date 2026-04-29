import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { callSchool } from "@/lib/schoolApi";
import type { User } from "@supabase/supabase-js";

interface Ctx {
  member: any;
  school: any;
  classes: any[];
  restrictions: any[];
}

export default function TeacherPage() {
  const [user, setUser] = useState<User | null>(null);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);

  // login form
  const [slug, setSlug] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // create student form
  const [stuUsername, setStuUsername] = useState("");
  const [stuPassword, setStuPassword] = useState("");
  const [stuClassId, setStuClassId] = useState("");

  // class pay
  const [payAmount, setPayAmount] = useState("");
  const [payClassId, setPayClassId] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) loadCtx();
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null);
      if (s?.user) loadCtx();
      else { setCtx(null); setLoading(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadCtx = async () => {
    setLoading(true);
    try {
      const data = await callSchool("my_context");
      setCtx(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await callSchool("school_login", { school_slug: slug, username, password });
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      toast.success(`Signed in as ${data.school?.role}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const createStudent = async () => {
    try {
      await callSchool("teacher_create_student", {
        username: stuUsername,
        password: stuPassword,
        class_id: stuClassId || undefined,
      });
      toast.success("Student created");
      setStuUsername(""); setStuPassword("");
    } catch (e: any) { toast.error(e.message); }
  };

  const classPay = async () => {
    try {
      const r = await callSchool("class_pay", {
        class_id: payClassId,
        amount_per_student: Number(payAmount),
        description: "Teacher class payment",
      });
      toast.success(`Paid ${r.paid_count} students (${r.total} ¢)`);
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;

  // ===== LOGIN VIEW =====
  if (!user || !ctx?.member || ctx.member.role !== "teacher") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={login} className="w-full max-w-md space-y-4">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-primary glow-primary" />
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Teacher Access</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight-brand">Teacher sign in</h1>
            <p className="text-sm text-muted-foreground mt-2">Use the credentials your principal gave you.</p>
          </div>
          <Input placeholder="School slug (e.g. my-school)" value={slug} onChange={(e) => setSlug(e.target.value)} required />
          <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" variant="signal" className="w-full">Sign in</Button>
          {user && (
            <Button type="button" variant="outline" className="w-full" onClick={() => supabase.auth.signOut()}>
              Sign out current user
            </Button>
          )}
        </form>
      </div>
    );
  }

  // ===== TEACHER DASHBOARD =====
  return (
    <div className="min-h-screen px-4 py-8 max-w-3xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-primary glow-primary" />
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Teacher</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight-brand">{ctx.school?.name}</h1>
        </div>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>Sign out</Button>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-3">Your classes & subjects</h2>
        <div className="space-y-2">
          {ctx.classes.length === 0 && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
          {ctx.classes.map((c: any) => (
            <div key={c.id} className="p-4 rounded-lg border border-border bg-muted/10">
              <div className="font-medium">{c.school_classes?.name}</div>
              <div className="text-sm text-muted-foreground">Subject: {c.subject}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Create student</h2>
        <Input placeholder="Username" value={stuUsername} onChange={(e) => setStuUsername(e.target.value)} />
        <Input type="password" placeholder="Password" value={stuPassword} onChange={(e) => setStuPassword(e.target.value)} />
        <select value={stuClassId} onChange={(e) => setStuClassId(e.target.value)} className="w-full h-12 rounded-lg border border-input bg-muted/20 px-4 text-sm">
          <option value="">Add to class (optional)</option>
          {ctx.classes.map((c: any) => (
            <option key={c.class_id} value={c.class_id}>{c.school_classes?.name} ({c.subject})</option>
          ))}
        </select>
        <Button variant="signal" onClick={createStudent}>Create student</Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pay class (from school pool)</h2>
        <select value={payClassId} onChange={(e) => setPayClassId(e.target.value)} className="w-full h-12 rounded-lg border border-input bg-muted/20 px-4 text-sm">
          <option value="">Select class</option>
          {ctx.classes.map((c: any) => (
            <option key={c.class_id} value={c.class_id}>{c.school_classes?.name} ({c.subject})</option>
          ))}
        </select>
        <Input type="number" min={1} max={5000} placeholder="Amount per student (¢)" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
        <Button variant="signal" onClick={classPay} disabled={!payClassId || !payAmount}>Send to class</Button>
        <p className="text-xs text-muted-foreground">Students with the Croins restriction are skipped.</p>
      </section>

      <ClassRestrictionsManager classes={ctx.classes} onChange={loadCtx} />
    </div>
  );
}

function ClassRestrictionsManager({ classes, onChange }: { classes: any[]; onChange: () => void }) {
  const [selected, setSelected] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [restr, setRestr] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const { data: cs } = await supabase
        .from("class_students")
        .select("student_user_id, school_members!inner(display_name, username)")
        .eq("class_id", selected);
      setStudents(cs || []);
      const { data: r } = await supabase
        .from("student_restrictions")
        .select("*")
        .eq("class_id", selected);
      const map: Record<string, any> = {};
      (r || []).forEach((row) => { map[row.student_user_id] = row; });
      setRestr(map);
    })();
  }, [selected]);

  const toggle = async (studentId: string, field: string) => {
    const current = restr[studentId] || {
      class_id: selected, student_user_id: studentId,
      restrict_croins: false, restrict_news: false, restrict_newspaper: false, restrict_other: false,
    };
    const updated = { ...current, [field]: !current[field] };
    const { data, error } = await supabase
      .from("student_restrictions")
      .upsert(updated, { onConflict: "class_id,student_user_id" })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setRestr({ ...restr, [studentId]: data });
    onChange();
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Restrictions per class</h2>
      <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full h-12 rounded-lg border border-input bg-muted/20 px-4 text-sm">
        <option value="">Select class</option>
        {classes.map((c: any) => (
          <option key={c.class_id} value={c.class_id}>{c.school_classes?.name} ({c.subject})</option>
        ))}
      </select>

      {selected && students.map((s: any) => {
        const r = restr[s.student_user_id] || {};
        const fields = ["restrict_croins", "restrict_news", "restrict_newspaper", "restrict_other"];
        const labels = ["Croins", "News", "Newspaper", "Other"];
        return (
          <div key={s.student_user_id} className="p-4 rounded-lg border border-border bg-muted/10">
            <div className="font-medium mb-2">{s.school_members?.display_name || s.school_members?.username}</div>
            <div className="flex flex-wrap gap-2">
              {fields.map((f, i) => (
                <Button
                  key={f}
                  size="sm"
                  variant={r[f] ? "destructive" : "outline"}
                  onClick={() => toggle(s.student_user_id, f)}
                >
                  {r[f] ? `Restricted: ${labels[i]}` : `Allow ${labels[i]}`}
                </Button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
