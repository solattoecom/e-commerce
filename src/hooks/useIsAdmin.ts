import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin(userId: string | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .rpc("has_role", { _user_id: userId, _role: "admin" })
      .then(({ data }) => {
        if (!active) return;
        setIsAdmin(data === true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return { isAdmin, loading };
}
