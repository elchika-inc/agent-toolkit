// ---- JSON ----
export function formatJSON(input: string, indent: number): string {
  if (!input.trim()) return "";
  const result = JSON.parse(input);
  return JSON.stringify(result, null, indent);
}

export function minifyJSON(input: string): string {
  if (!input.trim()) return "";
  return JSON.stringify(JSON.parse(input));
}

// ---- XML ----
function classifyXmlPart(
  part: string,
): "processing" | "closing" | "selfClosing" | "opening" | "other" {
  if (part.startsWith("<?")) return "processing";
  if (part.startsWith("</")) return "closing";
  if (part.endsWith("/>")) return "selfClosing";
  if (part.startsWith("<") && !part.startsWith("<!--")) return "opening";
  return "other";
}

export function formatXml(xml: string, indentSize = 2): string {
  const indent = " ".repeat(indentSize);
  let level = 0;
  const lines: string[] = [];
  for (const rawPart of xml.replace(/>\s*</g, ">\n<").split("\n")) {
    const part = rawPart.trim();
    if (!part) continue;
    const type = classifyXmlPart(part);
    if (type === "closing") level = Math.max(0, level - 1);
    lines.push(indent.repeat(level) + part);
    if (type === "opening" && !part.includes("</")) level++;
  }
  return lines.join("\n");
}

// ---- HTML ----
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const INDENT_AFTER = new Set([
  "html",
  "head",
  "body",
  "div",
  "section",
  "article",
  "aside",
  "header",
  "footer",
  "main",
  "nav",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "form",
  "fieldset",
  "select",
  "details",
  "summary",
  "dialog",
  "template",
  "blockquote",
  "figure",
  "figcaption",
  "dl",
  "dd",
  "dt",
]);

function shouldIndentAfterTag(tag: string): boolean {
  const m = tag.match(/^<([a-zA-Z][a-zA-Z0-9]*)/);
  if (!m) return false;
  const name = (m[1] ?? "").toLowerCase();
  return !VOID_ELEMENTS.has(name) && !tag.endsWith("/>") && INDENT_AFTER.has(name);
}

export function formatHtml(html: string, indentSize = 2): string {
  const trimmed = html.trim();
  if (!trimmed) return "";
  const indent = " ".repeat(indentSize);
  let level = 0;
  const lines: string[] = [];
  // ブロック要素の境界のみ分割（テキスト内部の <tag>text</tag> は分割しない）
  const blockBoundary =
    /(?<=<\/(html|head|body|div|section|article|aside|header|footer|main|nav|ul|ol|li|table|thead|tbody|tfoot|tr|form|fieldset|select|details|summary|dialog|template|blockquote|figure|figcaption|dl|dd|dt)>)\s*(?=<)/g;
  const preprocessed = trimmed
    .replace(/>\s+</g, "><") // 余分な空白を除去
    .replace(
      /<(html|head|body|div|section|article|aside|header|footer|main|nav|ul|ol|li|table|thead|tbody|tfoot|tr|form|fieldset|select|details|summary|dialog|template|blockquote|figure|figcaption|dl|dd|dt)([^>]*)>/g,
      "\n<$1$2>\n",
    )
    .replace(
      /<\/(html|head|body|div|section|article|aside|header|footer|main|nav|ul|ol|li|table|thead|tbody|tfoot|tr|form|fieldset|select|details|summary|dialog|template|blockquote|figure|figcaption|dl|dd|dt)>/g,
      "\n</$1>\n",
    );
  void blockBoundary;
  for (const rawToken of preprocessed.split("\n")) {
    const token = rawToken.trim();
    if (!token) continue;
    if (token.startsWith("</")) {
      level = Math.max(0, level - 1);
      lines.push(indent.repeat(level) + token);
    } else if (token.startsWith("<") && shouldIndentAfterTag(token)) {
      lines.push(indent.repeat(level) + token);
      level++;
    } else {
      lines.push(indent.repeat(level) + token);
    }
  }
  return lines.join("\n");
}

export function minifyHtml(html: string): string {
  const t = html.trim();
  if (!t) return "";
  return t
    .replace(/\n/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

// ---- YAML ----
function getIndent(line: string): number {
  return (line.match(/^(\s*)/)?.[1] ?? "").length;
}

function parseYamlValue(val: string): unknown {
  if (val === "true") return true;
  if (val === "false") return false;
  if (val === "null" || val === "~") return null;
  if (/^-?\d+$/.test(val)) return Number.parseInt(val, 10);
  if (/^-?\d+\.\d+$/.test(val)) return Number.parseFloat(val);
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    return val.slice(1, -1);
  return val;
}

interface YamlParseResult {
  value: unknown;
  consumed: number;
}

function parseYamlListItems(lines: string[], start: number, base: number): YamlParseResult {
  const arr: unknown[] = [];
  let i = start;
  while (
    i < lines.length &&
    (lines[i]?.trim().startsWith("- ") ?? false) &&
    getIndent(lines[i] ?? "") === base
  ) {
    arr.push(parseYamlValue((lines[i] ?? "").trim().slice(2)));
    i++;
  }
  return { value: arr, consumed: i - start };
}

function parseYamlKeyValue(
  lines: string[],
  index: number,
  base: number,
  result: Record<string, unknown>,
  trimmed: string,
): number {
  const ci = trimmed.indexOf(":");
  if (ci <= 0) return index + 1;
  const key = trimmed.slice(0, ci).trim();
  const vp = trimmed.slice(ci + 1).trim();
  if (vp) {
    result[key] = parseYamlValue(vp);
    return index + 1;
  }
  const next = index + 1;
  if (next < lines.length && getIndent(lines[next] ?? "") > base) {
    const nested = parseYamlLines(lines, next);
    result[key] = nested.value;
    return next + nested.consumed;
  }
  result[key] = null;
  return next;
}

function parseYamlLines(lines: string[], start: number): YamlParseResult {
  const result: Record<string, unknown> = {};
  let i = start;
  const base = getIndent(lines[i] ?? "");
  while (i < lines.length) {
    if (getIndent(lines[i] ?? "") !== base) break;
    const t = (lines[i] ?? "").trim();
    if (t.startsWith("- ")) return parseYamlListItems(lines, i, base);
    i = parseYamlKeyValue(lines, i, base, result, t);
  }
  return { value: result, consumed: i - start };
}

export function yamlToJson(yaml: string): string {
  const lines = yaml.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length === 0) return "{}";
  return JSON.stringify(parseYamlLines(lines, 0).value, null, 2);
}

function toYaml(obj: unknown, level: number): string {
  const indent = "  ".repeat(level);
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "boolean" || typeof obj === "number") return String(obj);
  if (typeof obj === "string") return obj.includes(":") || obj.includes("#") ? `"${obj}"` : obj;
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj
      .map((item) => {
        if (typeof item === "object" && item !== null && !Array.isArray(item)) {
          const inner = toYaml(item, level + 1);
          const [first, ...rest] = inner.split("\n");
          return `${indent}- ${first}${rest.length ? `\n${rest.join("\n")}` : ""}`;
        }
        return `${indent}- ${toYaml(item, level + 1)}`;
      })
      .join("\n");
  }
  if (typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return entries
      .map(([k, v]) =>
        typeof v === "object" && v !== null
          ? `${indent}${k}:\n${toYaml(v, level + 1)}`
          : `${indent}${k}: ${toYaml(v, level + 1)}`,
      )
      .join("\n");
  }
  return String(obj);
}

export function jsonToYaml(json: string): string {
  return toYaml(JSON.parse(json), 0);
}

// ---- XML to JSON (inline, no DOMParser) ----
export function simpleXmlToJson(xml: string): string {
  const trimmed = xml.trim();
  if (!trimmed) throw new Error("Input is empty");
  if (/<(!--|!\[CDATA\[|\?)/.test(xml))
    throw new Error("xml-to-json: comments, CDATA, and processing instructions are not supported");

  function tokenize(str: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    while (i < str.length) {
      if (str[i] === "<") {
        let j = i + 1;
        while (j < str.length && str[j] !== ">") j++;
        tokens.push(str.slice(i, j + 1));
        i = j + 1;
      } else {
        let j = i;
        while (j < str.length && str[j] !== "<") j++;
        const text = str.slice(i, j).trim();
        if (text) tokens.push(text);
        i = j;
      }
    }
    return tokens;
  }

  function parse(tokens: string[], pos: number): [unknown, number] {
    const token = tokens[pos];
    if (!token) return [null, pos + 1];
    if (token.startsWith("<") && token.endsWith("/>")) {
      const tag = token.match(/^<([^\s/>]+)/)?.[1] ?? "unknown";
      return [{ [tag]: null }, pos + 1];
    }
    if (token.startsWith("<") && !token.startsWith("</")) {
      const tag = token.match(/^<([^\s>]+)/)?.[1] ?? "unknown";
      const children: Record<string, unknown> = {};
      let textContent = "";
      let cur = pos + 1;
      while (cur < tokens.length) {
        const t = tokens[cur];
        if (t === `</${tag}>`) {
          cur++;
          break;
        }
        if (t?.startsWith("<") && !t.startsWith("</")) {
          const [child, next] = parse(tokens, cur);
          const co = child as Record<string, unknown>;
          for (const [k, v] of Object.entries(co)) {
            children[k] =
              k in children
                ? Array.isArray(children[k])
                  ? [...(children[k] as unknown[]), v]
                  : [children[k], v]
                : v;
          }
          cur = next;
        } else {
          textContent += t ?? "";
          cur++;
        }
      }
      const value = Object.keys(children).length > 0 ? children : textContent.trim() || null;
      return [{ [tag]: value }, cur];
    }
    return [null, pos + 1];
  }

  const tokens = tokenize(trimmed);
  const [result] = parse(tokens, 0);
  return JSON.stringify(result, null, 2);
}

// ---- TOML ----
function parseTomlValue(value: string): unknown {
  const t = value.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t.startsWith('"') && t.endsWith('"'))
    return t
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1);
  if (t.startsWith("[") && t.endsWith("]")) return parseTomlArray(t);
  if (t.startsWith("{") && t.endsWith("}")) return parseTomlInlineTable(t);
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t;
  if (/^[+-]?\d+\.\d+([eE][+-]?\d+)?$/.test(t)) return parseFloat(t);
  if (/^[+-]?\d[\d_]*$/.test(t)) return parseInt(t.replace(/_/g, ""), 10);
  if (/^0x[0-9a-fA-F_]+$/.test(t)) return parseInt(t.replace(/_/g, ""), 16);
  return t;
}

function parseTomlArray(str: string): unknown[] {
  const inner = str.slice(1, -1).trim();
  if (!inner) return [];
  const items: unknown[] = [];
  let depth = 0,
    start = 0,
    inStr = false;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '"' && inner[i - 1] !== "\\") inStr = !inStr;
    if (!inStr) {
      if (c === "[" || c === "{") depth++;
      else if (c === "]" || c === "}") depth--;
    }
    if (c === "," && depth === 0 && !inStr) {
      items.push(parseTomlValue(inner.slice(start, i)));
      start = i + 1;
    }
  }
  if (start < inner.length) items.push(parseTomlValue(inner.slice(start)));
  return items;
}

function parseTomlInlineTable(str: string): Record<string, unknown> {
  const inner = str.slice(1, -1).trim();
  if (!inner) return {};
  const result: Record<string, unknown> = {};
  for (const pair of inner.split(",")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx > 0) result[pair.slice(0, eqIdx).trim()] = parseTomlValue(pair.slice(eqIdx + 1));
  }
  return result;
}

function setNestedPath(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i] as string;
    if (!(key in cur)) cur[key] = {};
    const next = cur[key];
    if (Array.isArray(next)) {
      cur = next[next.length - 1] as Record<string, unknown>;
    } else cur = next as Record<string, unknown>;
  }
  const last = path[path.length - 1] as string;
  cur[last] = value;
}

export function tomlToJson(input: string): string {
  const result: Record<string, unknown> = {};
  let currentPath: string[] = [];
  for (const rawLine of input.split("\n")) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    if (line.startsWith("[[")) {
      const key = line.slice(2, -2).trim();
      currentPath = [key];
      const arr = (result[key] as unknown[]) ?? [];
      arr.push({});
      result[key] = arr;
    } else if (line.startsWith("[")) {
      currentPath = line.slice(1, -1).trim().split(".");
      let cur = result;
      for (const key of currentPath) {
        if (!(key in cur)) cur[key] = {};
        cur = cur[key] as Record<string, unknown>;
      }
    } else {
      const eqIdx = line.indexOf("=");
      if (eqIdx > 0) {
        const key = line.slice(0, eqIdx).trim();
        const val = parseTomlValue(line.slice(eqIdx + 1));
        if (currentPath.length === 0) result[key] = val;
        else setNestedPath(result, [...currentPath, key], val);
      }
    }
  }
  return JSON.stringify(result, null, 2);
}
