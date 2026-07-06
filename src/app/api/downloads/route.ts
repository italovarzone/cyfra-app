import { NextRequest, NextResponse } from "next/server";
import { CifraFetchError } from "@/lib/cifraFetch";
import { addDownload, listDownloads, removeDownload } from "@/lib/downloads";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const username = await getSessionUser();
  if (!username) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const downloads = await listDownloads(username);
  return NextResponse.json({ downloads });
}

export async function POST(req: NextRequest) {
  const username = await getSessionUser();
  if (!username) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let artistSlug = "";
  let songSlug = "";
  try {
    const body = await req.json();
    artistSlug = String(body?.artistSlug ?? "");
    songSlug = String(body?.songSlug ?? "");
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  if (!artistSlug || !songSlug) {
    return NextResponse.json({ error: "Parâmetros ausentes." }, { status: 400 });
  }

  try {
    const download = await addDownload(username, artistSlug, songSlug);
    return NextResponse.json({ ok: true, download });
  } catch (err) {
    if (err instanceof CifraFetchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Não foi possível baixar a cifra." },
      { status: 502 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const username = await getSessionUser();
  if (!username) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const artistSlug = req.nextUrl.searchParams.get("artistSlug")?.trim();
  const songSlug = req.nextUrl.searchParams.get("songSlug")?.trim();
  if (!artistSlug || !songSlug) {
    return NextResponse.json({ error: "Parâmetros ausentes." }, { status: 400 });
  }

  await removeDownload(username, artistSlug, songSlug);
  return NextResponse.json({ ok: true });
}
