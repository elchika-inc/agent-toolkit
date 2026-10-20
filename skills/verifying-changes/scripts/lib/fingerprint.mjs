import { createHash } from "node:crypto";

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ulid = "[0-9A-HJKMNP-TV-Z]{26}";

export function normalizeKey(text) {
  return text
    .replace(/https?:\/\/[^\s<>"')]+/gi, "<url>")
    .replace(new RegExp(`\\b(?:${uuid}|${ulid}|[0-9a-f]{8,}|(?=[a-z0-9]*\\d)[a-z0-9]{12,})\\b`, "gi"), "<id>")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSurface(surface) {
  const url = new URL(surface, "https://surface.invalid");
  const parameter = new RegExp(`^(?::[^/]+|\\d+|${uuid}|${ulid}|(?=[a-z0-9]*\\d)[a-z0-9]{6,})$`, "i");
  const pathname = url.pathname.split("/").map((part) => parameter.test(decodeURIComponent(part)) ? ":param" : part).join("/").replace(/\/+$/, "") || "/";
  const query = [...url.searchParams.keys()].sort().map((key) => `${encodeURIComponent(key)}=:param`).join("&");
  return pathname + (query ? `?${query}` : "");
}

export function fingerprint({ repo, surface, symptom, key }) {
  return createHash("sha256").update(`${repo}\n${normalizeSurface(surface)}\n${symptom}\n${normalizeKey(key)}`).digest("hex").slice(0, 12);
}
