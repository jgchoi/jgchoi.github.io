# Repository Guidelines

## Project Structure & Module Organization

This repository contains a mobile-first Korean mafia-game host web app:

- `index.html` — application screens and static markup.
- `style.css` — layout, responsive styling, themes, and visual states.
- `script.js` — game state, role logic, screen transitions, timers, TTS, and audio effects.
- `*.mp3` — sound effects and music used by the app (`day.mp3`, `night.mp3`, `vote.mp3`, and `final.mp3`).

There is no separate source, test, or build directory. External UI dependencies (Lucide icons and Google Fonts) are loaded from their CDNs in `index.html`.

## Build, Test, and Development Commands

No package manager or build script is configured. Serve the repository as a static site during development:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/` in a browser. A local server is preferred over opening `index.html` directly because browser audio, TTS, and asset loading can depend on origin permissions.

## Coding Style & Naming Conventions

- Use four spaces for indentation, matching the existing HTML and JavaScript.
- Keep JavaScript in `script.js` and styles in `style.css`; avoid inline behavior or styles unless a small, existing UI exception requires it.
- Use `camelCase` for JavaScript variables and functions, `UPPER_SNAKE_CASE` for constant collections, and kebab-case for HTML IDs and CSS classes (for example, `btn-start-game` and `screen-night-action`).
- Preserve the existing Korean user-facing text and mobile-first responsive design.
- No formatter or linter is configured; keep changes consistently formatted and run a browser syntax check before committing.

## Testing Guidelines

There is no automated test framework or coverage requirement. Manually test a complete game flow with 3–13 players, including role reveal, night actions, discussion timer, voting, audio/TTS toggles, reset, and game-over behavior. Check both desktop and mobile-sized viewports and inspect the browser console for errors.

## Commit & Pull Request Guidelines

Existing history does not establish a consistent commit convention. Use a short, imperative subject describing one logical change, such as `Fix doctor night action` or `Update mobile layout`. Pull requests should explain the behavior changed, list manual test coverage, link related issues when applicable, and include screenshots or a short recording for visible UI changes.

## Security & Configuration Tips

Do not commit secrets or personal data. Review third-party CDN changes carefully, and keep audio or external asset references compatible with browser autoplay and permission rules.
