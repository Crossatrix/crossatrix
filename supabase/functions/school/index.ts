import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OWNER_EMAILS = ["cross.a.trix.owner@hotmail.com", "moritz.loeseke7@gmail.com"];

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "school";

const usernameToEmail = (username: string, schoolSlug: string) =>
  `${username.toLowerCase().replace(/[^a-z0-9._-]/g, "")}@${schoolSlug}.school.crossatrix.local`;

async function getCaller(req: Request) {
  const auth =
    req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!auth) return null;
  const token = auth.replace("Bearer ", "");
  const c = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await c.auth.getUser();
  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const action = body.action as string;

    // ========= REGISTER PRINCIPAL (public) =========
    if (action === "register_principal") {
      const { school_name, email, password, display_name } = body;
      if (!school_name || !email || !password) return json({ error: "Missing fields" }, 400);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name },
      });
      if (cErr || !created.user) return json({ error: cErr?.message || "Signup failed" }, 400);

      const { data: school, error: sErr } = await admin
        .from("schools")
        .insert({ name: school_name, principal_user_id: created.user.id, approved: false })
        .select()
        .single();
      if (sErr) return json({ error: sErr.message }, 500);

      await admin.from("school_members").insert({
        school_id: school.id,
        user_id: created.user.id,
        role: "principal",
        username: "principal",
        display_name: display_name || school_name,
      });

      return json({ ok: true, school_id: school.id, pending_approval: true });
    }

    // ========= SCHOOL LOGIN (username + password) =========
    if (action === "school_login") {
      const { school_slug, username, password } = body;
      if (!school_slug || !username || !password) return json({ error: "Missing fields" }, 400);
      const email = usernameToEmail(username, school_slug);
      const c = createClient(SUPABASE_URL, ANON_KEY);
      const { data, error } = await c.auth.signInWithPassword({ email, password });
      if (error || !data.session) return json({ error: "Invalid credentials" }, 401);

      const { data: member } = await admin
        .from("school_members")
        .select("school_id, role, username, display_name")
        .eq("user_id", data.user.id)
        .maybeSingle();

      return json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: { id: data.user.id, email: data.user.email },
        school: member,
        is_student: member?.role === "student",
        is_teacher: member?.role === "teacher",
        is_principal: member?.role === "principal",
      });
    }

    // ----- All actions below require auth -----
    const caller = await getCaller(req);
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const { data: callerMember } = await admin
      .from("school_members")
      .select("school_id, role")
      .eq("user_id", caller.id)
      .maybeSingle();
    const isOwner = OWNER_EMAILS.includes(caller.email || "");

    // ========= OWNER: approve school =========
    if (action === "approve_school") {
      if (!isOwner) return json({ error: "Forbidden" }, 403);
      const { school_id, approved } = body;
      const { error } = await admin.from("schools").update({ approved: !!approved }).eq("id", school_id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ========= OWNER: fund school pool =========
    if (action === "fund_pool") {
      if (!isOwner) return json({ error: "Forbidden" }, 403);
      const { school_id, amount } = body;
      const { data: s } = await admin.from("schools").select("pool_balance").eq("id", school_id).single();
      const newBal = (s?.pool_balance ?? 0) + Number(amount);
      const { error } = await admin.from("schools").update({ pool_balance: newBal }).eq("id", school_id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, pool_balance: newBal });
    }

    // ========= LIST SCHOOLS (owner) =========
    if (action === "list_schools") {
      if (!isOwner) return json({ error: "Forbidden" }, 403);
      const { data } = await admin.from("schools").select("*").order("created_at", { ascending: false });
      return json({ schools: data });
    }

    // ========= PRINCIPAL: create teacher / student =========
    if (action === "create_member") {
      if (!callerMember || callerMember.role !== "principal")
        return json({ error: "Only principals" }, 403);

      const { role, username, password, display_name } = body;
      if (!["teacher", "student"].includes(role)) return json({ error: "Bad role" }, 400);
      if (!username || !password) return json({ error: "Missing fields" }, 400);

      const { data: school } = await admin
        .from("schools")
        .select("id, name, approved")
        .eq("id", callerMember.school_id)
        .single();
      if (!school?.approved) return json({ error: "School not approved yet" }, 403);

      const slug = slugify(school.name);
      const email = usernameToEmail(username, slug);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name, school_username: username },
      });
      if (cErr || !created.user) return json({ error: cErr?.message || "Failed" }, 400);

      const { error: mErr } = await admin.from("school_members").insert({
        school_id: school.id,
        user_id: created.user.id,
        role,
        username,
        display_name: display_name || username,
      });
      if (mErr) return json({ error: mErr.message }, 500);

      return json({ ok: true, user_id: created.user.id, login_email: email, school_slug: slug });
    }

    // ========= PRINCIPAL: create class =========
    if (action === "create_class") {
      if (!callerMember || callerMember.role !== "principal")
        return json({ error: "Only principals" }, 403);
      const { name } = body;
      const { data, error } = await admin
        .from("school_classes")
        .insert({ school_id: callerMember.school_id, name })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, class: data });
    }

    // ========= PRINCIPAL: assign teacher to subject in class =========
    if (action === "assign_teacher") {
      if (!callerMember || callerMember.role !== "principal")
        return json({ error: "Only principals" }, 403);
      const { class_id, subject, teacher_user_id } = body;
      const { error } = await admin
        .from("class_subjects")
        .insert({ class_id, subject, teacher_user_id });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ========= PRINCIPAL: add student to class =========
    if (action === "assign_student") {
      if (!callerMember || callerMember.role !== "principal")
        return json({ error: "Only principals" }, 403);
      const { class_id, student_user_id } = body;
      const { error } = await admin
        .from("class_students")
        .insert({ class_id, student_user_id });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ========= TEACHER: create student in own school =========
    if (action === "teacher_create_student") {
      if (!callerMember || callerMember.role !== "teacher")
        return json({ error: "Only teachers" }, 403);
      const { username, password, display_name, class_id } = body;
      if (!username || !password) return json({ error: "Missing fields" }, 400);

      // verify teacher teaches this class if provided
      if (class_id) {
        const { data: teaches } = await admin
          .from("class_subjects")
          .select("id")
          .eq("class_id", class_id)
          .eq("teacher_user_id", caller.id)
          .maybeSingle();
        if (!teaches) return json({ error: "Not your class" }, 403);
      }

      const { data: school } = await admin
        .from("schools")
        .select("name, approved")
        .eq("id", callerMember.school_id)
        .single();
      if (!school?.approved) return json({ error: "School not approved" }, 403);

      const slug = slugify(school.name);
      const email = usernameToEmail(username, slug);
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name, school_username: username },
      });
      if (cErr || !created.user) return json({ error: cErr?.message || "Failed" }, 400);

      await admin.from("school_members").insert({
        school_id: callerMember.school_id,
        user_id: created.user.id,
        role: "student",
        username,
        display_name: display_name || username,
      });

      if (class_id) {
        await admin.from("class_students").insert({
          class_id,
          student_user_id: created.user.id,
        });
      }

      return json({ ok: true, user_id: created.user.id, login_email: email, school_slug: slug });
    }

    // ========= TEACHER: pay everyone in class from school pool =========
    if (action === "class_pay") {
      if (!callerMember || callerMember.role !== "teacher")
        return json({ error: "Only teachers" }, 403);
      const { class_id, amount_per_student, description } = body;
      const amt = Number(amount_per_student);
      if (!amt || amt <= 0 || amt > 5000) return json({ error: "Bad amount" }, 400);

      // verify teacher in this class
      const { data: teaches } = await admin
        .from("class_subjects")
        .select("id")
        .eq("class_id", class_id)
        .eq("teacher_user_id", caller.id)
        .maybeSingle();
      if (!teaches) return json({ error: "Not your class" }, 403);

      // get students minus those restricted from croins in this class
      const { data: students } = await admin
        .from("class_students")
        .select("student_user_id")
        .eq("class_id", class_id);
      const allIds = (students || []).map((s) => s.student_user_id);

      const { data: restricted } = await admin
        .from("student_restrictions")
        .select("student_user_id, restrict_croins")
        .eq("class_id", class_id)
        .eq("restrict_croins", true);
      const blocked = new Set((restricted || []).map((r) => r.student_user_id));

      const eligible = allIds.filter((id) => !blocked.has(id));
      const total = eligible.length * amt;

      const { data: school } = await admin
        .from("schools")
        .select("pool_balance")
        .eq("id", callerMember.school_id)
        .single();
      if (!school || school.pool_balance < total)
        return json({ error: "School pool insufficient", needed: total, pool_balance: school?.pool_balance ?? 0 }, 400);

      // debit pool
      await admin
        .from("schools")
        .update({ pool_balance: school.pool_balance - total })
        .eq("id", callerMember.school_id);

      // credit each student
      for (const sid of eligible) {
        const { data: w } = await admin.from("wallets").select("balance").eq("user_id", sid).maybeSingle();
        if (!w) {
          await admin.from("wallets").insert({ user_id: sid, balance: amt });
        } else {
          await admin
            .from("wallets")
            .update({ balance: w.balance + amt, updated_at: new Date().toISOString() })
            .eq("user_id", sid);
        }
        await admin.from("croin_transactions").insert({
          user_id: sid,
          amount: amt,
          type: "credit",
          description: description || "Class payment",
        });
      }

      return json({ ok: true, paid_count: eligible.length, total, skipped: allIds.length - eligible.length });
    }

    // ========= GET MY CONTEXT (for current user: school, classes, restrictions) =========
    if (action === "my_context") {
      if (!callerMember) return json({ member: null });
      const { data: school } = await admin
        .from("schools")
        .select("id, name, approved, pool_balance")
        .eq("id", callerMember.school_id)
        .single();

      let classes: any[] = [];
      let restrictions: any[] = [];

      if (callerMember.role === "teacher") {
        const { data } = await admin
          .from("class_subjects")
          .select("id, subject, class_id, school_classes(id,name)")
          .eq("teacher_user_id", caller.id);
        classes = data || [];
      } else if (callerMember.role === "student") {
        const { data } = await admin
          .from("class_students")
          .select("class_id, school_classes(id,name)")
          .eq("student_user_id", caller.id);
        classes = data || [];
        const { data: r } = await admin
          .from("student_restrictions")
          .select("*")
          .eq("student_user_id", caller.id);
        restrictions = r || [];
      } else if (callerMember.role === "principal") {
        const { data } = await admin
          .from("school_classes")
          .select("id, name")
          .eq("school_id", callerMember.school_id);
        classes = data || [];
      }

      return json({ member: callerMember, school, classes, restrictions, is_owner: isOwner });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("school fn error", err);
    return json({ error: String(err) }, 500);
  }
});
