function parseTimestamp(raw) {
  const value = String(raw).trim().replace(",", ".");
  const parts = value.split(":");
  if (parts.length < 2) return 0;
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (parts.length === 3) {
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
    seconds = Number(parts[2]);
  } else {
    minutes = Number(parts[0]);
    seconds = Number(parts[1]);
  }
  if ([hours, minutes, seconds].some((n) => Number.isNaN(n))) return 0;
  return hours * 3600 + minutes * 60 + seconds;
}

function stripCueMarkup(text) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, "\n")
    .trim();
}

function parseCueBlock(timeLine, textLines) {
  if (!/-->/.test(timeLine)) return null;
  const [startRaw, endRaw] = timeLine.split("-->").map((s) => s.trim().split(/\s+/)[0]);
  const text = stripCueMarkup(textLines.join("\n"));
  if (!text) return null;
  return {
    start: parseTimestamp(startRaw),
    end: parseTimestamp(endRaw),
    source: text,
    target: "",
  };
}

function parseSubtitle(content) {
  const lines = String(content).replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
  const cues = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || /^WEBVTT/i.test(line) || line.startsWith("NOTE") || line.startsWith("STYLE") || line.startsWith("REGION")) {
      i += 1;
      continue;
    }
    if (line.includes("-->")) {
      const textLines = [];
      i += 1;
      while (i < lines.length && lines[i] && !lines[i].includes("-->")) {
        if (!/^\d+$/.test(lines[i])) textLines.push(lines[i]);
        i += 1;
      }
      const cue = parseCueBlock(line, textLines);
      if (cue) cues.push(cue);
      continue;
    }
    i += 1;
  }
  return cues;
}

function cueAtTime(cues, time) {
  if (!cues || !cues.length) return null;
  let low = 0;
  let high = cues.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = cues[mid];
    if (time < cue.start) high = mid - 1;
    else if (time >= cue.end) low = mid + 1;
    else return cue;
  }
  return null;
}
