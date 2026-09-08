# Install DualSub (no GitHub account needed)

**English** · [Tiếng Việt](INSTALL.vi.md)

You do **not** need Git, a GitHub account, or the Chrome Web Store. You only download a zip and load it into Chrome.

## 1. Download the extension

1. Open the project page: [Udemy-Dual-Subtitle-Translator](https://github.com/05August/Udemy-Dual-Subtitle-Translator).
2. Click the green **Code** button.
3. Click **Download ZIP**.

Direct link: [Download ZIP](https://github.com/05August/Udemy-Dual-Subtitle-Translator/archive/refs/heads/main.zip)

## 2. Unzip the folder

1. Find `Udemy-Dual-Subtitle-Translator-main.zip` in your Downloads.
2. Double-click to unzip (or right-click → Extract).
3. You should get a folder named `Udemy-Dual-Subtitle-Translator-main`.
4. Open that folder. You must see `manifest.json` inside.  
   If you only see another folder with the same name, open that inner folder instead.

Keep this folder. Do not delete it after installing. Chrome reads the files from here.

## 3. Load it in Chrome

1. Open Chrome and go to `chrome://extensions` (paste that into the address bar).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the folder that contains `manifest.json` (the folder from step 2).
5. DualSub should appear in the list. You can pin it with the puzzle-piece icon in the Chrome toolbar.

## 4. Use it on Udemy

1. Sign in to Udemy and open a **video lecture** (not just the course homepage).
2. Look for the **DualSub** button on the player.
3. Turn it **On**, pick a target language, and choose Dual or Target only.

If captions do not show: hard-refresh the lecture (`Ctrl+Shift+R` / `Cmd+Shift+R`). The lecture must have a source caption track (English is preferred).

## Update later

1. Download a new ZIP from the same page.
2. Unzip and replace the old folder, **or** unzip to a new folder.
3. Go to `chrome://extensions` and click **Reload** on DualSub.  
   If you moved the folder, click **Load unpacked** again and pick the new folder.
4. Hard-refresh the Udemy lecture.

## Common problems

| What you see | What to do |
| --- | --- |
| “Manifest file is missing or unreadable” | You selected the wrong folder. Pick the one that **directly** contains `manifest.json`. |
| No DualSub button on the video | You are not on a lecture URL, or the page needs a hard refresh after loading the extension. |
| No captions | The lecture has no official captions. Upload an SRT/VTT from the DualSub panel, or try another lecture. |
| Extension disappeared after reboot | Chrome still needs the folder on disk. Do not delete or move it. |

You do not need to “clone”, “fork”, or “commit” anything to use DualSub.
