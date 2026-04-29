
-- ============ SCHOOLS ============
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  principal_user_id UUID NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  pool_balance BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- ============ SCHOOL MEMBERS ============
-- role: 'principal' | 'teacher' | 'student'
CREATE TABLE public.school_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('principal','teacher','student')),
  username TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, username)
);
ALTER TABLE public.school_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_school_members_school ON public.school_members(school_id);
CREATE INDEX idx_school_members_user ON public.school_members(user_id);

-- ============ CLASSES ============
CREATE TABLE public.school_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.school_classes ENABLE ROW LEVEL SECURITY;

-- ============ CLASS SUBJECTS (teacher assignment) ============
CREATE TABLE public.class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  teacher_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject, teacher_user_id)
);
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_class_subjects_class ON public.class_subjects(class_id);
CREATE INDEX idx_class_subjects_teacher ON public.class_subjects(teacher_user_id);

-- ============ CLASS STUDENTS ============
CREATE TABLE public.class_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_user_id)
);
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_class_students_class ON public.class_students(class_id);
CREATE INDEX idx_class_students_student ON public.class_students(student_user_id);

-- ============ STUDENT RESTRICTIONS (per class) ============
CREATE TABLE public.student_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL,
  restrict_croins BOOLEAN NOT NULL DEFAULT false,
  restrict_news BOOLEAN NOT NULL DEFAULT false,
  restrict_newspaper BOOLEAN NOT NULL DEFAULT false,
  restrict_other BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_user_id)
);
ALTER TABLE public.student_restrictions ENABLE ROW LEVEL SECURITY;

-- ============ HELPER FUNCTIONS (security definer, avoid recursive RLS) ============
CREATE OR REPLACE FUNCTION public.get_school_role(_uid UUID)
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.school_members WHERE user_id = _uid LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_school_id(_uid UUID)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT school_id FROM public.school_members WHERE user_id = _uid LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_principal_of(_uid UUID, _school UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_members
    WHERE user_id = _uid AND school_id = _school AND role = 'principal'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_class(_uid UUID, _class UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_subjects WHERE class_id = _class AND teacher_user_id = _uid
  )
$$;

CREATE OR REPLACE FUNCTION public.is_in_class(_uid UUID, _class UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_students WHERE class_id = _class AND student_user_id = _uid
  ) OR public.is_teacher_of_class(_uid, _class)
$$;

CREATE OR REPLACE FUNCTION public.is_owner_email()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'email') IN ('cross.a.trix.owner@hotmail.com', 'moritz.loeseke7@gmail.com')
$$;

-- ============ RLS POLICIES ============

-- schools: principal can read own school; owner reads all; principal updates own school
CREATE POLICY "Principal reads own school" ON public.schools
  FOR SELECT TO authenticated
  USING (principal_user_id = auth.uid() OR public.is_owner_email() OR id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Owner updates schools" ON public.schools
  FOR UPDATE TO authenticated
  USING (public.is_owner_email());

-- school_members: any member of same school can read members of their school
CREATE POLICY "Members read same school members" ON public.school_members
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.is_owner_email());

-- school_classes: any member of school can read classes
CREATE POLICY "Members read classes" ON public.school_classes
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.is_owner_email());

-- class_subjects: members can read
CREATE POLICY "Members read class_subjects" ON public.class_subjects
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.school_classes c WHERE c.id = class_id AND c.school_id = public.get_user_school_id(auth.uid()))
    OR public.is_owner_email()
  );

-- class_students
CREATE POLICY "Members read class_students" ON public.class_students
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.school_classes c WHERE c.id = class_id AND c.school_id = public.get_user_school_id(auth.uid()))
    OR public.is_owner_email()
  );

-- student_restrictions: student reads own; teacher of class reads/writes; owner reads all
CREATE POLICY "Read student restrictions" ON public.student_restrictions
  FOR SELECT TO authenticated
  USING (
    student_user_id = auth.uid()
    OR public.is_teacher_of_class(auth.uid(), class_id)
    OR public.is_owner_email()
  );

CREATE POLICY "Teacher writes restrictions insert" ON public.student_restrictions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_teacher_of_class(auth.uid(), class_id));

CREATE POLICY "Teacher writes restrictions update" ON public.student_restrictions
  FOR UPDATE TO authenticated
  USING (public.is_teacher_of_class(auth.uid(), class_id));

CREATE POLICY "Teacher writes restrictions delete" ON public.student_restrictions
  FOR DELETE TO authenticated
  USING (public.is_teacher_of_class(auth.uid(), class_id));

-- updated_at triggers
CREATE TRIGGER trg_schools_updated BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_restrictions_updated BEFORE UPDATE ON public.student_restrictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
