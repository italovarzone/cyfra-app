import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, sessionToken } from "@/lib/auth";

// Rotas liberadas sem login.
const PUBLIC_PATHS = ["/login", "/api/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const expected = await sessionToken();
  const token = req.cookies.get(AUTH_COOKIE)?.value;

  // Se as envs não estiverem configuradas, expected é null e o acesso é
  // bloqueado para evitar deixar o app aberto por engano.
  if (expected && token === expected) {
    return NextResponse.next();
  }

  // Requisições de API respondem 401 em vez de redirecionar.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

// Aplica em tudo, menos assets estáticos, ícones, manifest e service worker.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon-192.png|icon-512.png|icon-maskable-512.png).*)",
  ],
};
