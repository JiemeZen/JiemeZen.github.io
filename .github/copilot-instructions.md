# Copilot Instructions for JiemeZen.github.io

## What this repo is
Personal website (`jimmyzeng.tech`, served via GitHub Pages, custom domain in `CNAME`). It is a **static site with no build step** — top-level `.html` files (`index.html`, `about.html`, `projects.html`, `travel.html`, `blog.html`, etc.) are edited and deployed as-is. There is no bundler, package.json, or CI at the repo root; `git push` to the Pages branch is the deploy mechanism.

Nested inside the same repo are a few **independent sub-projects**, each with its own scope and stack — treat them separately from the root site and from each other:
- `bazhi-guru/` — vanilla JS single-page app (BaZhi/Chinese fortune-telling consultation), Firebase Auth + Firestore, calls the backend below.
- `bazhi-backend/` — small Node serverless backend (`api/chat.js`) deployed to Vercel (`vercel.json`), proxies calls to the DeepSeek API so the API key stays server-side. Has its own `package.json` (`node-fetch` dependency).
- `shareTab/` — vanilla JS expense-splitting app, uses the Firebase v10 **modular** SDK via ES module imports directly from `gstatic.com` (no npm install needed).
- `xiaowen/`, `photography/`, `resume/`, `archive/` — smaller standalone pages/mini-sites, mostly static HTML/CSS with page-local assets.

## Build / test / lint
There are no build, lint, or test tooling/scripts anywhere in this repo (root or sub-projects). Changes are validated by opening the HTML files directly in a browser (or a simple static server, e.g. `python3 -m http.server`) and checking behavior manually. Do not introduce a build pipeline, package manager config, or test framework unless the user explicitly asks for it.

For `bazhi-backend`, deployment is via `vercel` CLI / Vercel's GitHub integration — there's no local test harness; verify by hitting the deployed `/api/chat` endpoint or reasoning through the code directly.

## Architecture / conventions to know

### Shared header/footer via runtime include, not templating
Pages don't share a templating system. Instead, each root-level HTML page has an empty `<div id="footer-container"></div>` before the closing scripts, and `assets/js/main.js` calls `loadHTML('footer.html', 'footer-container')` to fetch and inject `footer.html` at runtime via AJAX. When editing the shared footer, edit `footer.html` once — don't duplicate it into individual pages. The same pattern may be extended for other shared fragments; check `assets/js/main.js` for `loadHTML` calls before assuming markup is duplicated per page.

### Root site is based on the "Massively" HTML5UP template
`assets/css`, `assets/js`, `assets/sass`, and `assets/webfonts` are the (customized) Massively template assets — dark mode, timeline, and other enhancements were layered on top per the README. Prefer editing the SCSS partials under `assets/sass/{base,components,layout,libs}` and recompiling rather than hand-editing `assets/css/main.css` directly if a SCSS toolchain is set up locally (none is checked into the repo — there's no `main.css` build script here).

### `js/` vs `assets/js/`
`assets/js/` holds the template/vendor scripts (jQuery, breakpoints, scrollex, `util.js`, `main.js` for the include/loadHTML logic). `js/` (with `js/data`, `js/three`, `js/vendor`) holds page-specific data and libraries (e.g. Three.js) for individual features — check which one a page loads before adding new shared behavior.

### Firebase usage differs between sub-apps — match the existing style per app
- `bazhi-guru/src/config.js` uses the **Firebase compat/namespaced SDK** (`firebase.initializeApp`, `firebase.auth()`, global `firebase` script tag) and calls the DeepSeek proxy at `BACKEND_API_URL` (a Vercel URL) rather than any API directly from the client.
- `shareTab/src/config.js` uses the **Firebase v10 modular SDK** imported as ES modules straight from `gstatic.com` — no bundler needed, but syntax (imports/exports) differs from `bazhi-guru`. Follow whichever pattern the sub-app you're editing already uses; don't mix the two styles within one app.

### Secrets / API keys
`bazhi-backend/api/chat.js` keeps the DeepSeek API key server-side (read from an environment variable) specifically so it's never exposed in client JS — client apps (`bazhi-guru`) always call through this proxy, never the DeepSeek API directly. Preserve this separation; don't add secret keys to any file under `bazhi-guru/`, `shareTab/`, or other client-side code. CORS in `chat.js` is restricted to an explicit `allowedOrigins` allowlist (localhost dev ports, `jiemezen.github.io`, `www.jimmyzeng.tech`) — update that list if adding a new deploy origin.

### Content data
`contents/proj_articles.json` and `resume/resume_*.json` drive some page content as data files rather than hardcoded HTML — check for a JSON data file before assuming a page's content is only in its `.html`.
