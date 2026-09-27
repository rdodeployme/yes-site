# YES — ART DIRECTION v2 ("100x the design")

Read this after BUILD-CONTRACT.md. The contract's facts, NEVER list and components still apply. This document raises the craft bar. The standard: **enterprise SaaS a serious brand paid a serious studio for — Stripe, Linear, Bloomberg-terminal precision — never AI-looking, never a Canva template.** Matte, not glossy.

## The direction: "Precision ledger"
- Layout: **asymmetric editorial**. Left-aligned, big display moments, hairline rules, mono labels, generous air. Never centre everything.
- Mood: technical / precise / calm. Confidence comes from big numerals and restraint, not effects.
- Type ladder (only these sizes per screen, ≤4 visible): display `.display` (clamp 56–132px) for the one number or line that matters · h1/h2 as in style.css · body 17px · mono labels 11–12px.
- Colour: near-black `#0B0B0B` / off-white `#F4F4F2` canvas; **one accent doing emphatic work per screen** (`--green-3` on dark, `--green` on paper). Landfilled = charcoal hatch, Stored = `#A9ADA8`. Nothing else. No gradients except the existing hero glow; no glass, no glow, no bevels.
- Depth: hairlines + one soft shadow language (already in `.shot` / `.card`). Radius family: 10px panels, 5px buttons. Do not add new radii.
- Texture: the fine grain on dark sections is already applied globally (one flourish, used once). Do not add more texture.
- Motion: existing reveal/counters only. Nothing bouncy.

## New shared components (already in style.css / site.js / icon sprite — use them, do not re-implement)
- **Icons**: a 30-symbol sprite is injected on every page. Use `<svg class="ic g"><use href="#i-…"/></svg>`. Stream icons: `i-mattress i-steel i-alu i-timber i-timber2 i-tyre i-white i-ewaste i-cloth i-rubble i-car i-green i-bin`. Metric/UI icons: `i-rate i-co2 i-landfill i-loop i-doc i-dash i-ledger i-verify i-mail i-scale i-bench i-export i-clock i-site i-weigh i-lock i-carsolid`. One stroke weight, one size grid: `.ic` 22px, `.ic.lg` 28px. Inside `.kpi` and `.stat`, an `.ic` auto-positions top-right.
- **Gauge**: `<div class="gauge" id="g1"></div>` then `YES.gauge(el, totals.score, 160)`; update with `YES.gaugeUpdate(el, score)`. `.gauge.on-paper` for light backgrounds.
- **Display numerals**: `<div class="display g">583<span class="u">t</span></div>` for the one hero number in a section; `.big-stat` blocks for a column of large stats on dark.
- **Section index**: `<span class="sec-idx">01</span>` above a section's eyebrow for the editorial numbered feel (use on the main sections of a page, not every block).
- **Product shots** (real renders of the product, not mockups): `/assets/img/product-certificate.webp` (page 1, 1588×2470), `/assets/img/product-certificate-2.webp`, `/assets/img/product-dashboard.webp` (1600×1858). Wrap: `<div class="shot paper tilt"><img src="/assets/img/product-certificate.webp" alt="YES Certificate, page one" loading="lazy" width="1588" height="2470"></div>`; `.shot` (dark) / `.shot.paper` (light) / `.tilt` `.tilt-r` for a subtle perspective. Use them as the hero visual of a section — one strong asset, not a collage.
- **Split panel**: `<div class="split"><div class="media"><img …></div><div>…copy…</div></div>` for image + copy sections.
- **Footer wordmark**: `<div class="foot-mark">YES</div>` is being added by the build in the footer — do not add another.

## Template tells to design OUT (audit your pages for these and fix)
1. Uniform card grids of icon + heading + three lines → replace with an editorial list (numbered `steps`), a split panel with a product shot, or a table with hairlines. Cards are allowed only when they hold a distinct object (a plan, a product) — max one card grid per page.
2. Everything the same size → add one `.display` moment per page (the number or the line that matters most).
3. Centred blocks → left-align.
4. Decorative icons → icons only where they label a stream or a metric (tiles, table rows, feature rows).
5. Empty "hero on a stock photo" → our heroes stay typographic on matte black (the home hero gets the springs photo layer; the others do not).
6. Long paragraphs at full width → measure ≤ 66ch.
7. Chips used as decoration → chips only for real lists (categories, use cases), once per page.

## Per-page must-haves
- **Home**: 02 Two layers becomes a product spotlight — dashboard shot (dark, `.shot.tilt`) beside the certificate shot (`.shot.paper.tilt-r`) with the two-layer copy; 03 Your Environment Score gets the gauge + icon tiles (compute live); 06 Built on real recovery becomes a dark band of `.display` numerals (30,000 mattresses a month upper range; 99% of steel; 90+ streams; 50%+ of Victoria's mattresses) — the scale must register.
- **YES Report**: dashboard section uses the real dashboard shot with a caption strip, not a hand-drawn mock; certificate section shows the certificate shot (page 1) beside the spec list; product family becomes a numbered editorial list with an icon per product (i-doc, i-dash, i-verify, i-ledger, i-co2, i-loop, i-bench) — not a card grid.
- **Demo**: KPI tiles get icons (`.kpi .ic`); the score row uses `YES.gauge` (and `gaugeUpdate` on every handover); category bars get the stream icon before the label; equivalences get `i-carsolid` / `i-landfill` / `i-steel`.
- **Calculator**: results card gets the gauge and icon tiles; input rows get the stream icon before the label.
- **Councils / Business**: one `.split` panel with the dashboard or certificate shot; 30-day timeline keeps; the "what you receive" list uses icons per row (i-dash, i-mail, i-doc, i-export, i-ledger, i-verify); FAQ stays.
- **Pricing**: keep the two plan cards (they are objects), give each a `.display`-scale price; market comparison stays; Foundation Members band gets a `.display` "$15,000".
- **Method**: factor table stays (it is the product); principles as a numbered editorial list with icons; sources table stays.
- **How it works**: steps stay; three buckets get a large three-bucket bar with `.display` tonnes; timeline stays; "what you receive" with icons.
- **About**: infrastructure numbers as `.display`; leadership stays; the lockup block stays.

## Self-check before you hand back
Squint: one focal point per screen? At 390px still intentional? Primary CTA the loudest thing? Every template tell above removed? Only brand colours? Would this sit on the site of a company charging $1,999 a month?
