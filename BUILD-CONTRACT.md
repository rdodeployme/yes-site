# YES website — BUILD CONTRACT (read fully before writing a page)

**Brand: YES — Your Environment Score** (yes.com.au). The mark is the word YES; the full name "Your Environment Score" always appears with it (never the mark alone as a logo). Product family and every mention use YES, e.g. "The YES Report", "YES Certificate", "Only YES enters the data".

You are building pages for **YES — Your Environment Score** (yes.com.au), a new Recycle Group business: a recycling certificate plus a live environmental dashboard. Audience: council waste managers, sustainability/ESG leads at large companies, procurement. The site must read as **corporate, clean, evidence-based software** — the standard is RG Resources (rg-resources.netlify.app), not a waste-company brochure and never JUNK.

## 0. Output format (strict)
- Write ONLY the page fragment file you are assigned, at `/home/claude/big-site/src/pages/<name>.html`.
- A fragment is the inner content of `<main>` — **no** `<html>`, `<head>`, `<body>`, nav or footer. The build script adds those.
- Page-specific JS goes at the very end of the fragment after a line containing exactly `<!--scripts-->` (everything after it is placed before `</body>`). Use `<script src="/assets/yes-data.js"></script>` first if you need the engine.
- Placeholders you may use: `{{MARK}}` (YES), `{{NAME}}` ("Your Environment Score"), `{{URL}}` (www.yes.com.au), `{{EMAIL}}` (contact@yes.com.au), `{{POSITION}}` ("Environmental Impact Intelligence by Recycle Group"), `{{LOGO_BIG}}` (large logo lockup for light backgrounds), `{{LOGO_BIG_DARK}}` (for dark), `{{ARROW}}` (the arrow SVG for buttons).
- Do not create other files. Do not edit `style.css`, `site.js`, `yes-data.js` or `build.py`. If you need a style that does not exist, use an inline `<style>` block at the top of your fragment, scoped with a page class (the body carries `page-<slug>`, e.g. `page-demo`), and keep it small.
- Australian English. No em-dash overuse; short sentences. No exclamation marks. No emoji.

## 1. Design system (in `/home/claude/big-site/src/assets/style.css` — read it)
Palette (Recycle Group family): ink `#0B0B0B`, charcoal `#2A2A2A`, graphite `#4B4F52`, slate `#7C8184`, mist `#D6D8D3`, paper `#F4F4F2`, white; greens: `--green #166534` (deep, use on paper), `--green-2 #1F8A4C` (buttons), `--green-3 #4FC17A` (data/accents on dark), `--green-tint #E2F0E6`. **No other hues** — no blue, orange, yellow, pink, red. Landfilled = charcoal with hatch; Stored = `#A9ADA8`; Recycled = green.
Type: headings Archivo 800 (tight), body Inter, figures/labels IBM Plex Mono. Big numerals are the visual signature.
Motifs: hairline rules + mono labels ("ledger" feel), section numbers, the three-bucket bar, large stat blocks. Restraint: generous space, few boxes, no icon-heading-three-lines card grids, no gradients except the hero glow already in CSS, no stock-photo hero. Imagery slots: use `<div class="img-slot" data-img="hero-texture">` placeholders only where a photo/texture will drop in later (I am generating imagery separately); keep them few and give each a `style="aspect-ratio:16/9;background:#141514;border:1px solid #262826;border-radius:14px"` fallback so the page looks finished without them.

Page rhythm: alternate `section` (paper) / `section class="dark"` / occasional `section class="paper-2"`; end most pages with the CTA band (below). Every page starts with a hero: `<section class="dark hero-sub"><div class="hero-bg"></div><div class="hero-grid-lines"></div><div class="wrap"><p class="eyebrow">…</p><h1>…</h1><p class="lead">…</p><div class="btn-row">…</div></div></section>` (the home page uses `hero` instead of `hero-sub`).

### Components (copy these exactly)
Section header:
```html
<div class="section-head"><div><p class="eyebrow">01 · Two layers</p><h2>Heading here.</h2></div><p class="lead">Supporting line.</p></div>
```
Buttons: `<a class="btn btn-primary" href="/contact/">Talk to YES {{ARROW}}</a>` · `btn-ghost` (on dark) · `btn-outline` / `btn-ink` (on paper). Group in `<div class="btn-row">`.
Stat: `<div class="stat green"><div class="v"><span data-count="27" data-dec="0">0</span><span>t</span></div><div class="l">Steel recovered</div><div class="s">supporting note</div></div>` (counters animate via `data-count`; `data-dec` decimals; put units in the inner `<span>`).
Card: `<div class="card"><span class="card-num">01</span><h3>…</h3><p>…</p></div>` (`card accent` for a green top rule).
Feature list: `<ul class="feature-list"><li><span class="tick">✓</span><div><strong>Bold lead.</strong> Detail.</div></li></ul>`
Steps: `<ol class="steps"><li><div><h4>…</h4><p>…</p></div></li></ol>`
Bucket bar: `<div class="bucket" aria-label="…"><div class="rec" style="width:68%"></div><div class="sto" style="width:6%"></div><div class="lan" style="width:26%"></div></div>` + `<div class="legend"><span class="rec"><i></i>Recycled</span><span class="sto"><i></i>Stored</span><span class="lan"><i></i>Landfilled</span></div>`
Table: `<div class="table-wrap"><table class="table"><thead><tr><th>…</th><th class="n">…</th></tr></thead><tbody>…</tbody></table></div>`; tags: `<span class="tag">Reference</span>`, `tag pending`, `tag assume`, `tag stored`, `tag landfill`.
Callout: `<p class="callout">…</p>`; small note: `<p class="note">…</p>`; badge: `<span class="badge live"><span class="dot"></span>Live</span>`, `badge demo`.
Compare: `<div class="compare"><div class="before"><h4>Recycling reporting today</h4><ul>…</ul></div><div class="after"><h4>With YES</h4><ul>…</ul></div></div>`
CTA band (end of page):
```html
<section class="cta-band"><div class="wrap"><p class="eyebrow">Switched on in 30 days</p><h2>See your YES impact before you commit.</h2><p class="lead">Book a 30-minute walkthrough with the demo dashboard, or send us one month of data and we will show you what YES makes of it.</p><div class="btn-row mt-3"><a class="btn btn-primary" href="/contact/">Book a walkthrough {{ARROW}}</a><a class="btn btn-ghost" href="/demo/">Open the live demo</a></div></div></section>
```
Add `class="reveal"` to major blocks for a soft fade-in (never on the hero h1).

## 2. What YES is (use these words; do not drift)
- Positioning line: **{{POSITION}}** ("Environmental Impact Intelligence by Recycle Group"). Site title: "YES Environmental Impact Reporting by Recycle Group".
- Core promise: **"Measuring what recycling really achieves."** Supporting line: **"Measure. Report. Improve."**
- Stance: recycling should be more than a collection service or a recycling percentage. It should be measurable. YES measures and reports the real environmental outcomes.
- The product family (name each exactly): **YES Report** (the customer's environmental report) · **YES Dashboard** (live reporting portal) · **YES Certificate** (downloadable certificate for each project/period) · **YES Data** (underlying recovery and recycling data) · **YES Carbon** (CO₂-e measurement) · **YES Circularity** (material recovery and circular-economy outcomes) · **YES Benchmark** (comparison against previous periods or sites).
- Two layers: a **recycling certificate** and a **live environmental dashboard** that updates every time a customer hands over a stream (100 mattresses, then some aluminium, and the dashboard moves each time).
- Whole-of-organisation scope: YES reports all of a customer's recycling, not only what goes through Recycle Group (e.g. a council reports 23,000 wheelie bins collected this month and where the material went; YES updates the dashboard).
- **Only YES staff enter data.** Reason: if customers enter their own figures, the reports are not credible.
- Monthly automated "fill in the gaps" email, three buckets: **Landfilled** (counts against you) · **Recycled** (counts for you) · **Stored** (neutral, parked until it moves).
- Every calculation has a documented method (the YES Method) so it can support ESG, Scope 3 (GHG Protocol Scope 3 Category 5, waste generated in operations) and sustainability reporting. YES is evidence-based, not marketing-based: no "trees saved" headlines; equivalences are shown only with their source.
- The "Your Environment Score" tile set (dashboard/certificate headline): mattresses recycled · steel recovery % · tonnes of steel recovered · tonnes CO₂-e avoided · m³ landfill avoided · material recovery rate % · tonnes of material returned to productive use.
- Attribution line under any customer impact panel: **"Verified recycling data supplied by The Mattress Recycling Company and Recycle Group."**
- Use cases (business/council pages): environmental reporting, sustainability reporting, ESG reporting, procurement reporting, waste and recycling targets, circular-economy initiatives, internal environmental KPIs, customer and stakeholder reporting, annual sustainability reports, supplier performance reporting.
- The 13 reporting categories: mattresses · steel · aluminium · plain timber · coloured/treated timber · tyres · white goods · e-waste · clothing & textiles · concrete/bricks/rubble · vehicles · green waste · general rubbish.
- **The YES Score (PROPOSED, v0.1)** — the headline number: one score out of 100 per customer per period, shown large on the dashboard and certificate, always with the tiles beneath it. Proposed composition (state it as proposed, and show the weights): Material recovery rate 60% (recycled ÷ handed over) · Carbon performance 25% (CO₂-e avoided per tonne handed over, indexed against the YES reference basket) · Evidence quality 15% (share of tonnes backed by weighbridge dockets or processor certificates). Stored material is neutral. Landfilled material counts against. The engine exposes `YES.score(totals)` returning {score, parts}; use it rather than inventing arithmetic. Never present the YES Score as an accredited rating; it is YES's own published method, versioned.
- Go-to-market lines: "Switched on in 30 days." Councils first; business second. Run as a standalone business with its own site.

## 3. Facts sheet — CONFIRMED (may be stated plainly)
Recycle Group facts already confirmed in this account:
- Recycle Group runs Recycle North Geelong (public transfer station, 116 Furner Avenue, North Geelong VIC 3215; materials separated into 90+ streams on site) and The Mattress Recycling Company.
- Mattresses: 12,000–30,000 a month; 50%+ of Victoria's discarded mattresses. Per 10,000 mattresses: ≈800 t in, ≈270 t steel out, 99% of that steel recovered. ≈30% of a mattress is steel by mass. Shredded residual is 25% of original volume.
- $8.5m invested to recover 99% of mattress steel. One mattress takes ≈38 seconds to process.
- Accreditations: EPA Victoria registration R000312600 · ISO 9001:2015 · ISO 14001:2015 · ISO 45001:2018 · AS/NZS 5377 · NIST 800-88.
- Group value chain: collect, process, re-use, recover, reward, contract. Recovered goods are donated to community organisations (do not list them).
- Reference factors (NSW DECCW 2010, "Environmental benefits of recycling", Table 4, t CO₂-e per tonne recycled): aluminium 17.72 · steel 0.44 · timber (pallets/packaging) 1.35 · tyres 1.07 · garden organics 0.32 · concrete 0.02 · glass containers 0.62 · mixed plastics 1.59 · cardboard 0.63. Car equivalence: 4.16 t CO₂-e per family vehicle lifetime (same source). These live in `/assets/yes-data.js` — read that file; it is the single source of truth for categories, factors, statuses and the demo dataset.

## 4. Facts sheet — PROPOSED on the call (state as YES's offer; never as a result)
- Pricing: councils by population, up to 50,000 residents **$1,999 a month**; bands 50–100k, 100–200k, 200–300k, 300k+ not yet priced (show "Priced on application"). Business **$999 a month**. Establishment fee normally **$5,000–$15,000**, **waived for Foundation Members who join in the first 12 months** ("Free to join. Save up to $15,000.").
- Market comparison (indicative research, Sep 2026): entry-level sustainability/ESG reporting products around **US$2,000 a month**; enterprise custom reporting **$5,000–$15,000 a month, averaging about $11,500**. Label it "indicative market research".
- Ryan O'Toole — Chief Executive Officer, YES; leads high-performance and strategy at Recycle Group (exact title to be confirmed, so use that soft wording); background in information systems; focus on measurable, tangible results.
- Emails: contact@yes.com.au (public), ryan@yes.com.au, richard@yes.com.au (do not publish the personal ones on customer pages).

## 5. NEVER
- Never invent a client, contract, testimonial, award, certification, council relationship, recovery percentage, carbon figure, price or service location. If you need one, write "[needs confirmation]" in an HTML comment and leave the sentence out.
- Never name BHP, Rio Tinto, Mirvac or any company as a client or example on the site.
- Never use the words "revolutionary", "industry-leading", "Australia's best", "game-changing", "seamless", "cutting-edge". Never "get a free quote". The CTA is **Talk to YES** / **Book a walkthrough**.
- Never show demo numbers without the `badge demo` ("Demo data · illustrative") near them.
- Never put RG Resources, RG Connect, JUNK, Trash., Nunjara, Recycle Credits or no.com on a YES page.
- Never use JUNK green (#00ED00) or any non-palette colour.

## 6. Tone
Direct, calm, precise. Sentences that a council CFO and a sustainability manager both trust. Lead with the outcome, then the mechanism, then the proof. Headlines are statements, not slogans ("Only YES enters the data. That is why the number holds."). Avoid marketing adjectives; let the numerals and the method do the work.
