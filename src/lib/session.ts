// Helper para ler o usuário autenticado dentro de Route Handlers (runtime Node).
import { cookies } from "next/headers";
import { AUTH_COOKIE, verifySession } from "./auth";

export async function getSessionUser(): Promise<string | null> {
  const token = cookies().get(AUTH_COOKIE)?.value;
  return verifySession(token);
}
