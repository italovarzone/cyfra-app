// Utilidades de acordes: transposição de tom e versão simplificada.
// Roda no cliente (e no servidor) sem dependências externas.

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// Nota (raiz) no início de um acorde: A-G com # ou b opcional.
const ROOT_RE = /^([A-G])(#|b)?/;

function noteIndex(note: string): number {
  const s = SHARP.indexOf(note);
  if (s >= 0) return s;
  const f = FLAT.indexOf(note);
  return f; // -1 se inválido
}

function shiftNote(note: string, semitones: number, preferFlat: boolean): string {
  const idx = noteIndex(note);
  if (idx < 0) return note;
  const next = (((idx + semitones) % 12) + 12) % 12;
  return preferFlat ? FLAT[next] : SHARP[next];
}

// Detecta se um token parece um acorde (evita transpor palavras da letra).
export function isChord(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  return /^[A-G](#|b)?(m|maj|min|dim|aug|sus|add|º|°|\+|-|\(|\)|\/|[0-9])*$/.test(t);
}

/**
 * Transpõe um acorde (incluindo baixo após "/") por N semitons.
 * Preserva a sufixação (m7, sus4, add9, etc.) e o baixo.
 */
export function transposeChord(chord: string, semitones: number): string {
  if (!semitones) return chord;
  const preferFlat = chord.includes("b") && !chord.includes("#");

  const parts = chord.split("/");
  const out = parts.map((part) => {
    const m = part.match(ROOT_RE);
    if (!m) return part;
    const root = m[0];
    const rest = part.slice(root.length);
    return shiftNote(root, semitones, preferFlat) + rest;
  });
  return out.join("/");
}

/**
 * Versão simplificada: mantém apenas a tríade básica (raiz + menor),
 * removendo extensões (7, 9, sus, add, etc.). Baixo alternativo é descartado.
 */
export function simplifyChord(chord: string): string {
  const base = chord.split("/")[0];
  const m = base.match(ROOT_RE);
  if (!m) return chord;
  const root = m[0];
  const rest = base.slice(root.length);
  // menor: começa com "m" que NÃO seja "maj"
  const isMinor = /^m(?!aj)/i.test(rest);
  const isDim = /^(dim|º|°)/i.test(rest);
  if (isDim) return root + "m"; // aproxima diminuto como menor
  return isMinor ? root + "m" : root;
}
