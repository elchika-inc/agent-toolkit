import { atbash, caesarEncrypt } from "./utils/crypto.js";
import {
  decodeBase64,
  decodeHTMLEntities,
  encodeBase64,
  encodeHTMLEntities,
  uudecode,
  uuencode,
} from "./utils/encode.js";
import {
  formatHtml,
  formatJSON,
  formatXml,
  jsonToYaml,
  minifyHtml,
  minifyJSON,
  simpleXmlToJson,
  tomlToJson,
  yamlToJson,
} from "./utils/format.js";
import { generateULID, generateUUIDv4 } from "./utils/generate.js";
import {
  DEFAULT_SORT_OPTIONS,
  reverseCharacters,
  reverseLines,
  reverseWords,
  SLUGIFY_DEFAULTS,
  slugify,
  sortText,
  toCamelCase,
  toHiragana,
  toKatakana,
  toKebabCase,
  toLowerCase,
  toPascalCase,
  toSentenceCase,
  toSnakeCase,
  toTitleCase,
  toUpperCase,
} from "./utils/text.js";

export type ToolFn = (input: string) => string | Promise<string>;

export const REGISTRY: Record<string, ToolFn> = {
  // Text
  "upper-case": (t) => toUpperCase(t),
  "lower-case": (t) => toLowerCase(t),
  "title-case": (t) => toTitleCase(t),
  "sentence-case": (t) => toSentenceCase(t),
  "camel-case": (t) => toCamelCase(t),
  "pascal-case": (t) => toPascalCase(t),
  "snake-case": (t) => toSnakeCase(t),
  "kebab-case": (t) => toKebabCase(t),
  "reverse-chars": (t) => reverseCharacters(t),
  "reverse-words": (t) => reverseWords(t),
  "reverse-lines": (t) => reverseLines(t),
  slugify: (t) => slugify(t, SLUGIFY_DEFAULTS),
  "sort-lines": (t) => sortText(t, DEFAULT_SORT_OPTIONS),
  "to-katakana": (t) => toKatakana(t),
  "to-hiragana": (t) => toHiragana(t),
  // Encode
  "base64-encode": (t) => encodeBase64(t),
  "base64-decode": (t) => decodeBase64(t),
  "html-entity-encode": (t) => encodeHTMLEntities(t),
  "html-entity-decode": (t) => decodeHTMLEntities(t),
  uuencode: (t) => uuencode(t),
  uudecode: (t) => uudecode(t),
  // Format
  "json-format": (t) => formatJSON(t, 2),
  "json-minify": (t) => minifyJSON(t),
  "xml-format": (t) => formatXml(t),
  "html-format": (t) => formatHtml(t),
  "html-minify": (t) => minifyHtml(t),
  "yaml-to-json": (t) => yamlToJson(t),
  "json-to-yaml": (t) => jsonToYaml(t),
  "xml-to-json": (t) => simpleXmlToJson(t),
  "toml-to-json": (t) => tomlToJson(t),
  // Crypto
  atbash: (t) => atbash(t),
  "caesar-encrypt": (t) => {
    try {
      const parsed: unknown = JSON.parse(t);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "text" in parsed &&
        "shift" in parsed &&
        typeof (parsed as Record<string, unknown>).text === "string" &&
        typeof (parsed as Record<string, unknown>).shift === "number"
      ) {
        return caesarEncrypt(
          (parsed as Record<string, unknown>).text as string,
          (parsed as Record<string, unknown>).shift as number,
        );
      }
    } catch {
      /* not JSON */
    }
    return caesarEncrypt(t, 3);
  },
  // Generate
  "uuid-v4": () => generateUUIDv4(),
  ulid: () => generateULID(),
};

export const TOOL_NAMES = Object.keys(REGISTRY) as [string, ...string[]];
