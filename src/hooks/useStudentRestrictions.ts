import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StudentRestrictions {
  isStudent: boolean;
  croins: boolean;
  news: boolean;
  newspaper: boolean;
  other: boolean;
  loading: boolean;
}

export function useStudentRestrictions(userId: string | undefined): StudentRestrictions {
  const [state, setState] = useState<StudentRestrictions>({
    isStudent: false, croins: false, news: false, newspaper: false, other: false, loading: true,
  });

  useEffect(() => {
    if (!userId) { setState((s) => ({ ...s, loading: false })); return; }
    (async () => {
      const { data: member } = await supabase
        .from("school_members")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (!member || member.role !== "student") {
        setState({ isStudent: false, croins: false, news: false, newspaper: false, other: false, loading: false });
        return;
      }
      const { data: r } = await supabase
        .from("student_restrictions")
        .select("restrict_croins, restrict_news, restrict_newspaper, restrict_other")
        .eq("student_user_id", userId);
      const any = (k: keyof NonNullable<typeof r>[number]) =>
        (r || []).some((row: any) => row[k]);
      setState({
        isStudent: true,
        croins: any("restrict_croins"),
        news: any("restrict_news"),
        newspaper: any("restrict_newspaper"),
        other: any("restrict_other"),
        loading: false,
      });
    })();
  }, [userId]);

  return state;
}
