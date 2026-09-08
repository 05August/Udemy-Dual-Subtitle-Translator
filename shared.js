const UDS = {
  STORAGE_KEY: "uds_settings",
  CACHE_PREFIX: "uds:cache:",
  BRIDGE: "UDS_BRIDGE",
  DEFAULTS: {
    enabled: true,
    mode: "dual",
    targetLang: "vi",
    sourceLocale: "auto",
    fontSize: 100,
    fontFamily: "sans",
    bgOpacity: 100,
  },
  FONT_PRESETS: [
    { id: "sans", label: "Sans (default)", css: "sans-serif" },
    { id: "system", label: "System UI", css: 'system-ui, "Segoe UI", sans-serif' },
    { id: "arial", label: "Arial", css: "Arial, Helvetica, sans-serif" },
    { id: "tahoma", label: "Tahoma", css: "Tahoma, Geneva, sans-serif" },
    { id: "verdana", label: "Verdana", css: "Verdana, Geneva, sans-serif" },
    { id: "georgia", label: "Georgia", css: "Georgia, 'Times New Roman', serif" },
    { id: "times", label: "Times New Roman", css: '"Times New Roman", Times, serif' },
    { id: "courier", label: "Courier New", css: '"Courier New", Courier, monospace' },
  ],
  TARGET_LANGS: [
    { code: "ar", label: "Arabic" },
    { code: "bn", label: "Bengali" },
    { code: "bg", label: "Bulgarian" },
    { code: "my", label: "Burmese" },
    { code: "ca", label: "Catalan" },
    { code: "zh-CN", label: "Chinese (Simplified)" },
    { code: "zh-TW", label: "Chinese (Traditional)" },
    { code: "hr", label: "Croatian" },
    { code: "cs", label: "Czech" },
    { code: "da", label: "Danish" },
    { code: "nl", label: "Dutch" },
    { code: "en", label: "English" },
    { code: "tl", label: "Filipino" },
    { code: "fi", label: "Finnish" },
    { code: "fr", label: "French" },
    { code: "ka", label: "Georgian" },
    { code: "de", label: "German" },
    { code: "el", label: "Greek" },
    { code: "he", label: "Hebrew" },
    { code: "hi", label: "Hindi" },
    { code: "hu", label: "Hungarian" },
    { code: "id", label: "Indonesian" },
    { code: "it", label: "Italian" },
    { code: "ja", label: "Japanese" },
    { code: "km", label: "Khmer" },
    { code: "ko", label: "Korean" },
    { code: "lo", label: "Lao" },
    { code: "ms", label: "Malay" },
    { code: "mr", label: "Marathi" },
    { code: "ne", label: "Nepali" },
    { code: "no", label: "Norwegian" },
    { code: "fa", label: "Persian" },
    { code: "pl", label: "Polish" },
    { code: "pt", label: "Portuguese" },
    { code: "ro", label: "Romanian" },
    { code: "ru", label: "Russian" },
    { code: "sr", label: "Serbian" },
    { code: "sk", label: "Slovak" },
    { code: "es", label: "Spanish" },
    { code: "sw", label: "Swahili" },
    { code: "sv", label: "Swedish" },
    { code: "ta", label: "Tamil" },
    { code: "te", label: "Telugu" },
    { code: "th", label: "Thai" },
    { code: "tr", label: "Turkish" },
    { code: "uk", label: "Ukrainian" },
    { code: "ur", label: "Urdu" },
    { code: "vi", label: "Vietnamese" },
  ],
};

function localeToLang(localeId) {
  if (!localeId) return "en";
  const map = {
    en_US: "en",
    en_GB: "en",
    zh_CN: "zh-CN",
    zh_TW: "zh-TW",
    pt_BR: "pt",
    pt_PT: "pt",
    he_IL: "he",
    ar_AR: "ar",
    ja_JP: "ja",
    ko_KR: "ko",
    vi_VN: "vi",
    th_TH: "th",
    id_ID: "id",
    hi_IN: "hi",
    fr_FR: "fr",
    de_DE: "de",
    es_ES: "es",
    it_IT: "it",
    nl_NL: "nl",
    pl_PL: "pl",
    tr_TR: "tr",
    uk_UA: "uk",
    ru_RU: "ru",
    sv_SE: "sv",
    da_DK: "da",
    fi_FI: "fi",
    cs_CZ: "cs",
    el_GR: "el",
    hu_HU: "hu",
    tl_PH: "tl",
  };
  if (map[localeId]) return map[localeId];
  return localeId.split("_")[0].toLowerCase();
}

function fontCss(id) {
  const preset = UDS.FONT_PRESETS.find((item) => item.id === id);
  return (preset && preset.css) || "sans-serif";
}

function fillFontSelect(select, selected) {
  if (!select) return;
  select.innerHTML = "";
  for (const font of UDS.FONT_PRESETS) {
    const option = document.createElement("option");
    option.value = font.id;
    option.textContent = font.label;
    select.append(option);
  }
  select.value = selected && UDS.FONT_PRESETS.some((item) => item.id === selected) ? selected : "sans";
}

function normalizeSettings(raw) {
  const next = { ...UDS.DEFAULTS, ...(raw || {}) };
  let size = Number(next.fontSize);
  if (!Number.isFinite(size)) size = 100;
  if (size > 0 && size <= 40) size = 100;
  next.fontSize = Math.min(160, Math.max(50, Math.round(size)));
  let opacity = Number(next.bgOpacity);
  if (!Number.isFinite(opacity)) opacity = 100;
  next.bgOpacity = Math.min(100, Math.max(0, Math.round(opacity)));
  if (!UDS.FONT_PRESETS.some((item) => item.id === next.fontFamily)) next.fontFamily = "sans";
  return next;
}

async function loadSettings() {
  const data = await chrome.storage.sync.get(UDS.STORAGE_KEY);
  return normalizeSettings(data[UDS.STORAGE_KEY]);
}

async function saveSettings(partial) {
  const current = await loadSettings();
  const next = normalizeSettings({ ...current, ...partial });
  await chrome.storage.sync.set({ [UDS.STORAGE_KEY]: next });
  return next;
}

function sendRuntime(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(response);
    });
  });
}
