import { useEffect, useState } from "react";

import { adminExists } from "@/lib/admin.functions";

/** Diz se a loja já possui um administrador definido. */
export function useAdminExists() {
  const [existe, setExiste] = useState<boolean | null>(null);

  useEffect(() => {
    let ativo = true;
    adminExists()
      .then((r) => {
        if (ativo) setExiste(r.exists);
      })
      .catch(() => {
        if (ativo) setExiste(true);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return { existe, loading: existe === null };
}
