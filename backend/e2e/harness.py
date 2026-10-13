"""Helpers for driving the live Yarta tool and portal against the Firebase emulators.

The site is served locally (python -m http.server 8000 from docs/), the emulators run on the
ports in backend/firebase.json, and live-config.js is swapped for an emulator config per page.
"""
import json, time, urllib.request, urllib.parse

SITE = "http://127.0.0.1:8000"
PROJECT = "demo-yarta"
FS = f"http://127.0.0.1:8080/v1/projects/{PROJECT}/databases/(default)/documents"
AUTH = f"http://127.0.0.1:9099/emulator/v1/projects/{PROJECT}"
CONFIG_JS = """window.YARTA_FIREBASE = {apiKey:'demo-key', authDomain:'demo-yarta.firebaseapp.com', projectId:'demo-yarta',
 storageBucket:'demo-yarta.appspot.com', appId:'1:1:web:1',
 emulators:{auth:'http://127.0.0.1:9099', firestore:'127.0.0.1:8080', storage:'127.0.0.1:9199'}};"""


def _req(method, url, body=None, admin=True):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if admin:
        r.add_header("Authorization", "Bearer owner")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(r, timeout=20) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else None


def _val(v):
    if v is None: return {"nullValue": None}
    if isinstance(v, bool): return {"booleanValue": v}
    if isinstance(v, int): return {"integerValue": str(v)}
    if isinstance(v, float): return {"doubleValue": v}
    if isinstance(v, str):
        if v.startswith("ts:"): return {"timestampValue": v[3:]}
        return {"stringValue": v}
    if isinstance(v, list): return {"arrayValue": {"values": [_val(x) for x in v]}}
    if isinstance(v, dict): return {"mapValue": {"fields": {k: _val(x) for k, x in v.items()}}}
    raise TypeError(v)


def _plain(v):
    k, x = next(iter(v.items()))
    if k == "mapValue": return {a: _plain(b) for a, b in (x.get("fields") or {}).items()}
    if k == "arrayValue": return [_plain(b) for b in (x.get("values") or [])]
    if k == "integerValue": return int(x)
    if k == "nullValue": return None
    return x


def fs_put(path, data):
    """Write a document as an admin (bypasses the rules): used only to seed the first owner's invite."""
    _req("PATCH", f"{FS}/{path}", {"fields": {k: _val(v) for k, v in data.items()}})


def fs_get(path):
    try:
        d = _req("GET", f"{FS}/{path}")
        return {k: _plain(v) for k, v in (d.get("fields") or {}).items()}
    except urllib.error.HTTPError as e:
        if e.code == 404: return None
        raise


def fs_list(path):
    d = _req("GET", f"{FS}/{path}?pageSize=300") or {}
    return [(x["name"].split("/")[-1], {k: _plain(v) for k, v in (x.get("fields") or {}).items()}) for x in d.get("documents", [])]


def reset():
    _req("DELETE", f"http://127.0.0.1:8080/emulator/v1/projects/{PROJECT}/databases/(default)/documents")
    _req("DELETE", f"{AUTH}/accounts")


def sign_in_link(email, after=0):
    """The latest email sign-in link the auth emulator 'sent' to this address."""
    for _ in range(40):
        codes = (_req("GET", f"{AUTH}/oobCodes", admin=False) or {}).get("oobCodes", [])
        mine = [c for c in codes if c.get("email") == email and c.get("requestType") == "EMAIL_SIGNIN"]
        if len(mine) > after:
            c = mine[-1]
            q = urllib.parse.parse_qs(urllib.parse.urlparse(c["oobLink"]).query)
            cont = q.get("continueUrl", [SITE])[0]
            return cont + ("&" if "?" in cont else "?") + urllib.parse.urlencode({"mode": "signIn", "oobCode": c["oobCode"], "apiKey": "demo-key", "lang": "en"})
        time.sleep(0.25)
    raise RuntimeError("no sign-in email for " + email)


def link_count(email):
    codes = (_req("GET", f"{AUTH}/oobCodes", admin=False) or {}).get("oobCodes", [])
    return len([c for c in codes if c.get("email") == email and c.get("requestType") == "EMAIL_SIGNIN"])


def live_page(browser, errors):
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.route("**/assets/yarta/live-config.js", lambda route: route.fulfill(status=200, content_type="application/javascript", body=CONFIG_JS))
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    return ctx, page


def sign_in(page, path, email):
    """Request a link on the page, then open the link the emulator 'emailed'."""
    before = link_count(email)
    page.goto(SITE + path)
    page.wait_for_selector("#ylive-email", timeout=20000)
    page.fill("#ylive-email", email)
    page.click("#ylive-form button[type=submit]")
    page.wait_for_selector("text=We sent you a sign-in link", timeout=20000)
    page.goto(sign_in_link(email, before))
