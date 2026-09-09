const SEP = "\n⟦UDS⟧\n";

function parseGooglePayload(payload) {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return "";
  return payload[0].map((part) => (part && part[0] ? part[0] : "")).join("");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateJoined(text, sl, tl) {
  let attempt = 0;
  while (true) {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", sl);
    url.searchParams.set("tl", tl);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text);
    const res = await fetch(url.toString());
    if (res.status === 429 || res.status === 503) {
      attempt += 1;
      if (attempt > 4) {
        throw new Error("Translate HTTP 429 — Google rate-limited. Wait about a minute, then switch language again.");
      }
      await sleep(Math.min(4000, 600 * 2 ** (attempt - 1)));
      continue;
    }
    if (!res.ok) throw new Error(`Translate HTTP ${res.status}`);
    const payload = await res.json();
    return parseGooglePayload(payload) || text;
  }
}

async function fillRange(items, sl, tl, out) {
  if (!items.length) return;
  if (items.length === 1) {
    out[items[0].index] = await translateJoined(items[0].text, sl, tl);
    return;
  }
  try {
    const translated = await translateJoined(items.map((item) => item.text).join(SEP), sl, tl);
    const parts = translated.split(SEP);
    if (parts.length === items.length) {
      items.forEach((item, idx) => {
        out[item.index] = (parts[idx] || "").trim() || item.text;
      });
      return;
    }
  } catch (err) {
    if (/HTTP 429/.test(String(err.message))) throw err;
  }
  const mid = Math.ceil(items.length / 2);
  await fillRange(items.slice(0, mid), sl, tl, out);
  await fillRange(items.slice(mid), sl, tl, out);
}

async function translateAll(texts, sl, tl) {
  const out = texts.map((text) => text || "");
  const nonempty = [];
  texts.forEach((text, index) => {
    if (text && text.trim()) nonempty.push({ index, text });
  });
  if (!nonempty.length) return out;
  await fillRange(nonempty, sl, tl, out);
  return out;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === "FETCH_TEXT") {
    const url = String(message.url || "");
    if (!/^https?:\/\//i.test(url)) {
      sendResponse({ ok: false, error: "Invalid caption URL" });
      return true;
    }
    fetch(url)
      .then((res) => {
        if (!res || !res.ok) throw new Error(`HTTP ${res && res.status ? res.status : "error"}`);
        return res.text();
      })
      .then((text) => sendResponse({ ok: true, text }))
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }

  if (message && message.type === "TRANSLATE") {
    translateAll(message.texts || [], message.sl || "auto", message.tl || "vi")
      .then((texts) => sendResponse({ ok: true, texts }))
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }

  return false;
});
