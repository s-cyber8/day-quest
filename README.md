# היום של רפאל (Day Quest)
Hebrew PWA for a 4.5-year-old, in two worlds chosen on the home screen:

- **היום שלי**: 13 daily-routine stations on an illustrated map, each with a 3-level mini-game (real art, 3D Moka, juice), a calm corner, night mode.
- **הסיפורים שלי**: 12 choose-your-path stories (feelings, choices, repair, lesson, parent question). Hearts live inside a story; stars and stickers are never removed.
- Parent mode (hold 3 s / PIN): settings, voice recordings, and **"מה אנחנו לומדים"** (patterns from the local story log; choices in a game, not a diagnosis).

Offline, no network calls after install, no analytics. Everything is stored on the device.

## Develop
- `npm run dev` / `npm run build` / `npm test` (Playwright: iPhone SE, iPhone 13, Pixel 7). Deep links for tests: `?w=day`, `?w=stories`.
- Content: `src/content/phrases.ts` (Day phrases + emotion tags), `src/content/stories.ts` (story scripts, from `stories.he.md`), `src/content/stations.ts`.
- Art pipeline: `python3 -I scripts/assets/build_assets.py <rafael-stories dir> public` converts to WebP and cuts every sprite out with rembg (local).
- Voice-over: `npm run audio:gen` (ElevenLabs eleven_v3; tags per phrase, niqqud only in the `tts` text), `npm run audio:cer` (local Whisper CER check). Credits are tracked in `audio-work/ledger-v2.json` and generation stops before 28,000. See `scripts/audition/cer-results-v2.md` for the voice choice.
- Icons: `npm run icons`
