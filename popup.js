async function initPopup() {
  const form = document.getElementById("form");
  const enabled = document.getElementById("enabled");
  const targetLang = document.getElementById("targetLang");
  const fontSize = document.getElementById("fontSize");
  const fontSizeVal = document.getElementById("fontSizeVal");
  const fontFamily = document.getElementById("fontFamily");
  const bgOpacity = document.getElementById("bgOpacity");
  const bgOpacityVal = document.getElementById("bgOpacityVal");
  const hint = document.getElementById("hint");

  for (const lang of UDS.TARGET_LANGS) {
    const option = document.createElement("option");
    option.value = lang.code;
    option.textContent = lang.label;
    targetLang.append(option);
  }

  const settings = await loadSettings();
  fillFontSelect(fontFamily, settings.fontFamily);
  enabled.checked = settings.enabled;
  fontSize.value = String(settings.fontSize);
  fontSizeVal.textContent = `${settings.fontSize}%`;
  bgOpacity.value = String(settings.bgOpacity);
  bgOpacityVal.textContent = `${settings.bgOpacity}%`;
  targetLang.value = settings.targetLang;
  form.querySelector(`input[name="mode"][value="${settings.mode}"]`).checked = true;

  async function persist() {
    fontSizeVal.textContent = `${fontSize.value}%`;
    bgOpacityVal.textContent = `${bgOpacity.value}%`;
    await saveSettings({
      enabled: enabled.checked,
      mode: form.querySelector('input[name="mode"]:checked').value,
      targetLang: targetLang.value,
      fontSize: Number(fontSize.value),
      fontFamily: fontFamily.value,
      bgOpacity: Number(bgOpacity.value),
    });
  }

  form.addEventListener("change", persist);
  fontSize.addEventListener("input", persist);
  bgOpacity.addEventListener("input", persist);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && /udemy\.com/.test(tab.url)) {
    hint.textContent = /\/learn\/lecture\//.test(tab.url)
      ? "You are on a lecture — change settings here or in the video panel."
      : "Open a lecture in the course so DualSub can attach to the player.";
  }
}

initPopup().catch((err) => {
  document.getElementById("hint").textContent = String(err.message || err);
});
