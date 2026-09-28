#!/usr/bin/env python3
"""Yarta site builder — wraps page fragments in the shared layout and writes dist/.
Usage: python3 build.py
"""
import os, re, shutil, json, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
DIST = os.path.join(ROOT, "docs")   # GitHub Pages serves /docs on main
BASE_PATH = os.environ.get("YES_BASE_PATH", "/yes-site")   # "" once yes.com.au is attached as the custom domain
# Contact form: "netlify" posts to Netlify Forms; "mailto" opens a pre-filled email (GitHub Pages has no form backend).
# Netlify sets NETLIFY=true in its build environment, so a Netlify build picks the form backend automatically.
FORM_MODE = os.environ.get("YES_FORM") or ("netlify" if os.environ.get("NETLIFY") == "true" else "mailto")

# ---- brand variables (one place to change) -------------------------------
MARK = "YARTA"
NAME_LINES = ["Environmental", "Sustainability"]   # the full name, always shown with the mark
NAME_FULL = "Environmental Sustainability"
URL = "www.yes.com.au"
EMAIL = "contact@yes.com.au"
POSITION = "Environmental Impact Intelligence"
SITE_TITLE = "Yarta · Environmental Sustainability · A Recycle Group initiative"
DOMAIN = "https://yes.com.au"

PAGES = [
    # path, nav label (None = not in nav), fragment file, <title>, meta description
    ("/",                 None,           "index.html",        "Yarta — Measure. Understand. Report. Improve.",       "Yarta is an environmental sustainability report and live dashboard for councils and businesses: one score, the verified figures behind it, and a roadmap to improvement."),
    ("/how-it-works/",    "How it works", "how-it-works.html", "How Yarta works — from your data to a headline number",     "Send the records you already hold. Yarta enters them, grades the evidence, moves your dashboard and issues your report with a roadmap to improvement."),
    ("/yes-report/",      "The Yarta Report","yes-report.html",  "The Yarta Report — the report, the dashboard and the data",     "The Yarta Report is two layers: a report for each project or period and a live environmental dashboard, backed by Yarta Data, Yarta Carbon, Yarta Circularity and Yarta Benchmark."),
    ("/demo/",            "Live demo",    "demo.html",         "Live demo — the Yarta dashboard, by sector",           "The Yarta environmental sustainability dashboard on demo data: pick a sector, see the score, the categories, the figures and the roadmap to improvement."),
    ("/recycling-demo/",  None,           "recycling-demo.html", "Recycling demo — Hepburn Shire hard waste program",  "The recycling dashboard for a council hard waste program on illustrative data: add a stream and watch the numbers move."),
    ("/calculator/",      None,           "calculator.html",   "Recycling calculator — what your recycling achieves",    "Enter what you recycled and see the Yarta impact: tonnes recovered, steel recovered, CO₂-e avoided, landfill avoided. Every figure with its method."),
    ("/councils/",        None,           "councils.html",     "Yarta for councils — whole-of-council environmental sustainability", "One score for the kerbside service, transfer stations, depots, buildings, fleet, water, Country and community programs, with a roadmap to improvement. Switched on in 30 days."),
    ("/climate-reporting/", None,         "climate-reporting.html", "Mandatory climate reporting — is your waste number ready?", "Australia's mandatory climate reporting is live. Scope 3 is reported from each company's second year and reviewed by an auditor. Check your group and your first Scope 3 year, and get your waste number from the processor."),
    ("/sectors/",         "Sectors",      "sectors.html",      "Sectors — what councils, hospitals, universities, manufacturers, builders, retailers and transport operators report on", "The same ten categories, shaped by sector: what each kind of organisation reports on, the eco standards that apply, and a demo and sample report for each."),
    ("/eco-standards/",   None,           "eco-standards.html", "Eco standards — the standards behind every Yarta score", "The published standard behind each Yarta category, with sources: 80% resource recovery by 2030, 43% below 2005 by 2030, 82% renewable electricity, 30 by 30, halving food waste, mandatory climate reporting."),
    ("/business/",        None,           "business.html",     "Yarta for business — environmental sustainability reporting, Scope 3 and a roadmap", "Your data evaluated against the eco standards, with the emissions figures ready for mandatory climate reporting and a roadmap to improvement."),
    ("/method/",          None,           "method.html",       "The Yarta Method — how every number is calculated",    "Reference factors, unit-weight assumptions, evidence grades and versioning. Every Yarta figure can be traced to its source."),
    ("/pricing/",         "Pricing",      "pricing.html",      "Yarta pricing — councils and business",                 "Councils from $1,999 a month. Business from $999 a month, by staff numbers. Annual subscription. Foundation Members pay no establishment fee in the first 12 months."),
    ("/about/",           "About",        "about.html",        "About Yarta — a Recycle Group initiative",                "Why Yarta exists, who runs it, and the recovery infrastructure behind the numbers."),
    ("/contact/",         None,           "contact.html",      "Talk to Yarta",                                          "Book a walkthrough or ask a question. contact@yes.com.au"),
    ("/report/",     None,           "report.html",  "Sample Yarta Report — environmental sustainability, by sector (demo)", "A sample Yarta Environmental Sustainability Report for each sector, print-ready: summary, figures and the roadmap to improvement."),
    ("/recycling-report/", None,      "recycling-report.html", "Sample recycling report — Hepburn Shire Council (demo)", "The recycling report sample, print-ready: summary, figures and roadmap."),
    ("/language/",   None,           "language.html", "Language on this site — proposed names and their status (internal)", "The First Nations words proposed for Yarta products, which language each comes from, the dictionary check and whether the custodians have confirmed it."),
]
NOINDEX = {"/language/"}   # internal pages: built and linkable, not indexed
STANDALONE = [("/report/", "report.html"), ("/demo/", "demo.html")]   # the portal-based pages: their own document, not the site shell
STANDALONE_FRAGS = {f for _, f in STANDALONE}
REDIRECTS = {"/yarta/": "/report/", "/certificate/": "/recycling-report/"}   # old paths that keep working

FORM_NOTE = (f"Submitting opens an email to Yarta at {EMAIL} with your details filled in, ready to send. Nothing is stored on this site. No mailing list."
             if FORM_MODE == "mailto" else
             f"Submitting sends your details to Yarta at {EMAIL}. Nothing else. No mailing list.")

ARROW = '<svg class="arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'

def logo(cls="logo"):
    # The Yarta mark (the roundel), the YARTA wordmark set in type, the full name underneath, the URL underneath that. Never the mark alone.
    return (f'<a class="{cls}" href="/" aria-label="{MARK} — {NAME_FULL} — {URL}">'
            f'<img class="logo-img" src="/assets/yarta/yarta-mark.webp" alt="" width="320" height="315">'
            f'<span class="logo-text"><span class="logo-mark">{MARK}</span>'
            f'<span class="logo-name">{NAME_FULL}</span>'
            f'<span class="logo-url">{URL}</span></span></a>')

def nav(current):
    items = []
    for path, label, *_ in PAGES:
        if not label: continue
        cls = ' class="active"' if path == current else ''
        items.append(f'<li><a href="{path}"{cls}>{label}</a></li>')
    items.append(f'<li class="nav-cta"><a class="btn btn-primary btn-sm" href="/contact/">Talk to Yarta {ARROW}</a></li>')
    bar = (f'<div class="ann" role="note"><div class="wrap"><span class="ann-dot" aria-hidden="true"></span>'
           f'<span class="ann-t"><b>Measure. Understand. Report. Improve.</b> Shaping Country for tomorrow.</span>'
           f'<a href="/about/#story">The YARTA story {ARROW}</a></div></div>')
    return bar + f'''<header class="nav">
  <div class="wrap">
    {logo()}
    <button class="burger" aria-label="Menu" aria-expanded="false" onclick="document.querySelector('.nav-links').classList.toggle('open');this.setAttribute('aria-expanded',document.querySelector('.nav-links').classList.contains('open'))">MENU</button>
    <ul class="nav-links">{''.join(items)}</ul>
  </div>
</header>'''

def footer():
    year = datetime.date.today().year
    return f'''<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div>
        {logo()}
        <p class="foot-tag">{POSITION}. An environmental sustainability report, a live dashboard and a roadmap to improvement — verified data, documented method, real outcomes.</p>
      </div>
      <div><h5>Product</h5><ul>
        <li><a href="/yes-report/">The Yarta Report</a></li>
        <li><a href="/how-it-works/">How it works</a></li>
        <li><a href="/demo/">Live demo</a></li>
        <li><a href="/calculator/">Impact calculator</a></li>
        <li><a href="/climate-reporting/">Climate reporting</a></li>
        <li><a href="/method/">The Yarta Method</a></li>
        <li><a href="/eco-standards/">Eco standards</a></li>
      </ul></div>
      <div><h5>Who it's for</h5><ul>
        <li><a href="/sectors/">Sectors</a></li>
        <li><a href="/councils/">Councils</a></li>
        <li><a href="/business/">Business</a></li>
        <li><a href="/pricing/">Pricing</a></li>
        <li><a href="/pricing/#foundation">Foundation Members</a></li>
      </ul></div>
      <div><h5>Yarta</h5><ul>
        <li><a href="/about/">About</a></li>
        <li><a href="/contact/">Contact</a></li>
        <li><a href="mailto:{EMAIL}">{EMAIL}</a></li>
        <li><a href="https://recycle.net.au" rel="noopener">Recycle Group</a></li>
      </ul></div>
    </div>
    <div class="foot-mark" aria-hidden="true">Yarta</div>
    <div class="foot-bottom">
      <span>© {year} Yarta · A Recycle Group initiative</span>
      <span>{SITE_TITLE}</span>
    </div>
  </div>
</footer>'''

HEAD = '''<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="{domain}{path}">
<meta name="theme-color" content="#0B0B0B">
<link rel="icon" href="/assets/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css?v={v}">
</head>
<body class="page-{slug}">
'''

TAIL = '''
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="/assets/yes-terms.js?v={v}"></script>
<script src="/assets/site.js?v={v}"></script>
{extra}
</body>
</html>
'''

def rebase(text):
    """Prefix root-relative URLs with BASE_PATH so the site works under a GitHub Pages project path."""
    if not BASE_PATH: return text
    for pat in ('href="/', 'src="/', 'action="/', "url(/", 'content="/', 'poster="/'):
        text = text.replace(pat, pat[:-1] + BASE_PATH + "/")
    return text

def build():
    ICONS = open(os.path.join(SRC, "partials", "icons.svg"), encoding="utf-8").read()
    if os.path.exists(DIST): shutil.rmtree(DIST)
    os.makedirs(DIST)
    shutil.copytree(os.path.join(SRC, "assets"), os.path.join(DIST, "assets"))
    for css in ("style.css",):
        p = os.path.join(DIST, "assets", css)
        css_text = open(p, encoding="utf-8").read()
        with open(p, "w", encoding="utf-8") as fh: fh.write(rebase(css_text))
    v = datetime.datetime.now().strftime("%Y%m%d%H%M")
    hero_fix = "" if os.path.exists(os.path.join(SRC, "assets", "img", "hero-springs.jpg")) else "<style>.hero-photo{background-image:none}</style>\n"
    built = []
    for path, label, frag, title, desc in PAGES:
        if frag in STANDALONE_FRAGS: continue   # built below, as a complete document
        fp = os.path.join(SRC, "pages", frag)
        if not os.path.exists(fp):
            print("MISSING", frag); continue
        body = open(fp, encoding="utf-8").read()
        # per-page extra scripts: a fragment may end with <!--scripts--> ... block
        extra = ""
        m = re.search(r"<!--scripts-->(.*)$", body, re.S)
        if m:
            extra = m.group(1); body = body[:m.start()]
        body = (body.replace("{{NAME}}", NAME_FULL)
                    .replace("{{NAME_L1}}", NAME_LINES[0]).replace("{{NAME_L2}}", NAME_LINES[1])
                    .replace("{{URL}}", URL).replace("{{EMAIL}}", EMAIL).replace("{{MARK}}", MARK).replace("{{POSITION}}", POSITION)
                    .replace("{{LOGO_BIG}}", logo("logo big on-paper"))
                    .replace("{{LOGO_BIG_DARK}}", logo("logo big"))
                    .replace("{{ARROW}}", ARROW)
                    .replace("{{FORM_MODE}}", FORM_MODE)
                    .replace("{{FORM_NOTE}}", FORM_NOTE))
        slug = "home" if path == "/" else path.strip("/").replace("/", "-")
        html = (HEAD.format(title=title, desc=desc, domain=DOMAIN, path=path, v=v, slug=slug)
                + hero_fix + ICONS + nav(path) + "\n<main>\n" + body + "\n</main>\n" + footer()
                + TAIL.format(v=v, extra=extra))
        if path in NOINDEX:
            html = html.replace('<meta name="theme-color"', '<meta name="robots" content="noindex">\n<meta name="theme-color"', 1)
        out_dir = os.path.join(DIST, path.strip("/"))
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(rebase(html))
        built.append(path)
    # standalone pages: complete documents with their own head and styles, written as-is (paths rebased)
    for path, frag in STANDALONE:
        fp = os.path.join(SRC, "pages", frag)
        if not os.path.exists(fp):
            print("MISSING", frag); continue
        out_dir = os.path.join(DIST, path.strip("/")); os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(rebase(open(fp, encoding="utf-8").read()))
        built.append(path)
    # old paths keep working
    for old_path, new_path in REDIRECTS.items():
        old = os.path.join(DIST, old_path.strip("/")); os.makedirs(old, exist_ok=True)
        to = (BASE_PATH or "") + new_path
        with open(os.path.join(old, "index.html"), "w", encoding="utf-8") as f:
            f.write(f'<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><title>Moved</title><meta name="robots" content="noindex"><link rel="canonical" href="{DOMAIN}{new_path}"><meta http-equiv="refresh" content="0; url={to}"></head><body><p>This page has moved: <a href="{to}">{DOMAIN}{new_path}</a>.</p></body></html>\n')
    open(os.path.join(DIST, "robots.txt"), "w").write("User-agent: *\nAllow: /\n")
    open(os.path.join(DIST, ".nojekyll"), "w").write("")
    print("built", len(built), "pages:", ", ".join(built), "| form:", FORM_MODE, "| base:", BASE_PATH or "/")

if __name__ == "__main__":
    build()
