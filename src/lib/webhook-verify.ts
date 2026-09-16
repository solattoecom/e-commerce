export async function verifyHmacSha256(
  rawBody: string,
  secret: string,
  receivedSig: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const expected = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const received = receivedSig.replace(/^sha256=/, "").toLowerCase();

    if (expected.length !== received.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export function validateTimestamp(timestampSeconds: number, maxAgeSeconds = 300): boolean {
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - timestampSeconds) <= maxAgeSeconds;
}
