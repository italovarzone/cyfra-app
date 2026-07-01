"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/lib/types";

type Recent = SearchResult & { at: number };

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<Recent[]>([]);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem("cyfra:recents") || "[]");
      if (Array.isArray(r)) setRecents(r);
    } catch {}
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = setTimeout(async () => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: ctrl.current.signal,
        });
        const data = await res.json();
        setResults(data.results || []);
        setError(data.error || null);
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("Falha na busca.");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const cifraHref = (r: SearchResult) =>
    `/cifra?a=${encodeURIComponent(r.artistSlug)}&s=${encodeURIComponent(
      r.songSlug
    )}&artist=${encodeURIComponent(r.artist)}&song=${encodeURIComponent(
      r.song
    )}`;

  const showList = q.trim().length >= 2 ? results : [];
  const showRecents = q.trim().length < 2 && recents.length > 0;

  async function logout() {
    try {
      await fetch("/api/login", { method: "DELETE" });
    } catch {}
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 px-4 pb-3 pt-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            Cyfra<span className="text-accent">.</span>
          </h1>
          <button
            onClick={logout}
            className="rounded-lg px-2 py-1 text-xs text-muted active:text-white"
          >
            Sair
          </button>
        </div>
        <div className="relative">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            inputMode="search"
            placeholder="Buscar música ou artista…"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 pr-10 text-base outline-none placeholder:text-muted focus:border-accent"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              aria-label="Limpar"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted active:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 px-2 py-2">
        {loading && (
          <p className="px-2 py-4 text-sm text-muted">Buscando…</p>
        )}
        {error && !loading && (
          <p className="px-2 py-4 text-sm text-red-400">{error}</p>
        )}

        {showRecents && (
          <section>
            <div className="flex items-center justify-between px-2 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Recentes
              </h2>
              <button
                onClick={() => {
                  localStorage.removeItem("cyfra:recents");
                  setRecents([]);
                }}
                className="text-xs text-muted active:text-white"
              >
                limpar
              </button>
            </div>
            <ul>
              {recents.map((r) => (
                <SongRow key={r.artistSlug + r.songSlug} r={r} href={cifraHref(r)} />
              ))}
            </ul>
          </section>
        )}

        {!loading && showList.length > 0 && (
          <ul>
            {showList.map((r) => (
              <SongRow
                key={r.artistSlug + r.songSlug}
                r={r}
                href={cifraHref(r)}
              />
            ))}
          </ul>
        )}

        {!loading &&
          !error &&
          q.trim().length >= 2 &&
          showList.length === 0 && (
            <p className="px-2 py-8 text-center text-sm text-muted">
              Nenhum resultado para “{q.trim()}”.
            </p>
          )}

        {!showRecents && q.trim().length < 2 && (
          <div className="px-4 py-16 text-center text-sm text-muted">
            <p className="mb-1 text-4xl">🎸</p>
            <p>Digite o nome de uma música ou artista para começar.</p>
          </div>
        )}
      </div>
    </main>
  );
}

function SongRow({ r, href }: { r: SearchResult; href: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-xl px-2 py-2.5 active:bg-surface"
      >
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-surface2">
          {r.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.image}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted">
              ♪
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">{r.song}</p>
          <p className="truncate text-sm text-muted">{r.artist}</p>
        </div>
        <span className="text-muted">›</span>
      </Link>
    </li>
  );
}
