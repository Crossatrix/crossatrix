const BASE = "https://raw.githubusercontent.com/Cross-a-trix/legal/main/";

export const TOS_LANGUAGES = [
  { code: "en", label: "English", file: "tos.md" },
  { code: "ma", label: "Mandarin", file: "tos-ma.md" },
  { code: "hi", label: "Hindi", file: "tos-hi.md" },
  { code: "sp", label: "Spanish", file: "tos-sp.md" },
  { code: "fr", label: "French", file: "tos-fr.md" },
  { code: "de", label: "German", file: "tos-de.md" },
] as const;

export async function fetchTos(code: string): Promise<string> {
  const lang = TOS_LANGUAGES.find((l) => l.code === code) ?? TOS_LANGUAGES[0];
  const r = await fetch(BASE + lang.file, { cache: "no-store" });
  if (!r.ok) throw new Error("not found");
  return r.text();
}

// The published version is a hash of the English (standard) terms,
// so any change to them requires everyone to accept again.
export async function currentTosVersion(): Promise<string> {
  const text = await fetchTos("en");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text.trim()));
  return Array.from(new Uint8Array(buf)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}
