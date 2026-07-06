// Busca e parseia uma cifra a partir do CifraClub. Compartilhado entre a
// rota de visualização e a de download (que persiste o resultado no Mongo).
import type { Cifra, CifraLine, Token } from "./types";

export class CifraFetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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

export async function fetchCifraFromCifraClub(
  artistSlug: string,
  songSlug: string,
): Promise<Cifra> {
  const url = `https://www.cifraclub.com.br/${encodeURIComponent(
    artistSlug,
  )}/${encodeURIComponent(songSlug)}/`;

  let html: string;
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
    html = await res.text();
  } catch {
    throw new CifraFetchError("Não foi possível carregar a cifra.", 502);
  }

  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (!preMatch) {
    throw new CifraFetchError("Cifra não encontrada nesta página.", 404);
  }

  // marca o diagrama de 6 cordas (dentro de <span class="cnt">) antes de
  // remover as tags, para poder ocultá-lo separadamente dos acordes/letra
  const TAB_START = "\u0001TAB\u0001";
  const TAB_END = "\u0001/TAB\u0001";
  let pre = preMatch[1].replace(
    /<span class="cnt">([\s\S]*?)<\/span>/g,
    (_, inner: string) => `${TAB_START}${inner}${TAB_END}`,
  );

  // remove links/tags dentro do <pre>, preservando apenas <b> (acordes)
  pre = pre
    .replace(/<a\b[^>]*>/gi, "")
    .replace(/<\/a>/gi, "")
    .replace(/<span[^>]*>/gi, "")
    .replace(/<\/span>/gi, "");

  let inTab = false;
  const lines: CifraLine[] = pre.split("\n").map((raw) => {
    let isTab = inTab;
    if (raw.includes(TAB_START)) {
      isTab = true;
      inTab = true;
    }
    if (raw.includes(TAB_END)) {
      isTab = true;
      inTab = false;
    }
    const clean = raw.split(TAB_START).join("").split(TAB_END).join("");
    const tokens = tokenizeLine(clean);
    return { type: isTab ? "tab" : classify(clean, tokens), tokens };
  });

  // remove linhas em branco no início/fim
  while (lines.length && lines[0].type === "blank") lines.shift();
  while (lines.length && lines[lines.length - 1].type === "blank")
    lines.pop();

  const title =
    extract(html, /<h1[^>]*class="t1"[^>]*>([\s\S]*?)<\/h1>/i) ??
    decodeEntities(songSlug).replace(/-/g, " ");
  const artistName =
    extract(html, /<h2[^>]*class="t3"[^>]*>([\s\S]*?)<\/h2>/i) ??
    decodeEntities(artistSlug).replace(/-/g, " ");

  // tom: dentro de id="cifra_tom" pega o primeiro <a>...</a>
  let tom: string | null = null;
  const tomBlock = html.match(/id="cifra_tom"[^>]*>([\s\S]*?)<\/span>/i);
  if (tomBlock) {
    const a = tomBlock[1].match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    if (a) tom = decodeEntities(a[1].replace(/<[^>]+>/g, "").trim());
  }

  const capoBlock = html.match(/capotraste[^<]*<[^>]*>([^<]+)/i);
  const capo = capoBlock ? decodeEntities(capoBlock[1].trim()) : null;

  return { title, artist: artistName, tom, capo, url, lines };
}
