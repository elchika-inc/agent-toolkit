export function judgeRequest({ method, url, postData, contentType }, policy) {
  const deny = (reason) => ({ allow: false, reason });
  const allow = () => ({ allow: true, reason: null });
  let parsed;
  try { parsed = new URL(url); } catch { return deny("URL を解析できない"); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return deny("HTTP URL でない、または認証情報を含む");
  if (!policy.allowHosts.includes(parsed.host)) return deny("許可していない host");

  // 外部依存を持てないため、読み取り用の GraphQL 文法だけを受理する。
  // 語句検索では文字列・コメント・フィールド名と operation を混同する。
  function readOnlyQuery(source) {
    if (typeof source !== "string" || !source.trim() || source.length > 131072) return false;
    const tokens = [];
    const lexer = /(?:[\s,\uFEFF]+|#[^\r\n]*)|(?:"""(?:\\[\s\S]|(?!""")[\s\S])*"""|"(?:\\.|[^"\\\r\n])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|[_A-Za-z][_0-9A-Za-z]*|\.\.\.|[!$():=@\[\]{|}&])/y;
    let offset = 0;
    while (offset < source.length) {
      lexer.lastIndex = offset;
      const match = lexer.exec(source);
      if (!match) return false;
      offset = lexer.lastIndex;
      if (!/^[\s,#\uFEFF]/.test(match[0])) tokens.push(match[0]);
    }
    let cursor = 0, depth = 0, operations = 0;
    const peek = () => tokens[cursor];
    const take = (token) => peek() === token ? (cursor++, true) : false;
    const requireToken = (token) => { if (!take(token)) throw new Error(); };
    const name = () => { const token = tokens[cursor++]; if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(token ?? "")) throw new Error(); return token; };
    function value() {
      if (++depth > 100) throw new Error();
      if (take("$")) name();
      else if (take("[")) { while (!take("]")) value(); }
      else if (take("{")) { while (!take("}")) { name(); requireToken(":"); value(); } }
      else {
        const token = tokens[cursor++];
        if (token?.startsWith('"""')) { /* 字句解析で閉じ括りまで確認済み。 */ }
        else if (token?.startsWith('"')) JSON.parse(token);
        else if (!/^(?:[_A-Za-z][_0-9A-Za-z]*|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(token ?? "")) throw new Error();
      }
      depth--;
    }
    function argumentsList() {
      if (!take("(")) return;
      if (peek() === ")") throw new Error();
      while (!take(")")) { name(); requireToken(":"); value(); }
    }
    function directives() { while (take("@")) { name(); argumentsList(); } }
    function type() {
      if (++depth > 100) throw new Error();
      if (take("[")) { type(); requireToken("]"); } else name();
      take("!"); depth--;
    }
    function selection() {
      if (++depth > 100) throw new Error();
      requireToken("{");
      if (peek() === "}") throw new Error();
      while (!take("}")) {
        if (take("...")) {
          if (take("on")) { name(); directives(); selection(); }
          else if (peek() === "@" || peek() === "{") { directives(); selection(); }
          else { name(); directives(); }
        } else {
          name(); if (take(":")) name(); argumentsList(); directives();
          if (peek() === "{") selection();
        }
      }
      depth--;
    }
    try {
      while (cursor < tokens.length) {
        if (peek() === "{") { selection(); operations++; continue; }
        const operation = name();
        if (operation === "fragment") {
          if (name() === "on") return false;
          requireToken("on"); name(); directives(); selection(); continue;
        }
        if (operation !== "query") return false;
        operations++;
        if (/^[_A-Za-z]/.test(peek() ?? "")) name();
        if (take("(")) {
          if (peek() === ")") return false;
          while (!take(")")) {
            requireToken("$"); name(); requireToken(":"); type();
            if (take("=")) value(); directives();
          }
        }
        directives(); selection();
      }
      return operations > 0;
    } catch { return false; }
  }

  const verb = String(method).toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(verb)) {
    if (verb === "GET" && parsed.searchParams.getAll("query").some((query) => !readOnlyQuery(query))) return deny("GET の GraphQL を読み取りと確認できない");
    return allow();
  }
  const permitted = policy.allowWrites.some((entry) => {
    if (entry.method.toUpperCase() !== verb || !url.startsWith(entry.urlPrefix)) return false;
    return [undefined, "/", "?"].includes(url[entry.urlPrefix.length]);
  });
  if (!permitted) return deny("許可していない書き込み");
  let queries;
  if (String(contentType).split(";")[0].trim().toLowerCase() === "application/graphql") queries = [postData];
  else {
    try {
      const body = JSON.parse(postData);
      queries = (Array.isArray(body) ? body : [body]).map((item) => item?.query);
    } catch { return deny("GraphQL の本文を解析できない"); }
  }
  return queries.length && queries.every(readOnlyQuery) ? allow() : deny("GraphQL を読み取りと確認できない");
}
