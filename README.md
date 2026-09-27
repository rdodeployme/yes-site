# YES — Your Environment Score (yes.com.au)

Static marketing site for YES, a Recycle Group business: a recycling certificate and a live environmental dashboard.

- `src/pages/*.html` — page fragments (inner content of `<main>`)
- `src/assets/` — design system (`style.css`), shared behaviour (`site.js`), the method engine and demo dataset (`yes-data.js`), product-shot images; `src/partials/icons.svg` is the icon sprite
- `build.py` — wraps fragments in the shared layout and writes `docs/` (build output, not committed); GitHub Actions builds and deploys it to Pages on every push to `main`. `YES_BASE_PATH` prefixes root URLs for the project-pages path (`/yes-site`) and is set to "" once yes.com.au is the custom domain; brand variables (mark, name, URL, email) live at the top of this file
- `BUILD-CONTRACT.md` — the design system, facts sheet and rules every page follows

Build: `python3 build.py` → `docs/`. Deploys via GitHub Pages (`.github/workflows/pages.yml`) or Netlify (`netlify.toml`).

Every figure on the site comes from `src/assets/yes-data.js`. Factors carry their source and status (reference / group / assumption / pending). Demo data is badged as illustrative wherever it appears.
