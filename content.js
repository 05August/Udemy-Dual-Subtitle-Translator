(() => {
  const NATIVE_STYLE_ID = "uds-native-hide";
  const state = {
    settings: { ...UDS.DEFAULTS },
    host: null,
    shadow: null,
    overlay: null,
    sourceLine: null,
    targetLine: null,
    fab: null,
    panel: null,
    statusEl: null,
    sourceSelect: null,
    video: null,
    lectureKey: "",
    captions: [],
    cues: [],
    customCues: null,
    translating: false,
    panelOpen: false,
    loadToken: 0,
    intercepted: new Map(),
    pendingLecture: null,
    overlayInNative: false,
    playerUiObserver: null,
    pointerX: null,
    pointerY: null,
    lastPointerAt: 0,
    controlsIdleTimer: 0,
    syncPanel: null,
    baseCues: [],
    sourceLang: "en",
    lectureId: "",
    memoryCache: new Map(),
    retargetTimer: 0,
  };

  const CUE_SELECTORS = [
    '[data-purpose="captions-cue-text"]',
    '[data-purpose="captions-cue"]',
    '[class*="captions-display--captions-cue-text"]',
    '[class*="captions-cue-text"]',
    '[class*="captions-display--captions-cue"]',
  ];
  function lectureContext() {
    const path = location.pathname;
    const lectureId = (path.match(/\/learn\/lecture\/(\d+)/) || [])[1] || "";
    const slug = (path.match(/\/course\/([^/]+)/) || [])[1] || "";
    return { lectureId, slug, origin: location.origin };
  }

  function setStatus(text, kind) {
    if (!state.statusEl) return;
    state.statusEl.textContent = text;
    state.statusEl.dataset.kind = kind || "";
  }

  function log(message) {
    console.info("[DualSub]", message);
  }

  function idsFromUrl(url) {
    const value = String(url || "");
    return {
      courseId:
        (value.match(/subscribed-courses\/(\d+)/) ||
          value.match(/\/courses\/(\d{3,8})(?:[/?]|$)/) ||
          [])[1] || "",
      lectureId: (value.match(/\/lectures\/(\d+)/) || [])[1] || "",
    };
  }

  function pingBridge() {
    return new Promise((resolve) => {
      const id = `ping-${Date.now()}`;
      const timer = setTimeout(() => resolve(null), 1500);
      function onMessage(event) {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || msg.channel !== UDS.BRIDGE || msg.type !== "SNAPSHOT" || msg.id !== id) return;
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(msg.snapshot || null);
      }
      window.addEventListener("message", onMessage);
      window.postMessage({ channel: UDS.BRIDGE, type: "PING", id }, "*");
    });
  }

  function lectureFromPayload(payload, lectureId) {
    if (!payload || !payload.text) return null;
    const ids = idsFromUrl(payload.url);
    if (lectureId && ids.lectureId && ids.lectureId !== String(lectureId)) return null;
    try {
      const data = JSON.parse(payload.text);
      const captions =
        data && data.asset && Array.isArray(data.asset.captions) ? data.asset.captions : [];
      return { courseId: ids.courseId, captions, via: "intercept" };
    } catch {
      return null;
    }
  }

  function courseIdFromSnapshot(snapshot, ctx) {
    if (snapshot && snapshot.lecture && snapshot.lecture.url) {
      const id = idsFromUrl(snapshot.lecture.url).courseId;
      if (id) return id;
    }
    const resources = (snapshot && snapshot.resources) || [];
    for (const url of resources) {
      const ids = idsFromUrl(url);
      if (ctx.lectureId && ids.lectureId && ids.lectureId !== ctx.lectureId) continue;
      if (ids.courseId) return ids.courseId;
    }
    for (const url of resources) {
      const ids = idsFromUrl(url);
      if (ids.courseId) return ids.courseId;
    }
    if (snapshot && snapshot.globals && snapshot.globals.courseId) {
      return String(snapshot.globals.courseId);
    }
    return extractCourseId(document.documentElement.innerHTML, ctx.slug);
  }

  function waitForLecture(lectureId, timeoutMs) {
    const cached = state.intercepted.get(lectureId);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (state.pendingLecture && state.pendingLecture.lectureId === lectureId) {
          state.pendingLecture = null;
        }
        resolve(null);
      }, timeoutMs);
      state.pendingLecture = {
        lectureId,
        resolve: (payload) => {
          clearTimeout(timer);
          resolve(payload);
        },
      };
    });
  }

  function ingestLecture(url, text) {
    const ids = idsFromUrl(url);
    log(`intercept ${ids.courseId || "?"}/${ids.lectureId || "?"} · ${text.length} bytes`);
    let captions = [];
    try {
      const data = JSON.parse(text);
      captions = data && data.asset && Array.isArray(data.asset.captions) ? data.asset.captions : [];
      log(
        `captions ${captions.length}: ${captions
          .map((c) => c.locale_id)
          .slice(0, 10)
          .join(", ")}`
      );
    } catch (err) {
      log(`JSON intercept error: ${err.message}`);
      return;
    }
    if (!captions.length) {
      log(`skip empty intercept (${text.length} bytes)`);
      return;
    }
    const payload = { courseId: ids.courseId, captions, via: "intercept" };
    if (ids.lectureId) state.intercepted.set(ids.lectureId, payload);
    if (
      state.pendingLecture &&
      (!state.pendingLecture.lectureId || state.pendingLecture.lectureId === ids.lectureId)
    ) {
      const pending = state.pendingLecture;
      state.pendingLecture = null;
      pending.resolve(payload);
    }
  }

  function bridgeFetch(url) {
    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("Timed out calling the Udemy API"));
      }, 20000);
      function onMessage(event) {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || msg.channel !== UDS.BRIDGE || msg.id !== id) return;
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        if (!msg.ok) {
          reject(new Error(msg.error || `HTTP ${msg.status}`));
          return;
        }
        resolve(msg.text);
      }
      window.addEventListener("message", onMessage);
      window.postMessage({ channel: UDS.BRIDGE, type: "FETCH", id, url }, "*");
    });
  }

  function pickCaption(captions, sourceLocale) {
    if (!Array.isArray(captions) || !captions.length) return null;
    if (sourceLocale && sourceLocale !== "auto") {
      return captions.find((c) => c.locale_id === sourceLocale) || null;
    }
    return (
      captions.find((c) => c.locale_id === "en_US") ||
      captions.find((c) => String(c.locale_id || "").startsWith("en")) ||
      captions[0]
    );
  }

  function extractCourseId(htmlOrJson, slug) {
    const text = String(htmlOrJson);
    if (slug) {
      const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const bySlug = text.match(new RegExp(`"id"\\s*:\\s*(\\d{3,8})[^\\n]{0,500}${escaped}`));
      if (bySlug) return bySlug[1];
    }
    const patterns = [
      /subscribed-courses\/(\d+)\/lectures/,
      /"course_id"\s*:\s*(\d+)/,
      /"id"\s*:\s*(\d{4,8})[^}]{0,160}"_class"\s*:\s*"course"/,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return "";
  }

  function lectureApiUrl(ctx, courseId) {
    const fields =
      "fields[lecture]=asset,description&fields[asset]=asset_type,length,captions";
    return `${ctx.origin}/api-2.0/users/me/subscribed-courses/${courseId}/lectures/${ctx.lectureId}/?${fields}`;
  }

  async function loadLectureAsset(ctx) {
    log(`load lecture ${ctx.lectureId} · slug=${ctx.slug} · host=${location.host}`);
    const snapshot = await pingBridge();
    log(
      `bridge ${snapshot ? "ok" : "timeout"} · cache=${Boolean(snapshot && snapshot.lecture)} · res=${
        snapshot && snapshot.resources ? snapshot.resources.length : 0
      }`
    );
    if (snapshot && snapshot.globals) {
      log(`UD=${snapshot.globals.hasUD} courseGlobal=${snapshot.globals.courseId || "none"}`);
    }
    if (snapshot && snapshot.resources && snapshot.resources.length) {
      const short = snapshot.resources
        .slice(-4)
        .map((url) => url.replace(/^https?:\/\/[^/]+/, ""))
        .join(" | ");
      log(`api seen: ${short}`);
    }

    const fromCache = lectureFromPayload(snapshot && snapshot.lecture, ctx.lectureId);
    if (fromCache && fromCache.captions.length) {
      log(`using intercept cache · courseId=${fromCache.courseId} · captions=${fromCache.captions.length}`);
      return fromCache;
    }

    const memory = state.intercepted.get(ctx.lectureId);
    if (memory && memory.captions.length) {
      log(`using intercept memory · courseId=${memory.courseId}`);
      return memory;
    }

    const courseId = courseIdFromSnapshot(snapshot, ctx);
    if (courseId) {
      log(`courseId=${courseId} → fetching lecture API`);
      const text = await bridgeFetch(lectureApiUrl(ctx, courseId));
      const data = JSON.parse(text);
      const captions =
        data && data.asset && Array.isArray(data.asset.captions) ? data.asset.captions : [];
      log(`lecture API captions=${captions.length}`);
      return { courseId, captions, via: "fetch" };
    }

    log("no courseId yet, waiting for Udemy lecture API…");
    setStatus("Waiting for Udemy lecture API…");
    const waited = await waitForLecture(ctx.lectureId, 12000);
    if (waited && waited.captions) {
      log(`caught intercept · courseId=${waited.courseId} · captions=${waited.captions.length}`);
      return waited;
    }

    throw new Error("Could not get the course id / lecture API. Reload the lecture and try again.");
  }

  async function fetchVtt(url) {
    const res = await sendRuntime({ type: "FETCH_TEXT", url });
    if (!res || !res.ok) throw new Error((res && res.error) || "Could not download the VTT file");
    return res.text;
  }

  async function hashSource(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .slice(0, 10)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function readCache(key) {
    const data = await chrome.storage.local.get(key);
    return data[key] || null;
  }

  async function writeCache(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch {
      const all = await chrome.storage.local.get(null);
      const stale = Object.keys(all).filter((k) => k.startsWith(UDS.CACHE_PREFIX));
      if (stale.length) await chrome.storage.local.remove(stale);
      await chrome.storage.local.set({ [key]: value });
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function translateWithChrome(texts, sl, tl) {
    if (!("Translator" in self)) {
      log("Chrome Translator: API missing");
      return null;
    }
    try {
      const availability = await Translator.availability({
        sourceLanguage: sl,
        targetLanguage: tl,
      });
      log(`Chrome Translator: ${availability}`);
      if (availability !== "available") return null;
      const translator = await Translator.create({
        sourceLanguage: sl,
        targetLanguage: tl,
      });
      const out = [];
      for (let i = 0; i < texts.length; i += 1) {
        const text = texts[i];
        out.push(text && text.trim() ? await translator.translate(text) : text || "");
      }
      return out;
    } catch (err) {
      log(`Chrome Translator error: ${err.message || err}`);
      return null;
    }
  }

  async function translateSlice(slice, sl, tl) {
    let lastError = "Caption translation failed";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await sendRuntime({ type: "TRANSLATE", texts: slice, sl, tl });
      if (res && res.ok) return res.texts;
      lastError = (res && res.error) || lastError;
      if (!/429/.test(String(lastError))) throw new Error(lastError);
      const wait = 800 * 2 ** attempt;
      log(`Google 429, waiting ${wait}ms`);
      setStatus(`Google rate-limited, waiting ${Math.round(wait / 1000)}s…`);
      await sleep(wait);
    }
    throw new Error(lastError);
  }

  function packRanges(texts, maxChars) {
    const ranges = [];
    let start = 0;
    let size = 0;
    for (let i = 0; i < texts.length; i += 1) {
      const len = (texts[i] || "").length + 8;
      if (i > start && size + len > maxChars) {
        ranges.push([start, i]);
        start = i;
        size = 0;
      }
      size += len;
    }
    if (start < texts.length) ranges.push([start, texts.length]);
    return ranges;
  }

  function translateRanges(cues, time) {
    const texts = cues.map((cue) => cue.source);
    let idx = cues.findIndex((cue) => time >= cue.start && time < cue.end);
    if (idx < 0) idx = 0;
    const hotStart = Math.max(0, idx - 1);
    const hotEnd = Math.min(texts.length, idx + 8);
    const rest = [];
    if (hotStart > 0) rest.push(...packRanges(texts.slice(0, hotStart), 3800));
    if (hotEnd < texts.length) {
      packRanges(texts.slice(hotEnd), 3800).forEach(([from, to]) => {
        rest.push([from + hotEnd, to + hotEnd]);
      });
    }
    return { hot: [hotStart, hotEnd], rest };
  }

  async function translateCues(cues, sl, tl, lectureId, token) {
    const sourceBlob = cues.map((c) => c.source).join("\n");
    const digest = await hashSource(`${sl}|${tl}|${sourceBlob}`);
    const cacheKey = `${UDS.CACHE_PREFIX}${lectureId}:${digest}`;
    const memory = state.memoryCache.get(cacheKey);
    if (memory && memory.length === cues.length) {
      cues.forEach((cue, i) => {
        cue.target = memory[i];
      });
      log(`RAM cache ${cues.length} cues ${sl}→${tl}`);
      return;
    }
    const cached = await readCache(cacheKey);
    if (cached && Array.isArray(cached.targets) && cached.targets.length === cues.length) {
      cues.forEach((cue, i) => {
        cue.target = cached.targets[i];
      });
      state.memoryCache.set(cacheKey, cached.targets);
      log(`disk cache ${cues.length} cues ${sl}→${tl}`);
      return;
    }

    if (sl === tl) {
      cues.forEach((cue) => {
        cue.target = cue.source;
      });
      return;
    }

    const texts = cues.map((c) => c.source);
    state.translating = true;
    setStatus(`Translating ${tl}…`);
    try {
      const local = await translateWithChrome(texts, sl, tl);
      if (local) {
        local.forEach((text, i) => {
          cues[i].target = text || "";
        });
        state.memoryCache.set(cacheKey, local);
        await writeCache(cacheKey, { targets: local, at: Date.now() });
        return;
      }

      const time = state.video ? state.video.currentTime || 0 : 0;
      const plan = translateRanges(cues, time);
      log(`hot translate ${plan.hot[0]}–${plan.hot[1]} then ${plan.rest.length} batches ${sl}→${tl}`);

      const applySlice = (from, translated) => {
        translated.forEach((text, offset) => {
          cues[from + offset].target = text || "";
        });
        onTick();
      };

      const [hotFrom, hotTo] = plan.hot;
      if (hotTo > hotFrom) {
        const hot = await translateSlice(texts.slice(hotFrom, hotTo), sl, tl);
        if (token !== state.loadToken) return;
        applySlice(hotFrom, hot);
      }

      for (const [from, to] of plan.rest) {
        if (token !== state.loadToken) return;
        setStatus(`Translating ${tl} ${to}/${texts.length}…`);
        const sliceTexts = texts.slice(from, to);
        const translated = await translateSlice(sliceTexts, sl, tl);
        if (token !== state.loadToken) return;
        applySlice(from, translated);
      }

      const targets = cues.map((cue) => cue.target);
      state.memoryCache.set(cacheKey, targets);
      await writeCache(cacheKey, { targets, at: Date.now() });
    } finally {
      state.translating = false;
    }
  }

  function scheduleRetarget() {
    clearTimeout(state.retargetTimer);
    state.retargetTimer = setTimeout(() => {
      retargetLanguage().catch((err) => log(`retarget error: ${err.message || err}`));
    }, 60);
  }

  async function retargetLanguage() {
    if (!state.settings.enabled) return;
    if (!state.baseCues.length || !state.lectureId) {
      applyCaptions();
      return;
    }
    const token = ++state.loadToken;
    const sl = state.sourceLang;
    const tl = state.settings.targetLang;
    const cues = state.baseCues.map((cue) => ({
      start: cue.start,
      end: cue.end,
      source: cue.source,
      target: "",
    }));
    state.cues = cues;
    onTick();
    log(`retarget ${sl}→${tl} (keep VTT, ${cues.length} cues)`);
    try {
      await translateCues(cues, sl, tl, state.lectureId, token);
      if (token !== state.loadToken) return;
      setStatus(`Ready → ${tl} · ${cues.length} cues`, "ok");
      onTick();
    } catch (err) {
      if (token !== state.loadToken) return;
      log(`ERROR ${err.message || err}`);
      setStatus(err.message || String(err), "error");
    }
  }

  function nativeHide(on) {
    let style = document.getElementById(NATIVE_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = NATIVE_STYLE_ID;
      document.documentElement.append(style);
    }
    style.textContent = `
        #uds-caption-overlay {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          gap: 0.15em;
          pointer-events: none;
          text-align: center;
          font-size: calc(2.4rem * var(--uds-font-scale, 1));
          font-family: var(--uds-font-family, sans-serif);
        }
        #uds-caption-overlay.uds-in-native {
          position: relative;
          inset: auto;
          width: 100%;
          z-index: 2;
          padding: 0;
          top: 0;
        }
        #uds-caption-overlay.uds-fallback {
          position: fixed;
          z-index: 2147483646;
          padding: 0 4%;
          transition: top 0.18s ease-out;
        }
        #uds-caption-overlay .uds-row {
          display: block;
          box-sizing: border-box;
          width: fit-content;
          min-inline-size: 0;
          max-inline-size: min(30em, var(--uds-caption-max, 86%));
          text-align: center;
          overflow-wrap: break-word;
        }
        #uds-caption-overlay .uds-row[hidden],
        #uds-caption-overlay .uds-line[hidden],
        #uds-caption-overlay .uds-line:empty {
          display: none !important;
          padding: 0 !important;
          margin: 0 !important;
          background: none !important;
        }
        #uds-caption-overlay .uds-line {
          position: relative;
          pointer-events: none;
          display: inline;
          block-size: auto;
          color: var(--color-white, #fff);
          background-color: rgb(28 29 31 / var(--uds-bg-opacity, 1));
          font-family: inherit;
          line-height: 1.4;
          text-align: start;
          margin-block: 0 0.25em;
          margin-inline: 0.5em;
          padding-block: 0.2rem;
          padding-inline: 0.8rem;
          white-space: pre-line;
          overflow-wrap: break-word;
          word-break: normal;
          writing-mode: horizontal-tb;
          unicode-bidi: plaintext;
          direction: ltr;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
        }
        #uds-caption-overlay .uds-source {
          font-size: 0.88em;
        }
        #uds-caption-overlay .uds-target {
          margin-block: 0;
        }
        html.uds-active [class*="captions-display"] > :not(#uds-caption-overlay) {
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          overflow: hidden !important;
          pointer-events: none !important;
        }
        html.uds-active .vjs-text-track-display,
        html.uds-active [data-purpose="captions-cue"]:not(#uds-caption-overlay *),
        html.uds-active [class*="captions-cue-text"]:not(#uds-caption-overlay *) {
          visibility: hidden !important;
          opacity: 0 !important;
        }
        @media (prefers-reduced-motion: reduce) {
          #uds-caption-overlay.uds-fallback {
            transition: none;
          }
        }
      `;
    document.documentElement.classList.toggle("uds-active", Boolean(on));
  }

  function isOurCaptionNode(node) {
    return Boolean(node && (node.id === "uds-caption-overlay" || node.closest("#uds-caption-overlay")));
  }

  function findCaptionCue() {
    for (const selector of CUE_SELECTORS) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        if (isOurCaptionNode(node)) continue;
        return node;
      }
    }
    return null;
  }

  function getFullscreenEl() {
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      null
    );
  }

  function attachOverlay() {
    if (!state.overlay || !state.settings.enabled) return;
    const fs = getFullscreenEl();
    const host = fs
      ? fs.tagName === "VIDEO" && fs.parentElement
        ? fs.parentElement
        : fs
      : document.documentElement;
    if (state.overlay.parentElement !== host) {
      host.append(state.overlay);
      if (fs) log(`overlay fullscreen → ${host.tagName || "node"}`);
    }
    state.overlay.classList.add("uds-fallback");
    state.overlay.classList.remove("uds-in-native");
    state.overlayInNative = false;
    const cue = findCaptionCue();
    if (cue) cue.setAttribute("data-uds-native-cue", "1");
  }

  function isProgressBarVisible(video) {
    const videoRect = video.getBoundingClientRect();
    let node = video;
    while (node && node !== document.body) {
      const cl = node.classList;
      if (cl.contains("vjs-user-inactive") && !cl.contains("vjs-user-active")) return false;
      if (cl.contains("vjs-user-active")) return true;
      node = node.parentElement;
    }
    const root =
      video.closest(".video-js") ||
      video.closest("[class*='video-player']") ||
      video.closest("[data-purpose='curriculum-item-viewer']") ||
      video.parentElement;
    const bars = (root || document).querySelectorAll(
      ".vjs-control-bar, [class*='control-bar'], [data-purpose='video-control-bar']"
    );
    for (const bar of bars) {
      const box = bar.getBoundingClientRect();
      const css = getComputedStyle(bar);
      if (css.visibility === "hidden" || css.display === "none" || Number(css.opacity) <= 0.12) continue;
      if (box.height < 28) continue;
      if (box.bottom < videoRect.top || box.top > videoRect.bottom + 12) continue;
      if (box.top >= videoRect.bottom - 8) continue;
      return true;
    }
    if (
      state.pointerX != null &&
      state.pointerY != null &&
      state.pointerX >= videoRect.left &&
      state.pointerX <= videoRect.right &&
      state.pointerY >= videoRect.top &&
      state.pointerY <= videoRect.bottom &&
      Date.now() - state.lastPointerAt < 2800
    ) {
      return true;
    }
    return false;
  }

  function applyCaptionStyle() {
    if (!state.overlay) return;
    const scale = (Number(state.settings.fontSize) || 100) / 100;
    const opacity = Math.min(1, Math.max(0, (Number(state.settings.bgOpacity) ?? 100) / 100));
    state.overlay.style.setProperty("--uds-font-scale", String(scale));
    state.overlay.style.setProperty("--uds-font-family", fontCss(state.settings.fontFamily));
    state.overlay.style.setProperty("--uds-bg-opacity", String(opacity));
  }

  function renderCue(time) {
    if (!state.overlay || !state.settings.enabled) {
      if (state.overlay) state.overlay.style.display = "none";
      return;
    }
    const apiCue = cueAtTime(state.cues, time);
    const customCue = state.customCues ? cueAtTime(state.customCues, time) : null;
    const sourceText = (apiCue && apiCue.source) || "";
    const targetText =
      (customCue && (customCue.target || customCue.source)) ||
      (apiCue && apiCue.target) ||
      "";
    if (!sourceText && !targetText) {
      state.sourceLine.textContent = "";
      state.targetLine.textContent = "";
      state.overlay.style.display = "none";
      return;
    }
    state.overlay.style.display = "flex";
    applyCaptionStyle();
    const dual = state.settings.mode === "dual";
    const showSource = dual && Boolean(sourceText);
    const showTarget = Boolean(targetText || (!dual && sourceText));
    state.sourceLine.textContent = showSource ? sourceText : "";
    state.sourceLine.hidden = !showSource;
    if (state.sourceLine.parentElement) {
      state.sourceLine.parentElement.hidden = !showSource;
    }
    state.targetLine.textContent = showTarget ? (targetText || sourceText) : "";
    state.targetLine.hidden = !showTarget;
    if (state.targetLine.parentElement) {
      state.targetLine.parentElement.hidden = !showTarget;
    }
  }

  function placeChrome() {
    const video = state.video;
    if (!video || !state.fab || !state.panel) return;
    const rect = video.getBoundingClientRect();
    if (state.overlay) {
      if (rect.width < 80 || rect.height < 80) {
        state.overlay.style.display = "none";
      } else {
        state.overlay.style.left = `${rect.left}px`;
        state.overlay.style.width = `${rect.width}px`;
        state.overlay.style.setProperty("--uds-caption-max", `${Math.round(rect.width * 0.86)}px`);
        const raised = Math.max(108, Math.round(rect.height * 0.16));
        const gap = Math.max(24, Math.round(rect.height * 0.035));
        if (isProgressBarVisible(video)) {
          state.overlay.style.top = `${rect.bottom - raised}px`;
        } else {
          const overlayH = Math.max(state.overlay.offsetHeight, 44);
          state.overlay.style.top = `${rect.bottom - gap - overlayH}px`;
        }
      }
    }
    const fabLeft = Math.min(window.innerWidth - 132, rect.right - 124);
    const fabTop = Math.max(12, rect.top + 12);
    state.fab.style.left = `${fabLeft}px`;
    state.fab.style.top = `${fabTop}px`;
    state.panel.style.left = `${Math.min(window.innerWidth - 336, Math.max(12, rect.right - 332))}px`;
    state.panel.style.top = `${Math.min(window.innerHeight - 24, fabTop + 44)}px`;
  }

  let placeRaf = 0;
  function schedulePlace() {
    if (placeRaf) return;
    placeRaf = requestAnimationFrame(() => {
      placeRaf = 0;
      if (state.video) placeChrome();
    });
  }

  function onTick() {
    if (!state.video) return;
    attachOverlay();
    applyCaptionStyle();
    renderCue(state.video.currentTime || 0);
    placeChrome();
  }

  function bindVideo(video) {
    if (state.video === video) return;
    if (state.playerUiObserver) {
      state.playerUiObserver.disconnect();
      state.playerUiObserver = null;
    }
    state.video = video;
    video.addEventListener("timeupdate", onTick);
    video.addEventListener("play", onTick);
    video.addEventListener("seeked", onTick);
    video.addEventListener("loadedmetadata", onTick);
    video.addEventListener("webkitbeginfullscreen", onTick);
    video.addEventListener("webkitendfullscreen", onTick);
    const root =
      video.closest(".video-js") ||
      video.closest("[class*='video-player']") ||
      video.closest("[data-purpose='curriculum-item-viewer']") ||
      video.parentElement;
    if (root) {
      state.playerUiObserver = new MutationObserver(schedulePlace);
      state.playerUiObserver.observe(root, {
        attributes: true,
        attributeFilter: ["class", "style"],
        subtree: true,
      });
    }
    onTick();
  }

  function fillSourceSelect(captions, selectedLocale) {
    if (!state.sourceSelect) return;
    state.sourceSelect.innerHTML = "";
    const auto = document.createElement("option");
    auto.value = "auto";
    auto.textContent = "Auto (prefer English)";
    state.sourceSelect.append(auto);
    for (const caption of captions) {
      const option = document.createElement("option");
      option.value = caption.locale_id || "";
      option.textContent = caption.video_label || caption.locale_id || "Caption";
      state.sourceSelect.append(option);
    }
    state.sourceSelect.value = selectedLocale || "auto";
  }

  async function applyCaptions() {
    const ctx = lectureContext();
    const token = ++state.loadToken;
    if (!ctx.lectureId) {
      setStatus("Open a video lecture to run DualSub.");
      state.cues = [];
      renderCue(0);
      return;
    }
    if (!state.settings.enabled) {
      nativeHide(false);
      state.overlay.style.display = "none";
      setStatus("DualSub is off.");
      return;
    }
    nativeHide(true);
    setStatus("Fetching captions from Udemy…");
    try {
      const { captions } = await loadLectureAsset(ctx);
      if (token !== state.loadToken) return;
      state.captions = captions;
      fillSourceSelect(captions, state.settings.sourceLocale);
      const caption = pickCaption(captions, state.settings.sourceLocale);
      if (!caption || !caption.url) {
        if (state.customCues && state.customCues.length) {
          setStatus("This lecture has no captions — using your uploaded file.", "ok");
          onTick();
          return;
        }
        throw new Error("This lecture has no captions. Upload an SRT/VTT file.");
      }
      const vtt = await fetchVtt(caption.url);
      if (token !== state.loadToken) return;
      const cues = parseSubtitle(vtt);
      if (!cues.length) throw new Error("The caption file is empty or could not be parsed.");
      const sl = localeToLang(caption.locale_id);
      const tl = state.settings.targetLang;
      log(`VTT ${cues.length} cue · ${caption.locale_id || sl} → ${tl}`);
      state.baseCues = cues.map((cue) => ({
        start: cue.start,
        end: cue.end,
        source: cue.source,
      }));
      state.sourceLang = sl;
      state.lectureId = ctx.lectureId;
      state.cues = cues;
      onTick();
      await translateCues(cues, sl, tl, ctx.lectureId, token);
      if (token !== state.loadToken) return;
      setStatus(`Ready: ${caption.video_label || sl} → ${tl} · ${cues.length} cues`, "ok");
      onTick();
    } catch (err) {
      if (token !== state.loadToken) return;
      log(`ERROR ${err.message || err}`);
      state.panelOpen = true;
      if (state.panel) state.panel.hidden = false;
      setStatus(err.message || String(err), "error");
    }
  }

  function wirePanel(panel) {
    const enabled = panel.querySelector("#uds-enabled");
    const dualBtn = panel.querySelector('[data-mode="dual"]');
    const targetBtn = panel.querySelector('[data-mode="target"]');
    const targetLang = panel.querySelector("#uds-target");
    const fontSize = panel.querySelector("#uds-font");
    const fontSizeVal = panel.querySelector("#uds-font-val");
    const fontFamily = panel.querySelector("#uds-font-family");
    const bgOpacity = panel.querySelector("#uds-bg-opacity");
    const bgOpacityVal = panel.querySelector("#uds-bg-val");
    const fileInput = panel.querySelector("#uds-file");
    const fileName = panel.querySelector("#uds-file-name");
    state.sourceSelect = panel.querySelector("#uds-source");
    state.statusEl = panel.querySelector("#uds-status");

    for (const lang of UDS.TARGET_LANGS) {
      const option = document.createElement("option");
      option.value = lang.code;
      option.textContent = lang.label;
      targetLang.append(option);
    }

    fillFontSelect(fontFamily, state.settings.fontFamily);

    function syncForm() {
      enabled.checked = state.settings.enabled;
      dualBtn.setAttribute("aria-pressed", String(state.settings.mode === "dual"));
      targetBtn.setAttribute("aria-pressed", String(state.settings.mode === "target"));
      targetLang.value = state.settings.targetLang;
      fontSize.value = String(state.settings.fontSize);
      if (fontSizeVal) fontSizeVal.textContent = `${state.settings.fontSize}%`;
      if (fontFamily) fontFamily.value = state.settings.fontFamily;
      if (bgOpacity) bgOpacity.value = String(state.settings.bgOpacity);
      if (bgOpacityVal) bgOpacityVal.textContent = `${state.settings.bgOpacity}%`;
      if (state.sourceSelect) state.sourceSelect.value = state.settings.sourceLocale || "auto";
    }
    state.syncPanel = syncForm;
    syncForm();

    enabled.addEventListener("change", async () => {
      state.settings = await saveSettings({ enabled: enabled.checked });
      applyCaptions();
    });
    dualBtn.addEventListener("click", async () => {
      state.settings = await saveSettings({ mode: "dual" });
      syncForm();
      onTick();
    });
    targetBtn.addEventListener("click", async () => {
      state.settings = await saveSettings({ mode: "target" });
      syncForm();
      onTick();
    });
    targetLang.addEventListener("change", async () => {
      state.settings = await saveSettings({ targetLang: targetLang.value });
      scheduleRetarget();
    });
    state.sourceSelect.addEventListener("change", async () => {
      state.settings = await saveSettings({ sourceLocale: state.sourceSelect.value });
      applyCaptions();
    });
    fontSize.addEventListener("input", async () => {
      if (fontSizeVal) fontSizeVal.textContent = `${fontSize.value}%`;
      state.settings = await saveSettings({ fontSize: Number(fontSize.value) });
      applyCaptionStyle();
      onTick();
    });
    fontFamily.addEventListener("change", async () => {
      state.settings = await saveSettings({ fontFamily: fontFamily.value });
      applyCaptionStyle();
      onTick();
    });
    bgOpacity.addEventListener("input", async () => {
      if (bgOpacityVal) bgOpacityVal.textContent = `${bgOpacity.value}%`;
      state.settings = await saveSettings({ bgOpacity: Number(bgOpacity.value) });
      applyCaptionStyle();
      onTick();
    });
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const text = await file.text();
      const cues = parseSubtitle(text);
      if (!cues.length) {
        if (fileName) fileName.textContent = "No file chosen";
        setStatus("That SRT/VTT file has no valid cues.", "error");
        return;
      }
      cues.forEach((cue) => {
        cue.target = cue.source;
      });
      state.customCues = cues;
      if (fileName) fileName.textContent = file.name;
      setStatus(`Loaded ${cues.length} cues from ${file.name}`, "ok");
      onTick();
    });
  }

  async function mountUi() {
    if (state.host) return;
    const css = await fetch(chrome.runtime.getURL("overlay.css")).then((r) => r.text());
    const host = document.createElement("div");
    host.id = "uds-root";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = css;
    shadow.append(style);

    const fab = document.createElement("button");
    fab.className = "uds-fab";
    fab.type = "button";
    fab.innerHTML = `<span class="uds-fab-mark">CC</span><span>DualSub</span>`;
    const panel = document.createElement("div");
    panel.className = "uds-panel";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="uds-head">
        <h2 class="uds-title">DualSub</h2>
        <label class="uds-switch"><input id="uds-enabled" type="checkbox" /> On</label>
      </div>
      <div class="uds-row">
        <span class="uds-label">Mode</span>
        <div class="uds-modes">
          <button type="button" class="uds-mode" data-mode="dual" aria-pressed="true">Dual</button>
          <button type="button" class="uds-mode" data-mode="target">Target only</button>
        </div>
      </div>
      <label class="uds-row">
        <span class="uds-label">Source caption</span>
        <select id="uds-source" class="uds-select"></select>
      </label>
      <label class="uds-row">
        <span class="uds-label">Target language</span>
        <select id="uds-target" class="uds-select"></select>
      </label>
      <label class="uds-row">
        <span class="uds-label uds-label-split">Font size <span id="uds-font-val" class="uds-value">100%</span></span>
        <input id="uds-font" class="uds-range" type="range" min="50" max="160" step="5" />
      </label>
      <label class="uds-row">
        <span class="uds-label">Font</span>
        <select id="uds-font-family" class="uds-select"></select>
      </label>
      <label class="uds-row">
        <span class="uds-label uds-label-split">Caption background <span id="uds-bg-val" class="uds-value">100%</span></span>
        <input id="uds-bg-opacity" class="uds-range" type="range" min="0" max="100" step="5" />
      </label>
      <div class="uds-row">
        <span class="uds-label">Upload SRT / VTT</span>
        <label class="uds-file">
          <input id="uds-file" type="file" accept=".srt,.vtt,text/vtt,text/plain" />
          <span class="uds-file-btn">Choose file</span>
          <span class="uds-file-name" id="uds-file-name">No file chosen</span>
        </label>
      </div>
      <p id="uds-status" class="uds-status">Waiting for a lecture…</p>
    `;
    shadow.append(fab, panel);
    document.documentElement.append(host);

    const overlay = document.createElement("div");
    overlay.id = "uds-caption-overlay";
    overlay.className = "uds-overlay uds-fallback";
    overlay.innerHTML = `<div class="uds-row"><span class="uds-line uds-source"></span></div><div class="uds-row"><span class="uds-line uds-target"></span></div>`;
    document.documentElement.append(overlay);

    state.host = host;
    state.shadow = shadow;
    state.overlay = overlay;
    state.sourceLine = overlay.querySelector(".uds-source");
    state.targetLine = overlay.querySelector(".uds-target");
    state.fab = fab;
    state.panel = panel;
    wirePanel(panel);

    fab.addEventListener("click", () => {
      state.panelOpen = !state.panelOpen;
      panel.hidden = !state.panelOpen;
    });
  }

  function findVideo() {
    const fs = getFullscreenEl();
    if (fs) {
      if (fs.tagName === "VIDEO") return fs;
      const nested = fs.querySelector("video");
      if (nested) return nested;
    }
    return document.querySelector("video");
  }

  function watchPlayer() {
    const attach = () => {
      const video = findVideo();
      if (video) bindVideo(video);
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("resize", onTick);
    document.addEventListener("fullscreenchange", onTick);
    document.addEventListener("webkitfullscreenchange", onTick);
    document.addEventListener("scroll", onTick, true);
    document.addEventListener(
      "mousemove",
      (event) => {
        state.pointerX = event.clientX;
        state.pointerY = event.clientY;
        state.lastPointerAt = Date.now();
        schedulePlace();
        if (state.controlsIdleTimer) clearTimeout(state.controlsIdleTimer);
        state.controlsIdleTimer = setTimeout(schedulePlace, 2900);
      },
      { passive: true }
    );
    document.addEventListener(
      "mouseleave",
      () => {
        state.pointerX = null;
        state.pointerY = null;
        schedulePlace();
      },
      true
    );
  }

  function watchLecture() {
    const tick = () => {
      const ctx = lectureContext();
      const key = `${ctx.slug}:${ctx.lectureId}`;
      if (key === state.lectureKey) return;
      state.lectureKey = key;
      state.customCues = null;
      state.cues = [];
      state.baseCues = [];
      if (state.pendingLecture) {
        state.pendingLecture.resolve(null);
        state.pendingLecture = null;
      }
      applyCaptions();
    };
    tick();
    setInterval(tick, 700);
    window.addEventListener("popstate", tick);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.channel !== UDS.BRIDGE || msg.type !== "LECTURE_JSON") return;
    ingestLecture(msg.url, msg.text);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes[UDS.STORAGE_KEY]) return;
    const prev = state.settings;
    const next = normalizeSettings(changes[UDS.STORAGE_KEY].newValue || {});
    state.settings = next;
    if (state.syncPanel) state.syncPanel();
    const needReload = prev.enabled !== next.enabled || prev.sourceLocale !== next.sourceLocale;
    if (needReload) applyCaptions();
    else if (prev.targetLang !== next.targetLang) scheduleRetarget();
    else {
      nativeHide(next.enabled);
      onTick();
    }
  });

  async function boot() {
    state.settings = await loadSettings();
    await mountUi();
    nativeHide(state.settings.enabled);
    applyCaptionStyle();
    watchPlayer();
    watchLecture();
  }

  boot().catch((err) => {
    console.warn("[DualSub]", err);
  });
})();
