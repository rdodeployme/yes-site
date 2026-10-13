"""End to end, against the emulators: the whole month as Yarta will run it.

owner signs in → invites a second analyst → creates a customer (which invites the contact)
→ customer signs in to the portal, sees nothing yet, sends a document
→ owner enters the month and submits → owner is refused verification (four eyes)
→ second analyst verifies → owner issues the report → customer now sees the month
→ a second customer is created; the first customer still sees only their own organisation.
"""
import sys, time, re
from playwright.sync_api import sync_playwright
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from harness import *

SHOTS = "/tmp/claude-0/-home-claude/6340fc20-3541-58c6-8733-4b0deb3e1412/scratchpad/"
results = []
def check(name, ok, detail=""):
    results.append((ok, name, detail)); print(("PASS " if ok else "FAIL ") + name + (" · " + detail if detail else ""), flush=True)

def go(page, h, sel=".content", wait=0.6):
    page.evaluate(f"location.hash={h!r}"); page.wait_for_selector(sel, timeout=20000); time.sleep(wait)

def settle(page, t=1.6):
    time.sleep(t)  # the live layer debounces writes by 0.7 s
    page.wait_for_function("!window.YARTA_LIVE.busy()", timeout=20000)

reset()
fs_put("invites/owner@yarta.test", {"email": "owner@yarta.test", "name": "Olivia Owner", "title": "Director", "role": "owner", "orgId": None,
                                     "invitedByUid": "console", "invitedBy": "Console", "invitedAt": "ts:2026-10-13T00:00:00Z", "expiresAt": "ts:2026-12-31T00:00:00Z"})
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()

    # 1. owner signs in
    octx, owner = live_page(b, errors)
    sign_in(owner, "/tool/", "owner@yarta.test")
    owner.wait_for_selector(".snav", timeout=20000)
    check("Owner signs in with an emailed link and lands on Today", "/ops/home" in owner.url)

    # 2. owner invites a second analyst
    go(owner, "#/ops/team", "#tm-name")
    owner.fill("#tm-name", "Chris Walker"); owner.fill("#tm-email", "chris@yarta.test"); owner.fill("#tm-title", "Analyst")
    owner.select_option("#tm-kind", "staff")
    owner.click("[data-live=team-invite]"); time.sleep(1.5)
    check("Owner invites a second analyst (invite stored)", fs_get("invites/chris@yarta.test") is not None)
    cctx, chris = live_page(b, errors)
    sign_in(chris, "/tool/", "chris@yarta.test")
    chris.wait_for_selector(".snav", timeout=20000)
    check("Second analyst accepts and signs in", "/ops/home" in chris.url)

    # 3. owner creates a customer, which invites its contact
    owner.reload(); owner.wait_for_selector(".snav", timeout=20000)
    go(owner, "#/ops/customers/new", "#nc-name")
    owner.fill("#nc-name", "Shire A"); owner.fill("#nc-emp", "120"); owner.fill("#nc-res", "18000")
    owner.fill("#nc-cname", "Ava Nguyen"); owner.fill("#nc-ctitle", "Sustainability lead"); owner.fill("#nc-cemail", "ava@shire-a.test")
    owner.fill("#nc-first", "2026-09")
    owner.click("[data-act=nc-create]"); settle(owner, 2.5)
    orgs = fs_list("orgs")
    orgA = [i for i, d in orgs if d.get("profile", {}).get("org_name") == "Shire A"]
    check("Customer created in the database", len(orgA) == 1, str([i for i, _ in orgs]))
    orgA = orgA[0]
    inv = fs_get("invites/ava@shire-a.test")
    check("Customer contact invited to their organisation only", inv is not None and inv.get("orgId") == orgA and inv.get("role") == "client")
    check("First month opened", fs_get(f"orgs/{orgA}/months/2026-09") is not None)

    # 4. customer signs in: nothing published yet
    actx, ava = live_page(b, errors)
    sign_in(ava, "/portal/", "ava@shire-a.test")
    ava.wait_for_selector(".snav", timeout=20000); time.sleep(0.8)
    check("Customer signs in to the portal", "/dashboard" in ava.url)
    check("Customer sees no figures before a report is issued", "first verified month will appear here" in ava.inner_text("#main"))
    ava.screenshot(path=SHOTS + "e2e-portal-empty.png")

    # 5. customer sends a document
    go(ava, "#/documents", "#up-m")
    ava.select_option("#up-m", "2026-09"); ava.select_option("#up-c", "energy")
    ava.set_input_files("input[data-act=inbox-file]", files=[{"name": "power-sept.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4 test bill"}])
    time.sleep(2.5)
    inbox = fs_list(f"orgs/{orgA}/inbox")
    check("Customer document stored and logged", len(inbox) == 1 and inbox[0][1].get("name") == "power-sept.pdf", str(len(inbox)))

    # 6. owner enters the month and submits it
    owner.reload(); owner.wait_for_selector(".snav", timeout=20000)
    go(owner, f"#/entry/{orgA}/2026-09", "[data-field]", 1.0)
    check("The customer's document shows in data entry", "power-sept.pdf" in owner.inner_text("#main"))
    cats = owner.evaluate("window.YESD.CATEGORIES.map(c=>c.k).filter(k=>k!=='carbon')")
    n = 0
    for c in cats:
        go(owner, f"#/entry/{orgA}/2026-09?c={c}", ".content", 0.4)
        n += owner.evaluate("""() => { let n=0; document.querySelectorAll('[data-field]:not([disabled])').forEach((el,i) => {
            if (el.tagName==='SELECT') { if (el.options.length>1) { el.value = el.options[1].value; el.dispatchEvent(new Event('input',{bubbles:true})); n++; } }
            else if (el.type==='number') { el.value = String(10 + (i % 7) * 3); el.dispatchEvent(new Event('input',{bubbles:true})); n++; }
            else { el.value = '2 x hybrid sedans'; el.dispatchEvent(new Event('input',{bubbles:true})); n++; } }); return n; }""")
    settle(owner, 2.0)
    owner.click("[data-act=submit-ask]"); time.sleep(0.5)
    owner.check("#attest"); owner.click("[data-act=submit-month]"); settle(owner, 2.5)
    m = fs_get(f"orgs/{orgA}/months/2026-09")
    owner_uid = owner.evaluate("window.YARTA_LIVE.uid"); chris_uid = chris.evaluate("window.YARTA_LIVE.uid")
    check("Month entered and submitted, recorded against the person who entered it", m and m.get("status") == "submitted" and m.get("enteredByUid") == owner_uid, f"{n} fields filled; status {m and m.get('status')}")

    # 7. four eyes: the person who entered it cannot verify it
    go(owner, f"#/ops/review/{orgA}/2026-09", "[data-act=verify]")
    owner.click("[data-act=verify]", force=True); time.sleep(1.5)
    m = fs_get(f"orgs/{orgA}/months/2026-09")
    check("The analyst who entered the month cannot verify it (screen refuses)", m.get("status") == "submitted")
    # now as a tampered browser: skip the screen and push "verified" straight at the database
    mark = len(errors)
    owner.evaluate(f"""() => {{ const st = window.YESPortal.state; const r = st.orgs['{orgA}'].records.find(x => x.month === '2026-09');
        r.status = 'verified'; r.verifiedAt = '2026-10-13'; r.verifiedBy = 'Olivia Owner'; window.YARTA_LIVE.sync(st); }}""")
    time.sleep(1.0); owner.wait_for_function("!window.YARTA_LIVE.busy()", timeout=20000); time.sleep(0.5)
    m = fs_get(f"orgs/{orgA}/months/2026-09")
    check("The analyst who entered the month cannot verify it (database refuses a tampered browser)", m.get("status") == "submitted", "status " + str(m.get("status")))
    refused = errors[mark:]; del errors[mark:]
    check("The refusal is the database saying no (HTTP 403), as expected", refused and all("403" in e for e in refused), str(len(refused)))

    chris.reload(); chris.wait_for_selector(".snav", timeout=20000)
    go(chris, f"#/ops/review/{orgA}/2026-09", "[data-act=verify]")
    chris.click("[data-act=verify]"); settle(chris, 2.5)
    m = fs_get(f"orgs/{orgA}/months/2026-09")
    check("A second analyst verifies it", m.get("status") == "verified" and m.get("verifiedByUid") == chris_uid)
    check("Still nothing visible to the customer before the report is issued", fs_get(f"views/{orgA}/months/2026-09") is None)

    # 8. issue the report
    owner.reload(); owner.wait_for_selector(".snav", timeout=20000)
    go(owner, "#/ops/reports", "[data-act=issue-report]")
    owner.click("[data-act=issue-report]"); settle(owner, 3.0)
    pub = fs_get(f"views/{orgA}/months/2026-09")
    reps = fs_list(f"views/{orgA}/reports")
    work = fs_get(f"orgs/{orgA}/months/2026-09")
    check("Issuing publishes the month, figure for figure", pub is not None and pub.get("values") == work.get("values"))
    check("Issuing writes a permanent report record", len(reps) == 1 and reps[0][0] == "2026-09-r1", str([r[0] for r in reps]))

    # 9. the customer now sees it
    ava.reload(); ava.wait_for_selector(".snav", timeout=20000); go(ava, "#/dashboard", ".content", 1.2)
    txt = ava.inner_text("#main")
    check("Customer sees the issued month on their dashboard", "first verified month" not in txt and "September 2026" in txt, txt[:120].replace("\n", " "))
    ava.screenshot(path=SHOTS + "e2e-portal-dashboard.png", full_page=False)
    go(ava, "#/reports", ".content", 1.0)
    check("Customer sees the issued report", "September 2026" in ava.inner_text("#main"))

    # 10. a second customer: the first still sees only their own organisation
    go(owner, "#/ops/customers/new", "#nc-name")
    owner.fill("#nc-name", "Company B"); owner.fill("#nc-emp", "40")
    owner.fill("#nc-cname", "Ben Ito"); owner.fill("#nc-cemail", "ben@company-b.test"); owner.fill("#nc-first", "2026-09")
    owner.click("[data-act=nc-create]"); settle(owner, 2.5)
    ava.reload(); ava.wait_for_selector(".snav", timeout=20000); time.sleep(0.8)
    keys = ava.evaluate("Object.keys(window.YESPortal.state.orgs)")
    check("Customer A's browser holds only Customer A", keys == [orgA], str(keys))
    check("Customer A's browser holds no analyst notes, drafts or other people", ava.evaluate("JSON.stringify(window.YESPortal.state).indexOf('Company B')") == -1)

    # 11. customer asks for help from the roadmap; Yarta sees it
    go(ava, "#/improvements", ".content", 1.0)
    links = ava.evaluate("Array.from(document.querySelectorAll('a[href^=\"#/improvements/\"]')).map(a=>a.getAttribute('href'))")
    if links:
        go(ava, links[0], "[data-act=book-submit]", 0.8)
        ava.click("[data-slot=other]") if ava.query_selector("[data-slot=other]") else None
        ava.fill("#bk-notes", "Any Tuesday morning") if ava.query_selector("#bk-notes") else None
        ava.click("[data-act=book-submit]"); time.sleep(2.5)
        bks = fs_list(f"orgs/{orgA}/bookings")
        check("Customer requests help; Yarta receives the request", len(bks) == 1 and bks[0][1].get("status") == "requested", str(len(bks)))
    else:
        check("Customer requests help; Yarta receives the request", False, "no suggestions on the improvements page")

    # 12. the activity log has both sides
    acts = [d.get("action") for _, d in fs_list("audit")]
    check("Activity log records staff and customer actions", "Documents received" in acts and "Month verified" in acts and "Report issued" in acts, ", ".join(sorted(set(acts)))[:200])
    b.close()

bad = [e for e in errors if "favicon" not in e]
check("No script errors in any browser", not bad, " | ".join(bad[:4]))
print(f"\n{sum(1 for r in results if r[0])}/{len(results)} passed")
