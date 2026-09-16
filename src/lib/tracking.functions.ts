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

      if (!res.ok) return [];

      const responseData = (await res.json()) as METrackingResponse;
      const item = responseData[data.me_order_id];
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
