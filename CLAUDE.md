# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FBB Workout Logger — a vanilla JavaScript PWA for logging functional bodybuilding workouts. Tracks exercises, sets, reps, holds, weight, tempo, rest, and notes. Data is stored locally in IndexedDB and can be exported as markdown.

## Running Locally

No build step. Serve the directory with any static HTTP server:

```
python -m http.server
```

Then visit `http://localhost:8000/FBB/`. The app assumes a `/FBB/` base path.

## Deployment

GitHub Pages via `.github/workflows/static.yml`, triggered on push to `main`.

## Architecture

Vanilla ES6 modules with no framework or build tooling. All JS is loaded as modules from `index.html`.

**Module responsibilities:**

- **`js/app.js`** — Entry point. Registers service worker, initializes UI.
- **`js/ui.js`** — All UI rendering and event handling. Three views: today (editing), history (calendar + list), and readonly (viewing past days). Auto-saves with 300ms debounce.
- **`js/workout.js`** — Data model and business logic. Exercises contain sets; exercises can be grouped into supersets via `supersetId`.
- **`js/db.js`** — IndexedDB wrapper (database: `fbb-workout-log`). Workouts keyed by date string.
- **`js/markdown.js`** — Export to markdown (single day or date range). Supports file download and clipboard copy.
- **`sw.js`** — Service worker with cache-first strategy. Cache version is `fbb-v4` — **must be manually bumped when assets change**.

## Key Data Model

Workouts are keyed by date (`"2026-04-01"`). Each workout has an array of exercises. Each exercise has an array of sets. Sets track either reps or holdSeconds (mutually exclusive), plus weight, unit, restSeconds, and notes. Exercises can have a `tempo` string and a `supersetId` for grouping.

## Important Notes

- No test framework or linter is configured.
- The service worker cache version in `sw.js` must be incremented manually after changing any cached assets.
- All number inputs use `inputmode="numeric"` for mobile keypad.
- The app is offline-capable after first load.
