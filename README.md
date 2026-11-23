# Prima Vista

Sight-reading exercises and music-theory tasks for piano teachers, made for use on the iPad in lessons.

**Open the app:** https://joachen99.github.io/primavista/

## What it does

- **Sight-reading (prima vista):** generates new piano exercises at six levels, from five-finger pieces in C major to sixteenth notes and Alberti bass. Each exercise can be played back, or played through with a metronome and a line that moves through the music in time while the music already played disappears.
- **Theory tasks:** note names (with an adjustable range for each clef), intervals, keys, triads and scales, with an answer key for printing.
- **Theory exams:** multiple-choice exams with an optional time limit and results by topic.
- **Repeatable:** every sheet and exam has a code, so the same settings and code always give the same material.
- **English and Norwegian** (Norwegian uses the H-system: H, B, fiss, ess).

## Install on an iPad

1. Open the link above in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open Prima Vista from the home screen once while online. After that it also works offline.

## Development

The app is a single self-contained page with no backend and no tracking.

```bash
python3 build.py                 # builds index.html and sw.js
node tests/test_generators.js    # generator tests, must report 0 failures
python3 tests/ui_smoke.py        # browser smoke test (needs Playwright)
python3 -m http.server 8765      # local preview at http://localhost:8765
```

| File | Purpose |
| --- | --- |
| `gen.js` | All music logic: exercise and task generators, note and key names |
| `template.html` | User interface, styles and translations |
| `build.py` | Inlines `gen.js` and abcjs into `index.html`, generates `sw.js` |
| `sw.template.js` | Service worker for offline use |
| `manifest.webmanifest`, `icons/` | Home-screen app settings and icons |
| `fonts/`, `vendor/` | Bundled fonts and the abcjs notation library |

Every push to `main` builds the app, runs the tests and publishes it to GitHub Pages.

## Third-party components

- [abcjs](https://github.com/paulrosen/abcjs) 6.7.3, MIT license (`vendor/abcjs-LICENSE.md`)
- [Fraunces](https://github.com/undercasetype/Fraunces) and [Inter](https://github.com/rsms/inter) fonts, SIL Open Font License 1.1 (`fonts/`)

## License

Copyright © 2026 Joachim Engeli. All rights reserved.

The source code is visible here for reference only. No permission is granted to copy, modify or distribute it without written consent. The third-party components above keep their own licenses.
