# Cut Buddy

Cut Buddy is a static web app for voice-driven cut-list capture and 1D stock optimization.

## Current App State (February 7, 2026)
- Two primary experiences:
  - Record experience for fast voice capture with confidence feedback.
  - Plan experience for unit selection, stock configuration, and optimization results.
- Client-side speech recognition and text-to-speech confirmation.
- Fraction-capable measurement parsing (with known edge-case backlog in `plan.md`).
- Best Fit Decreasing cutting-stock heuristic with kerf-aware waste and utilization metrics.
- Local persistence via `localStorage`.
- PWA shell (`manifest.webmanifest`, `sw.js`).

## Project Files
- `index.html` - app structure and UI regions.
- `styles/main.css` - responsive styling for Record and Plan views.
- `scripts/app.js` - speech capture, parsing, state, unit formatting, and optimization.
- `SPEC.md` - product requirements and success criteria.
- `plan.md` - execution plan and future change list.
- `UI_DESIGN.md` - UI architecture and interaction principles.

## Run Locally
```bash
cd /Users/brendan/dev/cut-buddy
python3 -m http.server 8080
```
Open `http://localhost:8080`.
