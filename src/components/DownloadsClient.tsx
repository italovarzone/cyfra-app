"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "./BottomNav";

type Download = {
  artistSlug: string;
  songSlug: string;
  title: string;
  artist: string;
  downloadedAt: string;
};

export default function DownloadsClient() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/downloads")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Falha ao carregar.");
        setDownloads(data.downloads || []);
      })
      .catch((e) => setError(e.message || "Falha ao carregar."))
      .finally(() => setLoading(false));
  }, []);

  async function handleRemove(d: Download) {
    const key = d.artistSlug + d.songSlug;
    setRemoving(key);
    try {
      await fetch(
        `/api/downloads?artistSlug=${encodeURIComponent(
          d.artistSlug,
        )}&songSlug=${encodeURIComponent(d.songSlug)}`,
        { method: "DELETE" },
      );
      setDownloads((prev) =>
        prev.filter((x) => x.artistSlug + x.songSlug !== key),
      );
    } finally {
      setRemoving(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col pb-20">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 px-4 pb-3 pt-4 backdrop-blur">
        <h1 className="text-xl font-bold tracking-tight">Meus downloads</h1>
      </header>

      <div className="flex-1 px-2 py-2">
        {loading && <p className="px-2 py-4 text-sm text-muted">Carregando…</p>}
        {error && !loading && (
          <p className="px-2 py-4 text-sm text-red-400">{error}</p>
        )}

        {!loading && !error && downloads.length === 0 && (
          <div className="px-4 py-16 text-center text-sm text-muted">
            <p className="mb-1 text-4xl">☁</p>
            <p>Nenhuma cifra baixada ainda.</p>
          </div>
        )}

        {!loading && downloads.length > 0 && (
          <ul>
            {downloads.map((d) => {
              const key = d.artistSlug + d.songSlug;
              const href = `/cifra?a=${encodeURIComponent(
                d.artistSlug,
              )}&s=${encodeURIComponent(d.songSlug)}&artist=${encodeURIComponent(
                d.artist,
              )}&song=${encodeURIComponent(d.title)}`;
              return (
                <li key={key} className="flex items-center gap-2">
                  <Link
                    href={href}
                    className="flex flex-1 items-center gap-3 rounded-xl px-2 py-2.5 active:bg-surface"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface2 text-muted">
                      ♪
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium leading-tight">
                        {d.title}
                      </p>
                      <p className="truncate text-sm text-muted">{d.artist}</p>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleRemove(d)}
                    disabled={removing === key}
                    aria-label="Remover download"
                    className="shrink-0 rounded-lg px-3 py-2 text-sm text-muted active:text-red-400 disabled:opacity-40"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
