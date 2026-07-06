// Persistência dos downloads no MongoDB, em duas coleções pra não duplicar
// letra/acordes: "cifras" guarda o conteúdo (deduplicado por música) e
// "downloads" guarda só um ponteiro leve por usuário (sem repetir as linhas).
import { getDb } from "./mongodb";
import type { Cifra } from "./types";

const CIFRAS_COLLECTION = "cifras";
const DOWNLOADS_COLLECTION = "downloads";

type CifraDoc = Cifra & { _id: string; cachedAt: Date };
type DownloadDoc = {
  username: string;
  artistSlug: string;
  songSlug: string;
  title: string;
  artist: string;
  downloadedAt: Date;
};

function cifraId(artistSlug: string, songSlug: string): string {
  return `${artistSlug}/${songSlug}`;
}

async function getCifrasCollection() {
  const db = await getDb();
  return db.collection<CifraDoc>(CIFRAS_COLLECTION);
}

let indexesEnsured: Promise<void> | null = null;

async function getDownloadsCollection() {
  const db = await getDb();
  const collection = db.collection<DownloadDoc>(DOWNLOADS_COLLECTION);
  if (!indexesEnsured) {
    indexesEnsured = collection
      .createIndex({ username: 1, artistSlug: 1, songSlug: 1 }, { unique: true })
      .then(() => undefined);
  }
  await indexesEnsured;
  return collection;
}

export async function getCachedCifra(
  artistSlug: string,
  songSlug: string,
): Promise<Cifra | null> {
  const cifras = await getCifrasCollection();
  const doc = await cifras.findOne({ _id: cifraId(artistSlug, songSlug) });
  if (!doc) return null;
  const { title, artist, tom, capo, url, lines } = doc;
  return { title, artist, tom, capo, url, lines };
}

export type DownloadSummary = {
  artistSlug: string;
  songSlug: string;
  title: string;
  artist: string;
  downloadedAt: string;
};

export async function addDownload(
  username: string,
  artistSlug: string,
  songSlug: string,
): Promise<DownloadSummary> {
  const { fetchCifraFromCifraClub } = await import("./cifraFetch");

  let cifra = await getCachedCifra(artistSlug, songSlug);
  if (!cifra) {
    cifra = await fetchCifraFromCifraClub(artistSlug, songSlug);
  }

  const cifras = await getCifrasCollection();
  await cifras.updateOne(
    { _id: cifraId(artistSlug, songSlug) },
    { $set: { ...cifra, cachedAt: new Date() } },
    { upsert: true },
  );

  const downloadedAt = new Date();
  const downloads = await getDownloadsCollection();
  await downloads.updateOne(
    { username, artistSlug, songSlug },
    {
      $set: {
        username,
        artistSlug,
        songSlug,
        title: cifra.title,
        artist: cifra.artist,
        downloadedAt,
      },
    },
    { upsert: true },
  );

  return {
    artistSlug,
    songSlug,
    title: cifra.title,
    artist: cifra.artist,
    downloadedAt: downloadedAt.toISOString(),
  };
}

export async function removeDownload(
  username: string,
  artistSlug: string,
  songSlug: string,
): Promise<void> {
  const downloads = await getDownloadsCollection();
  await downloads.deleteOne({ username, artistSlug, songSlug });
}

export async function listDownloads(
  username: string,
): Promise<DownloadSummary[]> {
  const downloads = await getDownloadsCollection();
  const docs = await downloads
    .find({ username })
    .sort({ downloadedAt: -1 })
    .toArray();

  return docs.map((d) => ({
    artistSlug: d.artistSlug,
    songSlug: d.songSlug,
    title: d.title,
    artist: d.artist,
    downloadedAt:
      d.downloadedAt instanceof Date
        ? d.downloadedAt.toISOString()
        : String(d.downloadedAt),
  }));
}

export async function isDownloaded(
  username: string,
  artistSlug: string,
  songSlug: string,
): Promise<boolean> {
  const downloads = await getDownloadsCollection();
  const doc = await downloads.findOne(
    { username, artistSlug, songSlug },
    { projection: { _id: 1 } },
  );
  return !!doc;
}
