export type SearchResult = {
  artist: string;
  song: string;
  artistSlug: string;
  songSlug: string;
  image: string | null;
};

export type Token =
  | { t: "chord"; v: string; pad: number }
  | { t: "text"; v: string };

export type LineType = "chord" | "text" | "section" | "blank" | "tab";

export type CifraLine = {
  type: LineType;
  tokens: Token[];
};

export type Cifra = {
  title: string;
  artist: string;
  tom: string | null;
  capo: string | null;
  url: string;
  lines: CifraLine[];
  downloaded?: boolean;
};
