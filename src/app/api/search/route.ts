import { NextRequest, NextResponse } from "next/server";
import type { SearchResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SolrDoc = {
  t: string; // "1" artista, "2" música
  art?: string;
  dns?: string;
  txt?: string;
  url?: string;
  imgm?: string;
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] as SearchResult[] });
  }

  try {
    const res = await fetch(
      `https://solr.sscdn.co/cifraclub/h/?q=${encodeURIComponent(q)}`,
      {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error(`solr ${res.status}`);
    const data = await res.json();
    const docs: SolrDoc[] = data?.response?.docs ?? [];

    const results: SearchResult[] = docs
      .filter((d) => d.t === "2" && d.dns && d.url && d.txt)
      .map((d) => ({
        artist: d.art ?? "",
        song: d.txt ?? "",
        artistSlug: d.dns as string,
        songSlug: d.url as string,
        image: d.imgm && d.imgm.startsWith("http") ? d.imgm : null,
      }))
      // remove duplicados (mesma música/artista)
      .filter(
        (r, i, arr) =>
          arr.findIndex(
            (x) => x.artistSlug === r.artistSlug && x.songSlug === r.songSlug
          ) === i
      )
      .slice(0, 30);

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { results: [], error: "Falha ao buscar. Tente novamente." },
      { status: 502 }
    );
  }
}
