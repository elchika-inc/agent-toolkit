import { describe, expect, test } from "vitest";
import { atbash, caesarEncrypt } from "../utils/crypto.js";
import {
  decodeBase64,
  decodeHTMLEntities,
  encodeBase64,
  encodeHTMLEntities,
  uudecode,
  uuencode,
} from "../utils/encode.js";
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
} from "../utils/format.js";
import { generateULID, generateUUIDv4 } from "../utils/generate.js";
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
} from "../utils/text.js";

describe("text utils", () => {
  test("toUpperCase", () => expect(toUpperCase("hello")).toBe("HELLO"));
  test("toLowerCase", () => expect(toLowerCase("HELLO")).toBe("hello"));
  test("toTitleCase", () => expect(toTitleCase("hello world")).toBe("Hello World"));
  test("toSentenceCase", () => expect(toSentenceCase("hello world")).toBe("Hello world"));
  test("toCamelCase", () => expect(toCamelCase("hello world")).toBe("helloWorld"));
  test("toPascalCase", () => expect(toPascalCase("hello world")).toBe("HelloWorld"));
  test("toSnakeCase", () => expect(toSnakeCase("hello world")).toBe("hello_world"));
  test("toKebabCase", () => expect(toKebabCase("hello world")).toBe("hello-world"));
  test("reverseCharacters", () => expect(reverseCharacters("hello")).toBe("olleh"));
  test("reverseWords", () => expect(reverseWords("hello world")).toBe("world hello"));
  test("reverseLines", () => expect(reverseLines("a\nb")).toBe("b\na"));
  test("slugify", () => expect(slugify("Hello World", SLUGIFY_DEFAULTS)).toBe("hello-world"));
  test("sortText", () => expect(sortText("b\na", DEFAULT_SORT_OPTIONS)).toBe("a\nb"));
  test("toKatakana", () => expect(toKatakana("あいう")).toBe("アイウ"));
  test("toHiragana", () => expect(toHiragana("アイウ")).toBe("あいう"));
});

describe("encode utils", () => {
  test("base64 round-trip", () => {
    expect(encodeBase64("hello")).toBe("aGVsbG8=");
    expect(decodeBase64("aGVsbG8=")).toBe("hello");
  });
  test("html-entity round-trip", () => {
    expect(encodeHTMLEntities("<b>")).toBe("&lt;b&gt;");
    expect(decodeHTMLEntities("&lt;b&gt;")).toBe("<b>");
  });
  test("uuencode round-trip", () => {
    const encoded = uuencode("hello");
    expect(uudecode(encoded)).toBe("hello");
  });
});

describe("format utils", () => {
  test("formatJSON", () => expect(formatJSON('{"a":1}', 2)).toContain('"a": 1'));
  test("formatJSON throws on invalid", () => expect(() => formatJSON("{bad}", 2)).toThrow());
  test("minifyJSON", () => expect(minifyJSON('{ "a": 1 }')).toBe('{"a":1}'));
  test("formatXml", () => expect(formatXml("<a><b>1</b></a>")).toContain("  <b>1</b>"));
  test("formatHtml", () => expect(formatHtml("<div><p>hi</p></div>")).toContain("  <p>hi</p>"));
  test("minifyHtml", () => expect(minifyHtml("<div>  <p>hi</p>  </div>")).not.toContain("  "));
  test("yaml-to-json round-trip", () => {
    const json = yamlToJson("name: Alice\nage: 30");
    expect(JSON.parse(json)).toEqual({ name: "Alice", age: 30 });
  });
  test("json-to-yaml", () => expect(jsonToYaml('{"name":"Alice"}')).toContain("name: Alice"));
  test("simpleXmlToJson", () => {
    const result = JSON.parse(simpleXmlToJson("<root><item>1</item></root>"));
    expect(result).toHaveProperty("root");
  });
  test("tomlToJson", () => {
    const result = JSON.parse(tomlToJson('name = "Alice"\nage = 30'));
    expect(result).toEqual({ name: "Alice", age: 30 });
  });
});

describe("crypto utils", () => {
  test("atbash", () => expect(atbash("abc")).toBe("zyx"));
  test("atbash is its own inverse", () => expect(atbash(atbash("Hello"))).toBe("Hello"));
  test("caesarEncrypt shift 3", () => expect(caesarEncrypt("abc", 3)).toBe("def"));
  test("caesarEncrypt wraps", () => expect(caesarEncrypt("xyz", 3)).toBe("abc"));
});

describe("generate utils", () => {
  test("generateUUIDv4 format", () => {
    expect(generateUUIDv4()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
  test("generateULID length", () => {
    expect(generateULID()).toHaveLength(26);
  });
});
