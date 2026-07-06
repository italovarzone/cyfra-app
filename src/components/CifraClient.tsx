"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Cifra, CifraLine, Token } from "@/lib/types";
import { transposeChord, simplifyChord } from "@/lib/chords";

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 22];

// ---------- paginação de impressão/PDF ----------
// Meta: caber em no máximo 2 folhas A4; se a música for grande demais mesmo
// diminuindo a fonte, deixa passar de 2, mas sempre em número par de páginas
// (pra montar pasta com folhas frente-e-verso por música).
const MM_TO_PX = 96 / 25.4;
const PAGE_MARGIN_MM = 14; // igual ao @page margin em globals.css
const USABLE_PAGE_PX = (297 - PAGE_MARGIN_MM * 2) * MM_TO_PX;
const PRINT_HEADER_PX = 40; // título/artista/tom, repetido em toda página
const PRINT_FOOTER_PX = 24; // "Página X de Y"
const PRINT_CAPO_PX = 26; // linha extra só na primeira página
const MIN_PRINT_FONT_PX = 8;
const LINE_HEIGHT_RATIO = 1.625; // Tailwind leading-relaxed

type PrintLayout = {
  fontPx: number;
  pages: CifraLine[][];
};

function chunkLinesForFont(
  visible: CifraLine[],
  fontPx: number,
  hasCapo: boolean,
): CifraLine[][] {
  const lineHeight = fontPx * LINE_HEIGHT_RATIO;
  const pages: CifraLine[][] = [];
  let i = 0;
  while (i < visible.length) {
    const extra = pages.length === 0 && hasCapo ? PRINT_CAPO_PX : 0;
    const budget = USABLE_PAGE_PX - PRINT_HEADER_PX - PRINT_FOOTER_PX - extra;
    const perPage = Math.max(1, Math.floor(budget / lineHeight));
    pages.push(visible.slice(i, i + perPage));
    i += perPage;
  }
  return pages.length ? pages : [[]];
}

function computePrintLayout(
  visible: CifraLine[],
  screenFontPx: number,
  hasCapo: boolean,
): PrintLayout {
  let fontPx = screenFontPx;
  let pages = chunkLinesForFont(visible, fontPx, hasCapo);

  while (pages.length > 2 && fontPx > MIN_PRINT_FONT_PX) {
    fontPx = Math.max(MIN_PRINT_FONT_PX, fontPx - 0.5);
    pages = chunkLinesForFont(visible, fontPx, hasCapo);
  }

  // música grande demais mesmo no tamanho mínimo: aceita passar de 2
  // páginas, mas fecha em número par
  if (pages.length > 2 && pages.length % 2 !== 0) {
    pages.push([]);
  }

  return { fontPx, pages };
}

export default function CifraClient() {
  const params = useSearchParams();
  const a = params.get("a") || "";
  const s = params.get("s") || "";
  const artistName = params.get("artist") || "";
  const songName = params.get("song") || "";

  const [cifra, setCifra] = useState<Cifra | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [semitones, setSemitones] = useState(0);
  const [simplified, setSimplified] = useState(false);
  const [hideChords, setHideChords] = useState(false);
  const [hideTab, setHideTab] = useState(false);
  const [fontIdx, setFontIdx] = useState(2);

  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(3);
  const [panel, setPanel] = useState(false);

  // carregar preferências de fonte
  useEffect(() => {
    const f = Number(localStorage.getItem("cyfra:font"));
    if (!Number.isNaN(f) && f >= 0 && f < FONT_SIZES.length) setFontIdx(f);
  }, []);
  useEffect(() => {
    localStorage.setItem("cyfra:font", String(fontIdx));
  }, [fontIdx]);

  // buscar cifra
  useEffect(() => {
    if (!a || !s) {
      setError("Música inválida.");
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/cifra?artist=${encodeURIComponent(a)}&song=${encodeURIComponent(s)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setError(data.error || "Erro ao carregar.");
        } else {
          setCifra(data);
          setDownloaded(!!data.downloaded);
          saveRecent({
            artist: data.artist || artistName,
            song: data.title || songName,
            artistSlug: a,
            songSlug: s,
            image: null,
          });
        }
      })
      .catch(() => alive && setError("Sem conexão."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [a, s]);

  // auto-scroll
  const rafRef = useRef<number | null>(null);
  const accRef = useRef(0);
  useEffect(() => {
    if (!scrolling) return;
    const step = () => {
      accRef.current += speed * 0.35;
      if (accRef.current >= 1) {
        const px = Math.floor(accRef.current);
        accRef.current -= px;
        window.scrollBy(0, px);
        const atBottom =
          window.innerHeight + window.scrollY >=
          document.body.scrollHeight - 2;
        if (atBottom) {
          setScrolling(false);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrolling, speed]);

  const transform = useCallback(
    (chord: string) => {
      let c = chord;
      if (semitones) c = transposeChord(c, semitones);
      if (simplified) c = simplifyChord(c);
      return c;
    },
    [semitones, simplified]
  );

  const currentTom = useMemo(() => {
    if (!cifra?.tom) return null;
    return semitones ? transposeChord(cifra.tom, semitones) : cifra.tom;
  }, [cifra?.tom, semitones]);

  const fontSize = FONT_SIZES[fontIdx];

  const printLayout = useMemo(() => {
    if (!cifra) return null;
    const visible = cifra.lines.filter(
      (l) =>
        !((l.type === "chord" && hideChords) || (l.type === "tab" && hideTab)),
    );
    return computePrintLayout(visible, fontSize, !!cifra.capo);
  }, [cifra, hideChords, hideTab, fontSize]);

  async function handleDownload() {
    if (downloaded || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistSlug: a, songSlug: s }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao baixar.");
      setDownloaded(true);
    } catch (e: any) {
      setDownloadError(e?.message || "Falha ao baixar.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <CenterMsg>Carregando cifra…</CenterMsg>;
  }
  if (error || !cifra) {
    return (
      <CenterMsg>
        <p className="mb-4 text-red-400">{error || "Erro."}</p>
        <Link href="/" className="rounded-lg bg-surface2 px-4 py-2 text-sm">
          ← Voltar
        </Link>
      </CenterMsg>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl pb-40 print:pb-0">
      {/* topo */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-bg/95 px-3 py-2 backdrop-blur print:hidden">
        <Link
          href="/"
          aria-label="Voltar"
          className="rounded-lg px-2 py-1.5 text-lg active:bg-surface"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{cifra.title}</p>
          <p className="truncate text-xs text-muted">{cifra.artist}</p>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {currentTom && (
            <span className="rounded-md bg-surface2 px-2 py-1 text-muted">
              Tom <span className="text-accent">{currentTom}</span>
            </span>
          )}
          <button
            onClick={handleDownload}
            disabled={downloading}
            aria-label={downloaded ? "Baixada" : "Baixar"}
            title={downloaded ? "Já baixada" : "Baixar cifra"}
            className={`rounded-md px-2 py-1 text-base active:bg-surface disabled:opacity-40 ${
              downloaded ? "text-accent" : "text-muted"
            }`}
          >
            {downloading ? "…" : downloaded ? "☁✓" : "☁"}
          </button>
          <button
            onClick={() => window.print()}
            aria-label="Exportar PDF"
            title="Exportar PDF"
            className="rounded-md px-2 py-1 text-xs text-muted active:bg-surface"
          >
            PDF
          </button>
        </div>
      </header>
      {downloadError && (
        <p className="px-4 pt-2 text-xs text-red-400 print:hidden">
          {downloadError}
        </p>
      )}

      {cifra.capo && (
        <p className="px-4 pt-3 text-xs text-muted print:hidden">
          Capotraste: <span className="text-white">{cifra.capo}</span>
        </p>
      )}

      {/* cifra (tela): rolagem contínua, não entra na impressão */}
      <div className="overflow-x-auto px-4 py-4 print:hidden">
        <div
          className="cifra-pre font-mono leading-relaxed"
          style={{ fontSize }}
        >
          {cifra.lines.map((line, i) => (
            <LineView
              key={i}
              line={line}
              transform={transform}
              hideChords={hideChords}
              hideTab={hideTab}
            />
          ))}
        </div>
      </div>

      {/* cifra (impressão/PDF): paginada, com cabeçalho e numeração próprios,
          sem links — só informação da música, pensado pra montar pasta */}
      {printLayout && (
        <div className="cifra-print hidden print:block">
          {printLayout.pages.map((pageLines, pageIdx) => (
            <div
              key={pageIdx}
              style={{
                breakAfter:
                  pageIdx < printLayout.pages.length - 1 ? "page" : "auto",
                pageBreakAfter:
                  pageIdx < printLayout.pages.length - 1 ? "always" : "auto",
              }}
            >
              <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-black/30 pb-1 font-sans text-xs">
                <span className="font-semibold">
                  {cifra.title} — {cifra.artist}
                  {currentTom ? ` — Tom ${currentTom}` : ""}
                </span>
              </div>
              {pageIdx === 0 && cifra.capo && (
                <p className="mb-2 font-sans text-xs">
                  Capotraste: {cifra.capo}
                </p>
              )}
              <div className="cifra-pre font-mono leading-relaxed" style={{ fontSize: printLayout.fontPx }}>
                {pageLines.map((line, i) => (
                  <LineView
                    key={i}
                    line={line}
                    transform={transform}
                    hideChords={hideChords}
                    hideTab={hideTab}
                  />
                ))}
              </div>
              <div className="mt-2 border-t border-black/30 pt-1 text-right font-sans text-xs">
                Página {pageIdx + 1} de {printLayout.pages.length}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* barra de controle inferior */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-2xl print:hidden">
        {panel && (
          <div className="mx-2 mb-2 rounded-2xl border border-border bg-surface/95 p-3 shadow-xl backdrop-blur">
            <Row label="Tom">
              <Stepper
                onMinus={() => setSemitones((v) => v - 1)}
                onPlus={() => setSemitones((v) => v + 1)}
                value={
                  semitones === 0
                    ? "original"
                    : (semitones > 0 ? "+" : "") + semitones
                }
                onReset={semitones !== 0 ? () => setSemitones(0) : undefined}
              />
            </Row>
            <Row label="Fonte">
              <Stepper
                onMinus={() => setFontIdx((v) => Math.max(0, v - 1))}
                onPlus={() =>
                  setFontIdx((v) => Math.min(FONT_SIZES.length - 1, v + 1))
                }
                value={`${fontSize}px`}
              />
            </Row>
            <Row label="Velocidade">
              <Stepper
                onMinus={() => setSpeed((v) => Math.max(1, v - 1))}
                onPlus={() => setSpeed((v) => Math.min(10, v + 1))}
                value={`${speed}`}
              />
            </Row>
            <div className="mt-1 flex gap-2">
              <Toggle
                active={simplified}
                onClick={() => setSimplified((v) => !v)}
              >
                Simplificada
              </Toggle>
              <Toggle
                active={hideChords}
                onClick={() => setHideChords((v) => !v)}
              >
                Só letra
              </Toggle>
              <Toggle active={hideTab} onClick={() => setHideTab((v) => !v)}>
                Ocultar tablatura
              </Toggle>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-border bg-bg/95 px-3 py-2 backdrop-blur">
          <button
            onClick={() => setScrolling((v) => !v)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-3 font-semibold text-black active:opacity-80"
          >
            {scrolling ? "⏸ Pausar" : "▶ Rolar"}
          </button>
          <button
            onClick={() => setPanel((v) => !v)}
            aria-label="Ajustes"
            className={`rounded-xl border border-border px-4 py-3 active:bg-surface ${
              panel ? "bg-surface text-accent" : "bg-surface2"
            }`}
          >
            ⚙︎
          </button>
        </div>
      </div>
    </main>
  );
}

/* ---------- renderização de uma linha ---------- */

function LineView({
  line,
  transform,
  hideChords,
  hideTab,
}: {
  line: CifraLine;
  transform: (c: string) => string;
  hideChords: boolean;
  hideTab: boolean;
}) {
  if (line.type === "blank") return <div>{" "}</div>;

  if (line.type === "section") {
    const text = line.tokens.map((t) => t.v).join("");
    return <div className="font-sans font-semibold text-accent/90">{text}</div>;
  }

  if (line.type === "tab") {
    if (hideTab) return null;
    const text = line.tokens.map((t) => t.v).join("");
    return <div className="text-muted">{text || " "}</div>;
  }

  if (line.type === "text") {
    const text = line.tokens.map((t) => t.v).join("");
    return <div>{text || " "}</div>;
  }

  // linha de acordes (com re-alinhamento após transpor/simplificar)
  if (hideChords) return null;

  const out: React.ReactNode[] = [];
  let carry = 0;
  line.tokens.forEach((tok, idx) => {
    if (tok.t === "text") {
      let v = tok.v;
      if (carry > 0) {
        const lead = v.match(/^ */)?.[0].length ?? 0;
        const remove = Math.min(carry, lead);
        v = v.slice(remove);
        carry -= remove;
      }
      out.push(<span key={idx}>{v}</span>);
    } else {
      let v = transform(tok.v);
      const orig = (tok as Extract<Token, { t: "chord" }>).pad;
      if (v.length > orig) {
        carry += v.length - orig;
      } else if (v.length < orig) {
        v = v + " ".repeat(orig - v.length);
      }
      out.push(
        <span key={idx} className="font-bold text-chord">
          {v}
        </span>
      );
    }
  });
  return <div>{out}</div>;
}

/* ---------- UI helpers ---------- */

function CenterMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center text-muted">
      {children}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </div>
  );
}

function Stepper({
  onMinus,
  onPlus,
  value,
  onReset,
}: {
  onMinus: () => void;
  onPlus: () => void;
  value: string;
  onReset?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {onReset && (
        <button
          onClick={onReset}
          className="rounded-md px-2 py-1 text-xs text-muted active:text-white"
        >
          reset
        </button>
      )}
      <button
        onClick={onMinus}
        className="h-9 w-9 rounded-lg bg-surface2 text-lg active:bg-border"
      >
        −
      </button>
      <span className="min-w-[64px] text-center text-sm tabular-nums">
        {value}
      </span>
      <button
        onClick={onPlus}
        className="h-9 w-9 rounded-lg bg-surface2 text-lg active:bg-border"
      >
        +
      </button>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl border px-3 py-2 text-sm active:opacity-80 ${
        active
          ? "border-accent bg-accent/15 text-accent"
          : "border-border bg-surface2 text-muted"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------- recentes ---------- */

function saveRecent(item: {
  artist: string;
  song: string;
  artistSlug: string;
  songSlug: string;
  image: string | null;
}) {
  try {
    const key = "cyfra:recents";
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    const filtered = (Array.isArray(list) ? list : []).filter(
      (x: any) =>
        !(x.artistSlug === item.artistSlug && x.songSlug === item.songSlug)
    );
    filtered.unshift({ ...item, at: Date.now() });
    localStorage.setItem(key, JSON.stringify(filtered.slice(0, 15)));
  } catch {}
}
