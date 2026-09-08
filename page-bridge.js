(() => {
  const CHANNEL = "UDS_BRIDGE";
  const cache = {
    lecture: null,
    resources: [],
  };

  function toUrl(input) {
    if (!input) return "";
    if (typeof input === "string") return input;
    if (typeof input.url === "string") return input.url;
    try {
      return String(input);
    } catch {
      return "";
    }
  }

  function isLectureApi(url) {
    return typeof url === "string" && url.includes("/api-2.0/") && /\/lectures\/\d+/.test(url);
  }

  function rememberResource(url) {
    if (!url || !url.includes("/api-2.0/")) return;
    cache.resources.push(url);
    if (cache.resources.length > 40) cache.resources = cache.resources.slice(-40);
  }

  function publishLecture(url, text) {
    if (!text || text.length < 200) return;
    try {
      const data = JSON.parse(text);
      const captions = data && data.asset && data.asset.captions;
      if (!Array.isArray(captions) || !captions.length) return;
    } catch {
      return;
    }
    cache.lecture = { url, text, at: Date.now() };
    rememberResource(url);
    window.postMessage({ channel: CHANNEL, type: "LECTURE_JSON", url, text }, "*");
  }

  function snapshot() {
    const resources = cache.resources.slice();
    try {
      for (const entry of performance.getEntriesByType("resource")) {
        if (entry && typeof entry.name === "string" && entry.name.includes("/api-2.0/")) {
          resources.push(entry.name);
        }
      }
    } catch {
      /* ignore */
    }
    let globals = {};
    try {
      const ud = window.UD;
      globals = {
        hasUD: Boolean(ud),
        udKeys: ud && typeof ud === "object" ? Object.keys(ud).slice(0, 30) : [],
        courseId:
          (ud && ud.course && ud.course.id) ||
          (ud && ud.config && ud.config.course_id) ||
          (ud && ud.request && ud.request.course && ud.request.course.id) ||
          "",
      };
    } catch (err) {
      globals = { error: String(err && err.message ? err.message : err) };
    }
    return {
      lecture: cache.lecture,
      resources: Array.from(new Set(resources)).slice(-25),
      globals,
      href: location.href,
    };
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.channel !== CHANNEL) return;

    if (msg.type === "PING") {
      window.postMessage({ channel: CHANNEL, type: "SNAPSHOT", id: msg.id, snapshot: snapshot() }, "*");
      return;
    }

    if (msg.type !== "FETCH") return;
    try {
      const res = await fetch(msg.url, {
        credentials: "include",
        headers: {
          Accept: "application/json, text/plain, */*",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      const text = await res.text();
      if (isLectureApi(msg.url) && res.ok) publishLecture(msg.url, text);
      window.postMessage(
        {
          channel: CHANNEL,
          id: msg.id,
          ok: res.ok,
          status: res.status,
          text,
        },
        "*"
      );
    } catch (err) {
      window.postMessage(
        {
          channel: CHANNEL,
          id: msg.id,
          ok: false,
          error: String(err && err.message ? err.message : err),
        },
        "*"
      );
    }
  });

  const originalFetch = window.fetch;
  window.fetch = async function udsWrappedFetch(...args) {
    const res = await originalFetch.apply(this, args);
    try {
      const url = toUrl(args[0]);
      rememberResource(url);
      if (isLectureApi(url)) {
        const clone = res.clone();
        clone.text().then((text) => publishLecture(url, text)).catch(() => {});
      }
    } catch {
      /* page playback must not break */
    }
    return res;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function udsOpen(method, url, ...rest) {
    this.__udsUrl = toUrl(url);
    return originalOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function udsSend(...args) {
    this.addEventListener("load", function onUdsLoad() {
      try {
        const url = toUrl(this.__udsUrl);
        rememberResource(url);
        if (isLectureApi(url) && this.responseText) publishLecture(url, this.responseText);
      } catch {
        /* ignore */
      }
    });
    return originalSend.apply(this, args);
  };

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) rememberResource(entry.name);
    });
    observer.observe({ type: "resource", buffered: true });
  } catch {
    /* older browsers */
  }
})();
