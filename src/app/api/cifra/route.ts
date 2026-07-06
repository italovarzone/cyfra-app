import { NextRequest, NextResponse } from "next/server";
import { CifraFetchError, fetchCifraFromCifraClub } from "@/lib/cifraFetch";
import { getCachedCifra, isDownloaded } from "@/lib/downloads";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get("artist")?.trim();
  const song = req.nextUrl.searchParams.get("song")?.trim();
  if (!artist || !song) {
    return NextResponse.json({ error: "Parâmetros ausentes" }, { status: 400 });
  }

  try {
    const cached = await getCachedCifra(artist, song);
    const cifra = cached ?? (await fetchCifraFromCifraClub(artist, song));

    const username = await getSessionUser();
    const downloaded = username
      ? await isDownloaded(username, artist, song)
      : false;

    return NextResponse.json({ ...cifra, downloaded });
  } catch (err) {
    if (err instanceof CifraFetchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Não foi possível carregar a cifra." },
      { status: 502 },
    );
  }
}
