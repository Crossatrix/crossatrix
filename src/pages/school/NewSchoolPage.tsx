import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function NewSchoolPage() {
  const [schoolName, setSchoolName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/school`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          action: "register_principal",
          school_name: schoolName,
          display_name: displayName,
          email,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDone(true);
      toast.success("School submitted for approval");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight-brand">School submitted</h1>
          <p className="text-muted-foreground text-sm">
            Your school is awaiting approval by the Crossatrix owner. You'll be able to sign in
            normally once it's approved.
          </p>
          <Button variant="signal" onClick={() => navigate("/")}>Back to login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-primary glow-primary" />
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">School Registration</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight-brand">Register your school</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Principals can register here. Approval by the Crossatrix owner is required.
          </p>
        </div>

        <Input placeholder="School name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required />
        <Input placeholder="Your name (principal)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        <Input type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />

        <Button type="submit" variant="signal" className="w-full" disabled={loading}>
          {loading ? "Submitting..." : "Register school"}
        </Button>
      </form>
    </div>
  );
}
