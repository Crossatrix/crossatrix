import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteStatus {
  disabled: boolean;
  loading: boolean;
}

// Reads the global site kill switch. When disabled, the whole app should refuse
// to work (except the admin toggle that can turn it back on).
export function useSiteEnabled(): SiteStatus {
  const [state, setState] = useState<SiteStatus>({ disabled: false, loading: true });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("disabled")
        .eq("id", 1)
        .maybeSingle();
      if (active) setState({ disabled: !!data?.disabled, loading: false });
    })();
    return () => {
      active = false;
    };
  }, []);

  return state;
}
