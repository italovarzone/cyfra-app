// Verificação de usuário/senha contra o MongoDB. Módulo separado de
// lib/auth.ts (que o middleware importa em runtime Edge) porque depende do
// driver do MongoDB e do bcryptjs, que só funcionam em runtime Node.
import { getUsersCollection } from "./mongodb";

export async function verifyCredentials(
  user: string,
  pass: string,
): Promise<boolean> {
  if (!user || !pass) return false;
  const users = await getUsersCollection();
  const doc = await users.findOne({ username: user });
  if (!doc || typeof doc.passwordHash !== "string") return false;
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.compare(pass, doc.passwordHash);
}
