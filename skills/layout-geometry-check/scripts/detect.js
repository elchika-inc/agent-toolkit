(() => {
  if (window.layoutGeometryCheck) return;

  const ids = new WeakMap();
  let nextId = 1;
  let reference;
  const closedHosts = new Set();
  const observedFromStart = document.readyState === "loading" && !document.body;
  if (observedFromStart) {
    const attachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      const root = attachShadow.call(this, options);
      if (options.mode === "closed") closedHosts.add(this);
      return root;
    };
  }

  const parentOf = (element) => element.parentElement || element.getRootNode().host || null;
  const idOf = (element) => {
    if (!ids.has(element)) ids.set(element, nextId++);
    return ids.get(element);
  };
  const rectOf = (element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  };
  const descendants = () => {
    const elements = [];
    const visit = (parent) => {
      for (const element of parent.children) {
        elements.push(element);
        if (element.shadowRoot) visit(element.shadowRoot);
        visit(element);
      }
    };
    if (document.body) visit(document.body);
    return elements;
  };
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (!rect.width || !rect.height || style.display === "none" || style.visibility === "hidden") return false;
    for (let node = element; node; node = parentOf(node)) {
      if (Number(getComputedStyle(node).opacity) === 0) return false;
    }
    return true;
  };

  function keyMaker(elements) {
    const counts = new Map();
    for (const element of new Set([...document.querySelectorAll("[data-testid]"), ...elements])) {
      const value = element.getAttribute("data-testid");
      if (value !== null) counts.set(value, (counts.get(value) || 0) + 1);
    }
    return function keyOf(element) {
      const parts = [];
      for (let node = element; node; node = parentOf(node)) {
        const value = node.getAttribute("data-testid");
        if (value !== null && counts.get(value) === 1) {
          parts.unshift(`[data-testid=${JSON.stringify(value)}]`);
          break;
        }
        if (node === document.body) {
          parts.unshift("body");
          break;
        }
        const siblings = [...(node.parentNode?.children || [])].filter((sibling) => sibling.localName === node.localName);
        parts.unshift(`${node.localName}:nth-of-type(${siblings.indexOf(node) + 1})`);
      }
      return parts.join(" > ");
    };
  }

  const frozenRoots = new WeakSet();
  function freezeAnimations() {
    for (const root of [document, ...descendants().map((element) => element.shadowRoot).filter(Boolean)]) {
      if (frozenRoots.has(root)) continue;
      const sheet = new CSSStyleSheet();
      sheet.replaceSync("*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }");
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      frozenRoots.add(root);
    }
  }

  function scan({ width, rules = ["R1"], exclude = [], isReference = false, maxIncomparable = 0.3 }) {
    const all = descendants();
    const keyOf = keyMaker(all);
    const elements = all.filter((element) => {
      const style = getComputedStyle(element);
      return visible(element) && style.display !== "inline" && style.transform === "none" && !exclude.some((selector) => element.matches(selector));
    });
    const info = {
      atReference: [],
      incomparable: { invisibleAtReference: 0, missingAtReference: 0 },
      unscanned: {
        closedShadowRoot: observedFromStart ? [...closedHosts].filter((host) => host.isConnected).length : null,
        iframe: all.filter((element) => element.localName === "iframe").length,
      },
      r1Unverified: 0, leftProtrusion: 0, skippedParents: 0,
    };
    const candidates = [];
    const add = (rule, members, detail) => candidates.push({
      ids: members.map(idOf),
      finding: { rule, key: members.map(keyOf).join(" | "), width, rect: rectOf(members.at(-1)), detail },
    });

    if (rules.includes("R1")) {
      info.leftProtrusion = elements.filter((element) => element.getBoundingClientRect().right <= 0).length;
      const documentWidth = () => document.documentElement.scrollWidth;
      const viewportWidth = document.documentElement.clientWidth;
      if (documentWidth() > viewportWidth + 1) {
        const overflowing = elements.filter((element) => {
          if (element.getBoundingClientRect().right <= viewportWidth + 1) return false;
          for (let node = element; node; node = parentOf(node)) {
            const style = getComputedStyle(node);
            if (style.position === "fixed") return false;
            if (node !== element && ["hidden", "clip", "auto", "scroll"].includes(style.overflowX)) return false;
          }
          return true;
        });
        info.r1Unverified = Math.max(0, overflowing.length - 50);
        for (const element of overflowing.slice(0, 50)) {
          const before = documentWidth();
          const style = element.getAttribute("style");
          let after;
          try {
            element.style.setProperty("display", "none", "important");
            after = documentWidth();
          } finally {
            if (style === null) element.removeAttribute("style");
            else element.setAttribute("style", style);
          }
          if (after < before) add("R1", [element], `scrollWidth ${before} > clientWidth ${viewportWidth}、非表示時 ${after}`);
        }
      }
    }

    if (rules.includes("R2")) {
      for (const element of elements) {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (!element.textContent.trim() || style.textOverflow === "ellipsis" || !["none", "0", ""].includes(style.webkitLineClamp)) continue;
        if (rect.width <= 1 || rect.height <= 1 || style.clip !== "auto" || style.clipPath !== "none") continue;
        const clippedX = ["hidden", "clip"].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
        const clippedY = ["hidden", "clip"].includes(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
        if (clippedX || clippedY) add("R2", [element], `scroll ${element.scrollWidth}×${element.scrollHeight} > client ${element.clientWidth}×${element.clientHeight}`);
      }
    }

    if (rules.includes("R3")) {
      const groups = new Map();
      for (const element of elements) {
        if (!["static", "relative", "sticky"].includes(getComputedStyle(element).position)) continue;
        const parent = element.parentNode;
        if (!groups.has(parent)) groups.set(parent, []);
        groups.get(parent).push(element);
      }
      for (const [parent, siblings] of groups) {
        if ([...parent.children].filter(visible).length > 200) {
          info.skippedParents++;
          continue;
        }
        for (let i = 0; i < siblings.length; i++) {
          for (let j = i + 1; j < siblings.length; j++) {
            const a = siblings[i].getBoundingClientRect();
            const b = siblings[j].getBoundingClientRect();
            const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (x > 1 && y > 1) add("R3", [siblings[i], siblings[j]], `交差 ${x}×${y}px`);
          }
        }
      }
    }

    if (rules.includes("R4")) {
      for (const element of elements) {
        const parent = parentOf(element);
        if (!parent || !visible(parent) || ["absolute", "fixed"].includes(getComputedStyle(element).position)) continue;
        const style = getComputedStyle(parent);
        const childRect = element.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        const outsideX = childRect.left < parentRect.left - 1 || childRect.right > parentRect.right + 1;
        const outsideY = childRect.top < parentRect.top - 1 || childRect.bottom > parentRect.bottom + 1;
        if ((style.overflowX === "visible" && outsideX) || (style.overflowY === "visible" && outsideY)) {
          add("R4", [parent, element], "子の矩形が親から1pxを超えてはみ出す");
        }
      }
    }

    const signature = (candidate) => `${candidate.finding.rule}:${candidate.ids.join(",")}`;
    if (isReference) {
      reference = {
        all: new Set([document.body, ...all].filter(Boolean).map(idOf)),
        visible: new Set([document.body, ...elements].filter(Boolean).map(idOf)),
        violations: new Set(candidates.map(signature)),
      };
      info.atReference = candidates.filter(({ finding }) => finding.rule !== "R1").map(({ finding }) => finding);
    }
    if (!reference) throw new Error("先に基準幅を測ってください");
    if (!isReference) {
      for (const element of elements) {
        if (!reference.all.has(idOf(element))) info.incomparable.missingAtReference++;
        else if (!reference.visible.has(idOf(element))) info.incomparable.invisibleAtReference++;
      }
    }
    const findings = candidates.filter((candidate) => {
      if (candidate.finding.rule === "R1") return true;
      return !isReference && candidate.ids.every((id) => reference.visible.has(id)) && !reference.violations.has(signature(candidate));
    }).map(({ finding }) => finding);
    let reason = "";
    if (!elements.length) reason = `幅 ${width}: 対象要素が0個`;
    else if (info.incomparable.missingAtReference / elements.length > maxIncomparable) reason = `幅 ${width}: 基準幅に存在しない要素 ${info.incomparable.missingAtReference}/${elements.length} が上限 ${maxIncomparable} を超えた`;
    return { checked: elements.length, findings, info, reason };
  }

  window.layoutGeometryCheck = { scan, freezeAnimations };
})();
