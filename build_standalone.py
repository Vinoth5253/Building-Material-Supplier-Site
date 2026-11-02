"""Build a single self-contained HTML file (website + demo admin) to hand to clients.

    python build_standalone.py            -> dist/KVSCO_Showroom.html

Uses the current data (data/items.json, data/settings.json, uploads/) so re-run it after
updating the catalogue. Open the file directly; add ?admin to the URL (or use the footer
'Admin' link) for the demo admin. Demo changes stay in the viewer's browser only.
"""
import base64
import json
import mimetypes
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent
STATIC = BASE / "static"
DIST = BASE / "dist"
OUT = DIST / "KVSCO_Showroom.html"


def js_safe(text):
    """JSON/JS text that can sit inside a <script> element."""
    return text.replace("</", "<\\/").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def load_data():
    db = json.loads((BASE / "data" / "items.json").read_text(encoding="utf-8"))
    settings = json.loads((BASE / "data" / "settings.json").read_text(encoding="utf-8"))
    images, items = {}, []
    for it in db["items"]:
        it = dict(it)
        img = it.get("image") or ""
        if img.startswith("/uploads/"):
            f = BASE / "uploads" / Path(img).name
            if f.is_file():
                key = f.stem
                mime = mimetypes.guess_type(f.name)[0] or "image/jpeg"
                images[key] = f"data:{mime};base64," + base64.b64encode(f.read_bytes()).decode()
                it["image"] = f"seedimg:{key}"
            else:
                it["image"] = ""
        items.append(it)
    return {"items": items, "settings": settings, "images": images}


def inline_page(name, shim):
    html = (STATIC / name).read_text(encoding="utf-8")

    def css(m):
        return "<style>\n" + (STATIC / "css" / m.group(1)).read_text(encoding="utf-8") + "\n</style>"

    def js(m):
        return "<script>\n" + (STATIC / "js" / m.group(1)).read_text(encoding="utf-8") + "\n</script>"

    html = re.sub(r'<link rel="stylesheet" href="/static/css/([\w.-]+)">', css, html)
    first = html.index('<script src="/static/js/')
    html = html[:first] + "<script>window.KVS_SEED = /*SEED*/;</script>\n<script>\n" + shim + "\n</script>\n" + html[first:]
    html = re.sub(r'<script src="/static/js/([\w.-]+)"></script>', js, html)
    # page links: /admin -> ?admin, / -> ? (same file)
    html = html.replace('href="/admin"', 'href="?admin"').replace('href="/"', 'href="?"')
    html = html.replace('<meta name="robots" content="noindex">', "")
    assert "/static/" not in html, f"unresolved static reference in {name}"
    return html


def build():
    shim = (STATIC / "js" / "standalone-shim.js").read_text(encoding="utf-8")
    pages = {"site": inline_page("index.html", shim), "admin": inline_page("admin.html", shim)}
    seed_js = js_safe(json.dumps(load_data(), ensure_ascii=False))
    out = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KVS&amp;CO Building Materials</title>
</head>
<body>
<noscript>Please enable JavaScript to view the KVS&amp;CO showroom.</noscript>
<script>
(function () {{
  var pages = {js_safe(json.dumps(pages, ensure_ascii=False))};
  var seed = {js_safe(json.dumps(seed_js, ensure_ascii=False))};
  var page = /(^|[?&])admin\\b/.test(location.search.slice(1)) ? pages.admin : pages.site;
  document.open();
  document.write(page.replace("/*SEED*/", function () {{ return seed; }}));
  document.close();
}})();
</script>
</body>
</html>
"""
    DIST.mkdir(exist_ok=True)
    OUT.write_text(out, encoding="utf-8")
    print(f"Wrote {OUT}  ({OUT.stat().st_size / 1024:.0f} KB, {len(json.loads(seed_js)['items'])} items)")


if __name__ == "__main__":
    build()
