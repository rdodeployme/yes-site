"""With no backend configured (live-config.js = null) the prototype must behave exactly as before."""
import sys, time
from playwright.sync_api import sync_playwright
SITE = "http://127.0.0.1:8000"
results = []
def check(name, ok, detail=""):
    results.append(bool(ok)); print(("PASS " if ok else "FAIL ") + name + (" · " + detail if detail else ""), flush=True)

errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}); pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    pg.goto(SITE + "/demo/"); pg.wait_for_selector(".snav", timeout=15000); time.sleep(0.8)
    check("Public demo opens on demo data", "Demo" in pg.inner_text("#main") or "demo" in pg.inner_text("body").lower())
    check("Live layer stays off without a config", pg.evaluate("!window.YARTA_LIVE || !window.YARTA_LIVE.enabled"))

    pg.goto(SITE + "/tool/"); pg.wait_for_selector(".snav", timeout=15000); time.sleep(0.8)
    check("Team tool opens as the demo operator", "/ops/home" in pg.url and "Morgan" in pg.inner_text("#who"))
    nav = pg.inner_text(".snav")
    check("No live-only screens in prototype mode", "Team and access" not in nav and "Leads" not in nav)

    pg.goto(SITE + "/portal/"); pg.wait_for_selector(".login", timeout=15000); time.sleep(0.5)
    check("Client portal shows the demo accounts", "Choose a demo account" in pg.inner_text("#app"))
    pg.click("[data-act=login] >> nth=0"); pg.wait_for_selector(".snav", timeout=15000); time.sleep(0.6)
    check("Demo customer signs in and sees a dashboard", "/dashboard" in pg.url)

    pg.goto(SITE + "/report/"); time.sleep(1.5)
    check("Sample report renders", pg.query_selector(".report, .rp-h, .sheet") is not None)
    b.close()

check("No script errors", not errors, " | ".join(errors[:3]))
print(f"\n{sum(results)}/{len(results)} passed")
