import { NextRequest, NextResponse } from "next/server";
import type { Cifra, CifraLine, Token } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function tokenizeLine(raw: string): Token[] {
  const tokens: Token[] = [];
  // separa por <b>...</b> (acordes)
  const re = /<b>([\s\S]*?)<\/b>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) {
      tokens.push({ t: "text", v: decodeEntities(raw.slice(last, m.index)) });
    }
    const chord = decodeEntities(m[1]).trim();
    tokens.push({ t: "chord", v: chord, pad: chord.length });
    last = re.lastIndex;
  }
  if (last < raw.length) {
    tokens.push({ t: "text", v: decodeEntities(raw.slice(last)) });
  }
  return tokens;
}

function classify(raw: string, tokens: Token[]): CifraLine["type"] {
  const hasChord = tokens.some((t) => t.t === "chord");
  if (hasChord) return "chord";
  const plain = decodeEntities(raw).trim();
  if (!plain) return "blank";
  if (/^\[.*\]$/.test(plain)) return "section";
  return "text";
}

function extract(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? decodeEntities(m[1].replace(/<[^>]+>/g, "").trim()) : null;
}

export async function GET(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get("artist")?.trim();
  const song = req.nextUrl.searchParams.get("song")?.trim();
  if (!artist || !song) {
    return NextResponse.json({ error: "Parâmetros ausentes" }, { status: 400 });
  }

  const url = `https://www.cifraclub.com.br/${encodeURIComponent(
    artist,
  )}/${encodeURIComponent(song)}/`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "text/html",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`cifraclub ${res.status}`);
    let html = await res.text();

    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (!preMatch) {
      return NextResponse.json(
        { error: "Cifra não encontrada nesta página." },
        { status: 404 },
      );
    }

    // remove links/tags dentro do <pre>, preservando apenas <b> (acordes)
    let pre = preMatch[1]
      .replace(/<a\b[^>]*>/gi, "")
      .replace(/<\/a>/gi, "")
      .replace(/<span[^>]*>/gi, "")
      .replace(/<\/span>/gi, "");

    const lines: CifraLine[] = pre.split("\n").map((raw) => {
      const tokens = tokenizeLine(raw);
      return { type: classify(raw, tokens), tokens };
    });

    // remove linhas em branco no início/fim
    while (lines.length && lines[0].type === "blank") lines.shift();
    while (lines.length && lines[lines.length - 1].type === "blank")
      lines.pop();

    const title =
      extract(html, /<h1[^>]*class="t1"[^>]*>([\s\S]*?)<\/h1>/i) ??
      decodeEntities(song).replace(/-/g, " ");
    const artistName =
      extract(html, /<h2[^>]*class="t3"[^>]*>([\s\S]*?)<\/h2>/i) ??
      decodeEntities(artist).replace(/-/g, " ");

    // tom: dentro de id="cifra_tom" pega o primeiro <a>...</a>
    let tom: string | null = null;
    const tomBlock = html.match(/id="cifra_tom"[^>]*>([\s\S]*?)<\/span>/i);
    if (tomBlock) {
      const a = tomBlock[1].match(/<a[^>]*>([\s\S]*?)<\/a>/i);
      if (a) tom = decodeEntities(a[1].replace(/<[^>]+>/g, "").trim());
    }

    const capoBlock = html.match(/capotraste[^<]*<[^>]*>([^<]+)/i);
    const capo = capoBlock ? decodeEntities(capoBlock[1].trim()) : null;

    const cifra: Cifra = {
      title,
      artist: artistName,
      tom,
      capo,
      url,
      lines,
    };
    return NextResponse.json(cifra);
  } catch (err) {
    return NextResponse.json(
      { error: "Não foi possível carregar a cifra." },
      { status: 502 },
    );
  }
}
