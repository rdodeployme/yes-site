"""Quick smoke: first owner signs in to the live tool and lands on Today."""
import sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from harness import *

reset()
fs_put("invites/owner@yarta.test", {"email": "owner@yarta.test", "name": "Olivia Owner", "title": "Director", "role": "owner", "orgId": None,
                                     "invitedByUid": "console", "invitedBy": "Console", "invitedAt": "ts:2026-10-13T00:00:00Z", "expiresAt": "ts:2026-12-31T00:00:00Z"})
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx, page = live_page(b, errors)
    sign_in(page, "/tool/", "owner@yarta.test")
    page.wait_for_selector(".snav", timeout=20000)
    time.sleep(1)
    print("URL:", page.url)
    print("NAV:", page.inner_text(".snav").replace("\n", " | ")[:400])
    print("MAIN:", page.inner_text("#main")[:300].replace("\n", " | "))
    print("USER DOC:", fs_get("users/" + page.evaluate("window.YARTA_LIVE.uid")))
    page.screenshot(path="/tmp/claude-0/-home-claude/6340fc20-3541-58c6-8733-4b0deb3e1412/scratchpad/smoke-tool.png")
    b.close()
print("ERRORS:", errors[:10])
