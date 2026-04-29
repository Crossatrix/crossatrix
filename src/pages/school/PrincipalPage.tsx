import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { callSchool } from "@/lib/schoolApi";

export default function PrincipalPage() {
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // forms
  const [memberRole, setMemberRole] = useState("teacher");
  const [memberUsername, setMemberUsername] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [memberDisplay, setMemberDisplay] = useState("");

  const [className, setClassName] = useState("");

  const [assignClass, setAssignClass] = useState("");
  const [assignSubject, setAssignSubject] = useState("");
  const [assignTeacher, setAssignTeacher] = useState("");

  const [studentClass, setStudentClass] = useState("");
  const [studentToAdd, setStudentToAdd] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await callSchool("my_context");
      if (!data.member || data.member.role !== "principal") {
        toast.error("Not a principal account");
        navigate("/");
        return;
      }
      setCtx(data);
      const { data: m } = await supabase
        .from("school_members")
        .select("user_id, role, username, display_name")
        .eq("school_id", data.member.school_id);
      setMembers(m || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const createMember = async () => {
    try {
      const r = await callSchool("create_member", {
        role: memberRole, username: memberUsername, password: memberPassword, display_name: memberDisplay,
      });
      toast.success(`Created — login slug: ${r.school_slug}`);
      setMemberUsername(""); setMemberPassword(""); setMemberDisplay("");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const createClass = async () => {
    try {
      await callSchool("create_class", { name: className });
      toast.success("Class created");
      setClassName("");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const assignTeacherFn = async () => {
    try {
      await callSchool("assign_teacher", { class_id: assignClass, subject: assignSubject, teacher_user_id: assignTeacher });
      toast.success("Teacher assigned");
      setAssignSubject("");
    } catch (e: any) { toast.error(e.message); }
  };

  const assignStudentFn = async () => {
    try {
      await callSchool("assign_student", { class_id: studentClass, student_user_id: studentToAdd });
      toast.success("Student assigned");
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!ctx) return null;

  if (!ctx.school?.approved) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-semibold">Awaiting approval</h1>
          <p className="text-muted-foreground text-sm">{ctx.school?.name} is pending owner approval.</p>
          <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => navigate("/"))}>Sign out</Button>
        </div>
      </div>
    );
  }

  const teachers = members.filter((m) => m.role === "teacher");
  const students = members.filter((m) => m.role === "student");

  return (
    <div className="min-h-screen px-4 py-8 max-w-3xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-primary glow-primary" />
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Principal</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight-brand">{ctx.school?.name}</h1>
          <p className="text-xs text-muted-foreground mt-1">Pool: {ctx.school?.pool_balance} ¢</p>
        </div>
        <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => navigate("/"))}>Sign out</Button>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Create teacher / student</h2>
        <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)} className="w-full h-12 rounded-lg border border-input bg-muted/20 px-4 text-sm">
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
        </select>
        <Input placeholder="Username" value={memberUsername} onChange={(e) => setMemberUsername(e.target.value)} />
        <Input placeholder="Display name" value={memberDisplay} onChange={(e) => setMemberDisplay(e.target.value)} />
        <Input type="password" placeholder="Password" value={memberPassword} onChange={(e) => setMemberPassword(e.target.value)} />
        <Button variant="signal" onClick={createMember}>Create</Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Create class</h2>
        <Input placeholder="Class name" value={className} onChange={(e) => setClassName(e.target.value)} />
        <Button variant="signal" onClick={createClass}>Create class</Button>
        <div className="space-y-1 text-sm text-muted-foreground">
          {ctx.classes.map((c: any) => <div key={c.id}>• {c.name}</div>)}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Assign teacher to class+subject</h2>
        <select value={assignClass} onChange={(e) => setAssignClass(e.target.value)} className="w-full h-12 rounded-lg border border-input bg-muted/20 px-4 text-sm">
          <option value="">Class</option>
          {ctx.classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Input placeholder="Subject" value={assignSubject} onChange={(e) => setAssignSubject(e.target.value)} />
        <select value={assignTeacher} onChange={(e) => setAssignTeacher(e.target.value)} className="w-full h-12 rounded-lg border border-input bg-muted/20 px-4 text-sm">
          <option value="">Teacher</option>
          {teachers.map((t) => <option key={t.user_id} value={t.user_id}>{t.display_name || t.username}</option>)}
        </select>
        <Button variant="signal" onClick={assignTeacherFn}>Assign</Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Assign student to class</h2>
        <select value={studentClass} onChange={(e) => setStudentClass(e.target.value)} className="w-full h-12 rounded-lg border border-input bg-muted/20 px-4 text-sm">
          <option value="">Class</option>
          {ctx.classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={studentToAdd} onChange={(e) => setStudentToAdd(e.target.value)} className="w-full h-12 rounded-lg border border-input bg-muted/20 px-4 text-sm">
          <option value="">Student</option>
          {students.map((s) => <option key={s.user_id} value={s.user_id}>{s.display_name || s.username}</option>)}
        </select>
        <Button variant="signal" onClick={assignStudentFn}>Assign student</Button>
      </section>
    </div>
  );
}
