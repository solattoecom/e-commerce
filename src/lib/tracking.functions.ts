import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";

export type TrackingEvent = {
  descricao: string;
  data: string;
  local?: string;
};

type METrackingEvent = {
  description?: string;
  message?: string;
  created_at?: string;
  location?: string | { city?: string; state?: string };
};

type METrackingItem = {
  events?: METrackingEvent[];
};

type METrackingResponse = Record<string, METrackingItem>;

type GetTrackingInput = { me_order_id: string };
type GetTrackingByCodeInput = { codigo: string };

type LinketrackTrilha = {
  data?: string;
  hora?: string;
  local?: string;
  status?: string;
};

export const getTrackingByCode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GetTrackingByCodeInput) => input)
  .handler(async ({ data }): Promise<TrackingEvent[]> => {
    const user  = process.env["LINKETRACK_USER"]  ?? "teste";
    const token = process.env["LINKETRACK_TOKEN"] ?? "1abcd00b2731640422a9df9d9bca0ef9c67fce47e0c272e5ab42b09e4b16f19e";

    try {
      const url = `https://api.linketrack.com/track/json?user=${encodeURIComponent(user)}&token=${encodeURIComponent(token)}&codigo=${encodeURIComponent(data.codigo)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return [];

      const json = (await res.json()) as { trilha?: LinketrackTrilha[] };
      if (!json.trilha?.length) return [];

      return json.trilha.map((t): TrackingEvent => ({
        descricao: t.status ?? "Evento de rastreio",
        data: t.data && t.hora ? `${t.data} ${t.hora}` : (t.data ?? ""),
        ...(t.local ? { local: t.local } : {}),
      }));
    } catch {
      return [];
    }
  });

export const getTrackingEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GetTrackingInput) => input)
  .handler(async ({ data }): Promise<TrackingEvent[]> => {
    const token = process.env["MELHOR_ENVIO_TOKEN"];
    if (!token) return [];

    try {
      const res = await fetch(
        `https://melhorenvio.com.br/api/v2/me/shipment/tracking?orders[]=${encodeURIComponent(data.me_order_id)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "User-Agent": "solatto/1.0 (solattoecom@gmail.com)",
          },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!res.ok) {
        console.log("[tracking-me] status:", res.status);
        return [];
      }

      const responseData = (await res.json()) as METrackingResponse;
      console.log("[tracking-me] raw:", JSON.stringify(responseData).slice(0, 500));
      const item = responseData[data.me_order_id];
      console.log("[tracking-me] item:", JSON.stringify(item).slice(0, 300));
      if (!item?.events || item.events.length === 0) return [];

      return item.events
        .map((e): TrackingEvent => {
          const descricao = e.description ?? e.message ?? "Evento de rastreio";
          const dataFormatada = e.created_at
            ? new Date(e.created_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";
          let local: string | undefined;
          if (e.location) {
            if (typeof e.location === "string") {
              local = e.location;
            } else if (e.location.city) {
              local = e.location.state
                ? `${e.location.city}/${e.location.state}`
                : e.location.city;
            }
          }
          const result: TrackingEvent = { descricao, data: dataFormatada };
          if (local) result.local = local;
          return result;
        })
        .reverse(); // mais recente no topo
    } catch {
      return [];
    }
  });
