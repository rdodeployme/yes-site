"""Readiness Check end to end: a council fills it in → result on screen → lead saved (rules-checked)
→ the Yarta team sees it under Leads → Convert opens New customer with the answers filled in.
Also: with no backend configured, the result still shows and offers an email instead."""
import sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from harness import *

SHOTS = "/tmp/claude-0/-home-claude/6340fc20-3541-58c6-8733-4b0deb3e1412/scratchpad/"
results = []
def check(name, ok, detail=""):
    results.append(bool(ok)); print(("PASS " if ok else "FAIL ") + name + (" · " + detail if detail else ""), flush=True)

def pick(pg, name, value):
    pg.click(f'label:has(> input[name="{name}"][value="{value}"])')

def fill(pg, email="jo@coastal.test"):
    pg.fill("input[name=org_name]", "Coastal Shire Council")
    pg.select_option("select[name=sector]", "council"); pg.select_option("select[name=state]", "VIC")
    for n, v in (("employees", "101-500"), ("residents", "10-50k"), ("sites", "6-20"), ("timeline", "6m"), ("approach", "spreadsheet"), ("holder", "finance"), ("baseline", "yes")):
        pick(pg, n, v)
    pick(pg, "drivers", "target"); pick(pg, "drivers", "improve")
    answers = {"electricity": "monthly", "gas": "na", "water": "monthly", "waste": "patchy", "kerbside": "monthly", "fuel": "no", "vehicles": "unsure", "solar": "monthly", "travel": "na", "procurement": "no"}
    for k, v in answers.items():
        pick(pg, "rec-" + k, v)
    pg.fill("input[name=contact_name]", "Jo Smith"); pg.fill("input[name=contact_role]", "Sustainability lead")
    pg.fill("input[name=email]", email); pg.fill("textarea[name=notes]", "Council meeting in November.")
    pg.click("label.consent")
    return answers

errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    # live (emulator) mode
    ctx, pg = live_page(b, errors)
    pg.goto(SITE + "/readiness/"); pg.wait_for_selector("#rc-form")
    pg.click("#rc-go"); time.sleep(0.4)
    check("Submitting empty shows what is missing", "organisation" in pg.inner_text("#rc-err").lower())
    answers = fill(pg)
    side = pg.inner_text("#rc-score")
    # expected: core w2: electricity 1, water 1, waste .5, kerbside 1, fuel 0, vehicles .25 ; w1: solar 1, procurement 0 ; gas/travel n/a
    exp = round((2 * (1 + 1 + .5 + 1 + 0 + .25) + 1 * (1 + 0)) / (2 * 6 + 2) * 100)
    check("Live score matches the published method", side.startswith(str(exp)), f"{side} vs {exp}")
    pg.click("#rc-go")
    pg.wait_for_selector("#rc-result:not([hidden]) .rc-saved", timeout=15000); time.sleep(0.6)
    res = pg.inner_text("#rc-result")
    check("Result shows the score and band", f"{exp}%" in res and "Nearly ready" in res, res[:80].replace("\n", " "))
    check("Result lists what to sort first, core records first", res.find("Fuel purchases") < res.find("Purchasing data") and "Sort these first" in res)
    check("Result shows the council price from the pricing page", "$1,999" in res)
    check("Result says it was saved", "Saved. Yarta has your answers." in res)
    pg.screenshot(path=SHOTS + "rc-result-1280.png", full_page=False)
    leads = fs_list("leads")
    check("Lead stored once, with the answers and a server timestamp", len(leads) == 1 and leads[0][1].get("records") == answers and leads[0][1].get("score") == exp and leads[0][1].get("created"), str(len(leads)))
    lead_id = leads[0][0] if leads else None
    ctx.close()

    # phone width result
    ctx, pg = live_page(b, errors)
    pg.set_viewport_size({"width": 390, "height": 844})
    pg.goto(SITE + "/readiness/"); pg.wait_for_selector("#rc-form")
    fill(pg, "sam@coastal.test"); pg.click("#rc-go")
    pg.wait_for_selector("#rc-result:not([hidden]) .rc-saved", timeout=15000); time.sleep(0.8)
    pg.screenshot(path=SHOTS + "rc-result-390.png", full_page=False)
    check("Works at phone width", pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
    ctx.close()

    # Yarta team sees the lead and converts it
    fs_put("invites/owner@yarta.test", {"email": "owner@yarta.test", "name": "Olivia Owner", "title": "Director", "role": "owner", "orgId": None,
                                         "invitedByUid": "console", "invitedBy": "Console", "invitedAt": "ts:2026-10-13T00:00:00Z", "expiresAt": "ts:2026-12-31T00:00:00Z"})
    ctx, owner = live_page(b, errors)
    sign_in(owner, "/tool/", "owner@yarta.test"); owner.wait_for_selector(".snav", timeout=20000)
    owner.evaluate("location.hash='#/ops/leads'"); owner.wait_for_selector(".content"); time.sleep(0.6)
    check("Leads page lists the Readiness Checks", "Coastal Shire Council" in owner.inner_text("#main") and "Leads" in owner.inner_text(".snav"))
    owner.evaluate(f"location.hash='#/ops/leads/{lead_id}'"); time.sleep(0.6)
    det = owner.inner_text("#main")
    check("Lead detail shows contact, result and records", "Jo Smith" in det and f"{exp}%" in det and "kerbside collection data" in det.lower() and "3 to 6 months" in det)
    owner.screenshot(path=SHOTS + "tool-lead.png")
    owner.click("text=Convert to customer"); owner.wait_for_selector("#nc-name"); time.sleep(0.8)
    check("Convert fills New customer from the answers", owner.input_value("#nc-name") == "Coastal Shire Council" and owner.input_value("#nc-cemail") == "jo@coastal.test" and owner.input_value("#nc-sector") == "council")
    owner.fill("#nc-emp", "240"); owner.click("[data-act=nc-create]"); time.sleep(3.5)
    st = fs_get(f"leads/{lead_id}")
    check("Lead marked as a customer once converted", st.get("status") == "converted", str(st.get("status")))
    check("The contact is invited to the new customer", (fs_get("invites/jo@coastal.test") or {}).get("role") == "client")
    ctx.close()

    # prototype mode: no backend, the result still shows and offers an email
    pctx = b.new_context(viewport={"width": 1280, "height": 900}); pp = pctx.new_page()
    pp.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    pp.goto(SITE + "/readiness/"); pp.wait_for_selector("#rc-form")
    fill(pp, "pat@coastal.test"); pp.click("#rc-go")
    pp.wait_for_selector("#rc-result:not([hidden]) .rc-saved", timeout=10000)
    t = pp.inner_text("#rc-result .rc-saved"); href = pp.get_attribute("#rc-result .rc-saved a", "href") or ""
    check("Without a backend the result shows and offers an email to Yarta", "Nothing has been sent yet" in t and href.startswith("mailto:contact@yes.com.au"))
    check("No lead written without a backend", not any(d.get("email") == "pat@coastal.test" for _, d in fs_list("leads")))
    pctx.close()
    b.close()

bad = [e for e in errors if "favicon" not in e]
check("No script errors", not bad, " | ".join(bad[:3]))
print(f"\n{sum(results)}/{len(results)} passed")
