// Letters that Unicode normalisation does not break into "base + accent".
const SPECIAL_LETTERS: Record<string, string> = { ø: "o", æ: "ae", ß: "ss", đ: "d", ł: "l", þ: "th" };

/** "Lisbon, Sintra & the Algarve" → "lisbon-sintra-the-algarve" */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents split off by NFKD
    .replace(/[øæßđłþ]/g, (letter) => SPECIAL_LETTERS[letter])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug for a trip: its title plus the year it started, e.g. "tromso-2026". */
export function tripSlug(title: string, startDate: string | null): string {
  const base = slugify(title) || "trip";
  const year = startDate?.slice(0, 4);
  return year ? `${base}-${year}` : base;
}
