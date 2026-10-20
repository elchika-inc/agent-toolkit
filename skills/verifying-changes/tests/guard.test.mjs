import test from "node:test";
import assert from "node:assert/strict";
import { judgeRequest } from "../scripts/lib/guard.mjs";
const policy = { allowHosts: ["api.example.com"], allowWrites: [{ method: "POST", urlPrefix: "https://api.example.com/graphql" }] };
const request = (changes = {}) => ({ method: "POST", url: "https://api.example.com/graphql", contentType: "application/json", postData: JSON.stringify({ query: "query { viewer { id } }" }), ...changes });

test("allowHosts にない host への GET → 止める", () => assert.equal(judgeRequest(request({ method: "GET", url: "https://other.example/" }), policy).allow, false));

test("GET・HEAD・OPTIONS → 通す", () => { for (const method of ["GET", "HEAD", "OPTIONS"]) assert.equal(judgeRequest(request({ method }), policy).allow, true); });

test("GET の ?query=mutation… → 止める", () => assert.equal(judgeRequest(request({ method: "GET", url: "https://api.example.com/graphql?query=mutation%20%7Bdelete%7D" }), policy).allow, false));

test("POST で許可なし → 止める", () => assert.equal(judgeRequest(request(), { ...policy, allowWrites: [] }).allow, false));

test("POST:https://api.example.com/graphql の許可がある GraphQL の query → 通す", () => assert.equal(judgeRequest(request(), policy).allow, true));

test("同じ許可で https://api.example.com/graphql-admin への POST → 止める", () => assert.equal(judgeRequest(request({ url: "https://api.example.com/graphql-admin" }), policy).allow, false));

test("同じ許可があっても GraphQL の mutation → 止める", () => assert.equal(judgeRequest(request({ postData: JSON.stringify({ query: "mutation { delete }" }) }), policy).allow, false));

test("同じ許可があっても subscription → 止める", () => assert.equal(judgeRequest(request({ postData: JSON.stringify({ query: "subscription { news }" }) }), policy).allow, false));

test("# コメントのあとに mutation が来る本文 → 止める", () => assert.equal(judgeRequest(request({ postData: JSON.stringify({ query: "# query\nmutation { delete }" }) }), policy).allow, false));

test("query A{} mutation B{} を持つ本文（operationName が A でも） → 止める", () => assert.equal(judgeRequest(request({ postData: JSON.stringify({ query: "query A{} mutation B{}", operationName: "A" }) }), policy).allow, false));

test("JSON の配列で 2 つめが mutation → 止める", () => assert.equal(judgeRequest(request({ postData: JSON.stringify([{ query: "query { viewer { id } }" }, { query: "mutation { delete }" }]) }), policy).allow, false));

test("application/graphql の本文が mutation → 止める", () => assert.equal(judgeRequest(request({ postData: "mutation { delete }", contentType: "application/graphql" }), policy).allow, false));

test("query の無い本文（persisted query） → 止める", () => assert.equal(judgeRequest(request({ postData: JSON.stringify({ extensions: { persistedQuery: { sha256Hash: "synthetic" } } }) }), policy).allow, false));

test("JSON として読めない本文 → 止める", () => assert.equal(judgeRequest(request({ postData: "これは JSON ではない" }), policy).allow, false));

test("judgeRequest.toString() を new Function で作り直しても同じ結果になる（自己完結の確認）", () => { const copy = new Function(`return (${judgeRequest.toString()})`)(); for (const r of [request(), request({ method: "GET" }), request({ postData: JSON.stringify({ query: "mutation { delete }" }) })]) assert.deepEqual(copy(r, policy), judgeRequest(r, policy)); });
