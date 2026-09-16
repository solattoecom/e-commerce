type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, context: string, message: string, data?: unknown) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    ctx: context,
    msg: message,
    ...(data !== undefined ? { data } : {}),
  };
  if (level === "error") console.error(JSON.stringify(entry));
  else if (level === "warn") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

export const logger = {
  info:  (ctx: string, msg: string, data?: unknown) => log("info",  ctx, msg, data),
  warn:  (ctx: string, msg: string, data?: unknown) => log("warn",  ctx, msg, data),
  error: (ctx: string, msg: string, data?: unknown) => log("error", ctx, msg, data),
};
