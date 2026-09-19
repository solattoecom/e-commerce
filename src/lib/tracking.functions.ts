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
  status?: string;
  tracking?: string;
  delivered_at?: string | null;
  events?: METrackingEvent[];
};

type METrackingResponse = Record<string, METrackingItem>;

export type TrackingResult = { events: TrackingEvent[]; status: string | null };

type GetTrackingInput = { me_order_id: string };
type GetTrackingByCodeInput = { codigo: string };

type CorreiosEvento = {
  descricao?: string;
  tipo?: string;
  detalhe?: string;
  unidade?: { endereco?: { cidade?: string; uf?: string } };
  dtHrCriado?: string;
};

export const getTrackingByCode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GetTrackingByCodeInput) => input)
  .handler(async ({ data }): Promise<TrackingEvent[]> => {
    try {
      const res = await fetch(
        `https://proxyapp.correios.com.br/v1/sro-rastro/${encodeURIComponent(data.codigo)}`,
        {
          headers: { Accept: "application/json", "User-Agent": "solatto/1.0 (solattoecom@gmail.com)" },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!res.ok) return [];

      const json = (await res.json()) as {
        objeto?: { evento?: CorreiosEvento[] }[];
      };
      const eventos = json.objeto?.[0]?.evento ?? [];
      if (!eventos.length) return [];

      return eventos.map((e): TrackingEvent => {
        const cidade = e.unidade?.endereco?.cidade;
        const uf = e.unidade?.endereco?.uf;
        const local = cidade ? (uf ? `${cidade}/${uf}` : cidade) : undefined;
        return {
          descricao: e.descricao ?? e.detalhe ?? "Evento de rastreio",
          data: e.dtHrCriado
            ? new Date(e.dtHrCriado).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
            : "",
          ...(local ? { local } : {}),
        };
      });
    } catch {
      return [];
    }
  });

function normalizarStatusME(status: string): string {
  if (!status) return "";
  if (status === "with_carrier" || status === "in transit" || status === "in-transit") return "in_transit";
  if (status === "delivered" || status === "entregue") return "delivered";
  if (status === "posted" || status === "postado") return "posted";
  if (status === "undelivered") return "undelivered";
  return status;
}

export const getTrackingEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GetTrackingInput) => input)
  .handler(async ({ data }): Promise<TrackingResult> => {
    const token = process.env["MELHOR_ENVIO_TOKEN"];
    if (!token) return { events: [], status: null };

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

      if (!res.ok) return { events: [], status: null };

      const responseData = (await res.json()) as METrackingResponse;
      const item = responseData[data.me_order_id];
      if (!item) return { events: [], status: null };

      const status = normalizarStatusME(item.status?.toLowerCase() ?? "");

      if (item.events && item.events.length > 0) {
        const events = item.events
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
          .reverse();
        return { events, status: status || null };
      }

      return { events: [], status: status || null };
    } catch {
      return { events: [], status: null };
    }
  });
