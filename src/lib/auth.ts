// Autenticação simples baseada em usuário/senha únicos definidos por env
// (APP_USER / APP_PASSWORD). Funciona tanto no runtime Edge (middleware)
// quanto no Node (rotas de API), pois usa apenas Web Crypto.

export const AUTH_COOKIE = "cyfra_auth";
// 30 dias
export const AUTH_MAX_AGE = 60 * 60 * 24 * 30;

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Token de sessão determinístico derivado das credenciais.
 * Guardamos o hash no cookie (nunca a senha em texto puro); o middleware
 * recomputa o mesmo valor a partir das envs para validar a requisição.
 */
export async function sessionToken(): Promise<string | null> {
  const user = process.env.APP_USER;
  const pass = process.env.APP_PASSWORD;
  if (!user || !pass) return null;
  const data = new TextEncoder().encode(`${user}:${pass}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

/** Verifica se as credenciais informadas conferem com as envs. */
export function credentialsMatch(user: string, pass: string): boolean {
  return user === process.env.APP_USER && pass === process.env.APP_PASSWORD;
}
