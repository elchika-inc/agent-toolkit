// ---- Case conversion ----
export function toUpperCase(text: string): string {
  return text.toUpperCase();
}

export function toLowerCase(text: string): string {
  return text.toLowerCase();
}

export function toTitleCase(text: string): string {
  return text.replace(
    /\w\S*/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
}

export function toSentenceCase(text: string): string {
  return text.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (match) => match.toUpperCase());
}

// ---- Code case conversion ----
function splitWords(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/[_\-./\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 0);
}

export function toCamelCase(text: string): string {
  const words = splitWords(text);
  if (words.length === 0) return "";
  return words
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");
}

export function toPascalCase(text: string): string {
  return splitWords(text)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

export function toSnakeCase(text: string): string {
  return splitWords(text)
    .map((w) => w.toLowerCase())
    .join("_");
}

export function toKebabCase(text: string): string {
  return splitWords(text)
    .map((w) => w.toLowerCase())
    .join("-");
}

// ---- Reverse ----
export function reverseCharacters(text: string): string {
  return [...text].reverse().join("");
}

export function reverseWords(text: string): string {
  return text
    .split("\n")
    .map((line) => line.split(" ").reverse().join(" "))
    .join("\n");
}

export function reverseLines(text: string): string {
  return text.split("\n").reverse().join("\n");
}

// ---- Slugify ----
export interface SlugifyOptions {
  separator: string;
  lowercase: boolean;
  removeSpecialChars: boolean;
  maxLength: number;
}

export const SLUGIFY_DEFAULTS: SlugifyOptions = {
  separator: "-",
  lowercase: true,
  removeSpecialChars: true,
  maxLength: 0,
};

const ROMANIZE_MAP: Record<string, string> = {
  あ: "a",
  い: "i",
  う: "u",
  え: "e",
  お: "o",
  か: "ka",
  き: "ki",
  く: "ku",
  け: "ke",
  こ: "ko",
  さ: "sa",
  し: "shi",
  す: "su",
  せ: "se",
  そ: "so",
  た: "ta",
  ち: "chi",
  つ: "tsu",
  て: "te",
  と: "to",
  な: "na",
  に: "ni",
  ぬ: "nu",
  ね: "ne",
  の: "no",
  は: "ha",
  ひ: "hi",
  ふ: "fu",
  へ: "he",
  ほ: "ho",
  ま: "ma",
  み: "mi",
  む: "mu",
  め: "me",
  も: "mo",
  や: "ya",
  ゆ: "yu",
  よ: "yo",
  ら: "ra",
  り: "ri",
  る: "ru",
  れ: "re",
  ろ: "ro",
  わ: "wa",
  を: "wo",
  ん: "n",
  が: "ga",
  ぎ: "gi",
  ぐ: "gu",
  げ: "ge",
  ご: "go",
  ざ: "za",
  じ: "ji",
  ず: "zu",
  ぜ: "ze",
  ぞ: "zo",
  だ: "da",
  ぢ: "di",
  づ: "du",
  で: "de",
  ど: "do",
  ば: "ba",
  び: "bi",
  ぶ: "bu",
  べ: "be",
  ぼ: "bo",
  ぱ: "pa",
  ぴ: "pi",
  ぷ: "pu",
  ぺ: "pe",
  ぽ: "po",
};

function romanize(text: string): string {
  let result = "";
  const hiragana = text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  for (const char of hiragana) result += ROMANIZE_MAP[char] ?? char;
  return result;
}

export function slugify(text: string, options: SlugifyOptions): string {
  const { separator, lowercase, removeSpecialChars, maxLength } = options;
  let result = romanize(text);
  if (lowercase) result = result.toLowerCase();
  if (removeSpecialChars) result = result.replace(/[^\w\s-]/g, "");
  const sep = separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  result = result.replace(/\s+/g, separator);
  result = result.replace(new RegExp(`${sep}+`, "g"), separator);
  result = result.replace(new RegExp(`^${sep}|${sep}$`, "g"), "");
  if (maxLength > 0 && result.length > maxLength) {
    result = result.slice(0, maxLength).replace(new RegExp(`${sep}$`), "");
  }
  return result;
}

// ---- Sort ----
export interface SortOptions {
  order: "asc" | "desc";
  numeric: boolean;
  caseSensitive: boolean;
  removeDuplicates: boolean;
  trimLines: boolean;
  removeEmpty: boolean;
}

export const DEFAULT_SORT_OPTIONS: SortOptions = {
  order: "asc",
  numeric: false,
  caseSensitive: true,
  removeDuplicates: false,
  trimLines: false,
  removeEmpty: false,
};

export function sortText(input: string, options: SortOptions): string {
  let lines = input.split("\n");
  if (options.trimLines) lines = lines.map((l) => l.trim());
  if (options.removeEmpty) lines = lines.filter((l) => l.length > 0);
  if (options.removeDuplicates) lines = [...new Set(lines)];
  lines.sort((a, b) => {
    let ca = a,
      cb = b;
    if (!options.caseSensitive) {
      ca = a.toLowerCase();
      cb = b.toLowerCase();
    }
    if (options.numeric) {
      const na = Number.parseFloat(ca),
        nb = Number.parseFloat(cb);
      if (!Number.isNaN(na) && !Number.isNaN(nb))
        return options.order === "asc" ? na - nb : nb - na;
    }
    const r = ca.localeCompare(cb);
    return options.order === "asc" ? r : -r;
  });
  return lines.join("\n");
}

// ---- Kana ----
export function toKatakana(text: string): string {
  return text.replace(/[ぁ-ゖゝ-ゟ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

export function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶヽ-ヿ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
