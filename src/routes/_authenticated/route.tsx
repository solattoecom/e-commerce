import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // A sessão pode ainda estar sendo restaurada do armazenamento local
    // logo após um recarregamento: tentamos algumas vezes antes de desistir.
    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return { user: data.session.user };
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw redirect({ to: "/" });
  },
  component: () => <Outlet />,
});
