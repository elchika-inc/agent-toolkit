import test from "node:test";
import assert from "node:assert/strict";
import { normalizeKey, normalizeSurface, fingerprint } from "../scripts/lib/fingerprint.mjs";
const sample = { repo: "example/widget", surface: "/widgets", symptom: "layout", key: "重なり" };
test("数字・UUID・URL だけが違う key → 同じ指紋", () => assert.equal(fingerprint({ ...sample, key: "42 123e4567-e89b-12d3-a456-426614174000 https://one.example/x" }), fingerprint({ ...sample, key: "91 987e6543-e89b-12d3-a456-426614174000 https://two.example/y" })));

test("ULID（01JABCDEFGHJKMNPQRSTVWXYZ0 と 01JABCDEFGHJKMNPQRSTVWXYZ1）だけが違う key → 同じ指紋", () => assert.equal(normalizeKey("01JABCDEFGHJKMNPQRSTVWXYZ0"), normalizeKey("01JABCDEFGHJKMNPQRSTVWXYZ1")));

test("数字を含まない 26 文字の ULID の形の語だけが違う key → 同じ指紋（ULID の規則そのものを試す）", () => { assert.equal(normalizeKey("A".repeat(26)), "<id>"); assert.equal(normalizeKey("Z".repeat(26)), "<id>"); });

test("symptom が違う → 違う指紋", () => assert.notEqual(fingerprint(sample), fingerprint({ ...sample, symptom: "console" })));

test("指紋は 16 進 12 桁", () => assert.match(fingerprint(sample), /^[0-9a-f]{12}$/));

test("/services/:id/edit と /services/01JABCDEFGHJKMNPQRSTVWXYZ0/edit → 同じ surface", () => assert.equal(normalizeSurface("/services/:id/edit"), normalizeSurface("/services/01JABCDEFGHJKMNPQRSTVWXYZ0/edit")));

test("/services?selected=01JABCDEFGHJKMNPQRSTVWXYZ0 と /services?selected=:id → 同じ surface", () => assert.equal(normalizeSurface("/services?selected=01JABCDEFGHJKMNPQRSTVWXYZ0"), normalizeSurface("/services?selected=:id")));

test("末尾の / の有無 → 同じ surface", () => assert.equal(normalizeSurface("/services/"), normalizeSurface("/services")));
