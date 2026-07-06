// Autenticação: usuário/senha ficam no MongoDB (coleção "user" do banco
// "dbcyfra", ver scripts/create-user.mjs). A sessão é um token assinado por
// HMAC-SHA256 (AUTH_SECRET) via Web Crypto, verificável tanto no runtime
// Node (rotas de API) quanto no runtime Edge (middleware) sem tocar o banco.

export const AUTH_COOKIE = "cyfra_auth";
// 30 dias
export const AUTH_MAX_AGE = 60 * 60 * 24 * 30;

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Assina uma sessão para o usuário informado. Retorna null se AUTH_SECRET não estiver configurado. */
export async function signSession(username: string): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const payload = JSON.stringify({
    u: username,
    exp: Date.now() + AUTH_MAX_AGE * 1000,
  });
  const payloadB64 = toBase64Url(new TextEncoder().encode(payload));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64),
  );
  return `${payloadB64}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Verifica a sessão; retorna o usuário autenticado ou null se inválida/expirada. */
export async function verifySession(
  token: string | undefined | null,
): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !token) return null;

  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;

  try {
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(sigB64),
      new TextEncoder().encode(payloadB64),
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payloadB64)),
    ) as { u: string; exp: number };

    if (!payload.u || !payload.exp || Date.now() > payload.exp) return null;
    return payload.u;
  } catch {
    return null;
  }
}
