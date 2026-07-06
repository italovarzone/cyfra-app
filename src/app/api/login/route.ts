import { NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE, signSession } from "@/lib/auth";
import { verifyCredentials } from "@/lib/credentials";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let user = "";
  let pass = "";
  try {
    const body = await req.json();
    user = String(body?.user ?? "");
    pass = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (!process.env.MONGODB_URI || !process.env.AUTH_SECRET) {
    return NextResponse.json(
      { error: "Login não configurado no servidor." },
      { status: 500 }
    );
  }

  const ok = await verifyCredentials(user, pass);
  if (!ok) {
    return NextResponse.json(
      { error: "Usuário ou senha inválidos." },
      { status: 401 }
    );
  }

  const token = await signSession(user);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}

// Logout: limpa o cookie.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
