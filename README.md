# Udemy Dual Subtitle Translator

**English** · [Tiếng Việt](README.vi.md)

Chrome extension that shows **original + translated captions** on Udemy lectures — including a language the course does not offer.

Free, unofficial, and not affiliated with Udemy.

## Features

- Dual captions (source + target) or target-only
- Translate into a language missing from the course
- Upload your own SRT / VTT
- Font, size, and caption background opacity

## Install (unpacked)

1. Download or clone this folder.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select this project folder (the one with `manifest.json`).
5. Open a Udemy lecture and use the **DualSub** button on the player.

Reload the extension, then hard-refresh the lecture page after you pull updates.

## Requirements

- Chrome (Manifest V3)
- Signed in to Udemy with access to the lecture
- A source caption track on the lecture (English is preferred)

Caption text is sent to Google’s public translate endpoint to produce the target language. Do not use this if that is not acceptable for your course or organization.

## Request a language

Need a target language that is not in the list?  
**[Open a language request](issues/new?template=language-request.yml)** — GitHub fills in the form for you.

## Disclaimer

This project is for personal, non-commercial learning. It is **not** affiliated with, endorsed by, or supported by Udemy, Inc.

Using it may conflict with Udemy’s terms of service. You are responsible for how you use it. The software is provided **as is**, without warranty.

## License

[MIT](LICENSE)
