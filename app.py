"""KVS&CO showroom catalogue — Flask backend.

Public:  GET /            catalogue site
         GET /api/catalog items + settings + version
         GET /api/version cheap poll so open pages refresh when admin changes data
Admin:   /admin           login + dashboard (session cookie)
         /api/admin/*     CRUD, Excel import/export, image upload, settings
"""
import io
import json
import os
import re
import secrets
import threading
import time
import uuid
from functools import wraps
from pathlib import Path

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation
from flask import Flask, abort, jsonify, request, send_file, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash

BASE = Path(__file__).resolve().parent
DATA = BASE / "data"
UPLOADS = BASE / "uploads"
STATIC = BASE / "static"
ITEMS_FILE = DATA / "items.json"
SETTINGS_FILE = DATA / "settings.json"
AUTH_FILE = DATA / "auth.json"
SECRET_FILE = DATA / "secret.key"

DEFAULT_USER = "admin"
DEFAULT_PASSWORD = "kvs@2026"
LOW_STOCK_THRESHOLD = 10
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
AVAILABILITY = ("in_stock", "low_stock", "out_of_stock", "on_order")

DATA.mkdir(exist_ok=True)
UPLOADS.mkdir(exist_ok=True)

_lock = threading.Lock()
_failed = {}  # ip -> [timestamps] for login throttling


# ---------------------------------------------------------------- storage

def _read(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def _write(path, obj):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def _secret():
    if not SECRET_FILE.exists():
        SECRET_FILE.write_text(secrets.token_hex(32))
    return SECRET_FILE.read_text().strip()


def _bootstrap():
    if not ITEMS_FILE.exists():
        from seed import SEED_ITEMS, SEED_SETTINGS
        items = [normalise(dict(it)) for it in SEED_ITEMS]
        _write(ITEMS_FILE, {"version": int(time.time() * 1000), "items": items})
        if not SETTINGS_FILE.exists():
            _write(SETTINGS_FILE, SEED_SETTINGS)
    if not AUTH_FILE.exists():
        _write(AUTH_FILE, {"username": DEFAULT_USER,
                           "hash": generate_password_hash(DEFAULT_PASSWORD),
                           "default": True})


def load_items():
    return _read(ITEMS_FILE, {"version": 0, "items": []})


def save_items(items):
    db = {"version": int(time.time() * 1000), "items": items}
    _write(ITEMS_FILE, db)
    return db


def load_settings():
    return _read(SETTINGS_FILE, {})


# ---------------------------------------------------------------- normalising

def _yes(v):
    return str(v).strip().lower() in {"yes", "y", "true", "1", "✓", "x", "ஆம்"}


def _num(v, cast=float):
    if v is None or str(v).strip() == "":
        return None
    try:
        return cast(float(str(v).replace(",", "").replace("₹", "").strip()))
    except ValueError:
        return None


def parse_availability(v, stock):
    s = str(v or "").strip().lower().replace("-", " ").replace("_", " ")
    if s:
        if s in {"in stock", "available", "yes", "instock", "in"}:
            return "in_stock"
        if s.startswith("low") or s in {"limited", "few left"}:
            return "low_stock"
        if s.startswith("out") or s in {"no", "unavailable", "sold out", "nil"}:
            return "out_of_stock"
        if "order" in s or s in {"pre order", "coming soon", "awaited"}:
            return "on_order"
    if stock is None:
        return "in_stock"
    if stock <= 0:
        return "out_of_stock"
    return "low_stock" if stock <= LOW_STOCK_THRESHOLD else "in_stock"


def normalise(it):
    """Coerce any item dict (from JSON, form or Excel) into the stored schema."""
    stock = _num(it.get("stock"), int)
    out = {
        "id": it.get("id") or uuid.uuid4().hex[:12],
        "sku": str(it.get("sku") or "").strip(),
        "name_en": str(it.get("name_en") or "").strip(),
        "name_ta": str(it.get("name_ta") or "").strip(),
        "category": str(it.get("category") or "Other").strip(),
        "brand": str(it.get("brand") or "").strip(),
        "desc_en": str(it.get("desc_en") or "").strip(),
        "desc_ta": str(it.get("desc_ta") or "").strip(),
        "unit": str(it.get("unit") or "").strip(),
        "price": _num(it.get("price")),
        "stock": stock,
        "image": str(it.get("image") or "").strip(),
        "highlight": it.get("highlight") if isinstance(it.get("highlight"), bool) else _yes(it.get("highlight")),
        "innovation": it.get("innovation") if isinstance(it.get("innovation"), bool) else _yes(it.get("innovation")),
        "specs": str(it.get("specs") or "").strip(),
        "updated": int(time.time()),
    }
    av = it.get("availability")
    out["availability"] = av if av in AVAILABILITY else parse_availability(av, stock)
    if not out["sku"]:
        out["sku"] = "KVS-" + out["id"][:6].upper()
    return out


# ---------------------------------------------------------------- Excel

# (key, header, width, aliases accepted on import)
COLUMNS = [
    ("sku", "SKU", 16, ["code", "item code", "part no", "id"]),
    ("name_en", "Name (English)", 34, ["name", "item", "item name", "product", "product name"]),
    ("name_ta", "Name (Tamil)", 34, ["tamil name", "பெயர்"]),
    ("category", "Category", 20, ["group", "type"]),
    ("brand", "Brand", 18, ["make", "manufacturer"]),
    ("unit", "Unit", 16, ["uom", "pack", "per"]),
    ("price", "Price (INR)", 13, ["price", "rate", "mrp", "price inr"]),
    ("stock", "Stock Qty", 11, ["stock", "qty", "quantity", "stock quantity"]),
    ("availability", "Availability", 16, ["status", "available"]),
    ("highlight", "Highlight (Yes/No)", 16, ["highlight", "featured"]),
    ("innovation", "New Innovation (Yes/No)", 20, ["innovation", "new innovation", "new"]),
    ("image", "Image (URL or file name)", 30, ["image", "image url", "photo", "picture"]),
    ("desc_en", "Description (English)", 50, ["description", "details"]),
    ("desc_ta", "Description (Tamil)", 50, ["tamil description", "விவரம்"]),
    ("specs", "Specs (Key: Value; ...)", 50, ["specs", "specifications"]),
]
AV_LABEL = {"in_stock": "In Stock", "low_stock": "Low Stock",
            "out_of_stock": "Out of Stock", "on_order": "On Order"}


def _header_key(h):
    h = re.sub(r"\s+", " ", str(h or "").strip().lower())
    for key, header, _, aliases in COLUMNS:
        if h == header.lower() or h == key or h in aliases:
            return key
    return None


def build_workbook(items):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Items"
    head_fill = PatternFill("solid", fgColor="E2702B")
    for c, (_, header, width, _) in enumerate(COLUMNS, 1):
        cell = ws.cell(row=1, column=c, value=header)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = head_fill
        cell.alignment = Alignment(vertical="center")
        ws.column_dimensions[openpyxl.utils.get_column_letter(c)].width = width
    ws.freeze_panes = "B2"
    for r, it in enumerate(items, 2):
        for c, (key, *_rest) in enumerate(COLUMNS, 1):
            v = it.get(key)
            if key == "availability":
                v = AV_LABEL.get(v, v)
            elif key in ("highlight", "innovation"):
                v = "Yes" if v else "No"
            ws.cell(row=r, column=c, value=v)
    last = max(len(items) + 1, 500)
    col = {k: openpyxl.utils.get_column_letter(i) for i, (k, *_r) in enumerate(COLUMNS, 1)}
    dv_av = DataValidation(type="list", formula1='"In Stock,Low Stock,Out of Stock,On Order"', allow_blank=True)
    dv_yn = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
    ws.add_data_validation(dv_av)
    ws.add_data_validation(dv_yn)
    dv_av.add(f"{col['availability']}2:{col['availability']}{last}")
    dv_yn.add(f"{col['highlight']}2:{col['highlight']}{last}")
    dv_yn.add(f"{col['innovation']}2:{col['innovation']}{last}")

    help_ws = wb.create_sheet("How to use")
    help_ws.column_dimensions["A"].width = 28
    help_ws.column_dimensions["B"].width = 90
    rows = [
        ("KVS&CO item workbook", ""),
        ("", ""),
        ("SKU", "Unique code per item. Import matches existing items by SKU (merge mode)."),
        ("Name (English/Tamil)", "Tamil is optional — English is shown if Tamil is blank."),
        ("Category", "e.g. Cement, Steel & TMT, Bricks & Blocks, Sand & Aggregates, Tiles & Flooring, Paints & Coatings, Plumbing, Electrical, Hardware & Tools, Waterproofing, Wood & Plywood, Roofing. New categories are allowed."),
        ("Price (INR)", "Optional indicative price. Leave blank for 'Price on request'."),
        ("Stock Qty", "Optional. If Availability is blank it is derived: 0 = Out of Stock, 1-10 = Low Stock, more = In Stock."),
        ("Availability", "In Stock / Low Stock / Out of Stock / On Order (dropdown)."),
        ("Highlight / New Innovation", "Yes puts the item in the Highlights rail / New Innovations section."),
        ("Image", "Optional web URL. Easier: leave blank and add photos in Admin > Items — right-click an item > Add image. Blank cells keep the existing photo."),
        ("Specs", "Key: Value pairs separated by semicolons, e.g. Grade: 53; Standard: IS 12269"),
        ("", ""),
        ("Import modes", "Merge = add new SKUs and update existing ones (others untouched). Replace = the workbook becomes the full catalogue."),
    ]
    for r, (a, b) in enumerate(rows, 1):
        help_ws.cell(row=r, column=1, value=a).font = Font(bold=True)
        help_ws.cell(row=r, column=2, value=b).alignment = Alignment(wrap_text=True)
    help_ws["A1"].font = Font(bold=True, size=14, color="E2702B")

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def parse_workbook(stream):
    wb = openpyxl.load_workbook(stream, read_only=True, data_only=True)
    ws = wb["Items"] if "Items" in wb.sheetnames else wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = next(rows, None)
    if not header:
        raise ValueError("The sheet is empty.")
    keys = [_header_key(h) for h in header]
    if "name_en" not in keys and "sku" not in keys:
        raise ValueError("No 'Name (English)' or 'SKU' column found. Download the template to see the expected headers.")
    parsed, errors = [], []
    for n, row in enumerate(rows, 2):
        if row is None or all(v is None or str(v).strip() == "" for v in row):
            continue
        raw = {k: v for k, v in zip(keys, row) if k}
        if not str(raw.get("name_en") or "").strip():
            errors.append({"row": n, "error": "Missing Name (English)"})
            continue
        if raw.get("image"):
            raw["image"] = resolve_image_ref(str(raw["image"]).strip())
        parsed.append(raw)
    wb.close()
    return parsed, errors


def resolve_image_ref(ref):
    if re.match(r"^https?://", ref, re.I) or ref.startswith("/uploads/"):
        return ref
    name = Path(ref).name
    if (UPLOADS / name).is_file():
        return f"/uploads/{name}"
    return ref  # kept verbatim; admin page flags it as unresolved


# ---------------------------------------------------------------- app

app = Flask(__name__, static_folder=None)
app.config.update(
    SECRET_KEY=_secret(),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Strict",
    MAX_CONTENT_LENGTH=25 * 1024 * 1024,
    # set KVS_SECURE=1 when served over HTTPS (any real hosting)
    SESSION_COOKIE_SECURE=os.environ.get("KVS_SECURE") == "1",
)
app.json.ensure_ascii = False
if os.environ.get("KVS_BEHIND_PROXY") == "1":
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
_bootstrap()


def admin_required(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        if not session.get("admin"):
            return jsonify(error="Not signed in"), 401
        # custom header blocks cross-site form posts (CSRF) on top of SameSite
        if request.method != "GET" and request.headers.get("X-KVS-Admin") != "1":
            return jsonify(error="Bad request"), 400
        return fn(*a, **kw)
    return wrapper


@app.after_request
def headers(resp):
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "SAMEORIGIN"
    resp.headers["Referrer-Policy"] = "same-origin"
    if request.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


# ---- pages / static

@app.get("/")
def index():
    return send_from_directory(STATIC, "index.html")


@app.get("/admin")
def admin_page():
    return send_from_directory(STATIC, "admin.html")


@app.get("/static/<path:p>")
def static_files(p):
    return send_from_directory(STATIC, p)


@app.get("/uploads/<path:name>")
def uploads(name):
    if Path(name).suffix.lower() not in IMAGE_EXT:
        abort(404)
    return send_from_directory(UPLOADS, name)


# ---- public api

@app.get("/api/catalog")
def catalog():
    db = load_items()
    return jsonify(version=db["version"], items=db["items"], settings=load_settings())


@app.get("/api/version")
def version():
    return jsonify(version=load_items()["version"])


# ---- auth

@app.post("/api/login")
def login():
    ip = request.remote_addr or "?"
    now = time.time()
    recent = [t for t in _failed.get(ip, []) if now - t < 300]
    if len(recent) >= 5:
        return jsonify(error="Too many attempts. Try again in a few minutes."), 429
    body = request.get_json(silent=True) or {}
    auth = _read(AUTH_FILE, {})
    if body.get("username") == auth.get("username") and check_password_hash(auth.get("hash", ""), body.get("password", "")):
        session.clear()
        session["admin"] = True
        _failed.pop(ip, None)
        return jsonify(ok=True, defaultPassword=bool(auth.get("default")))
    recent.append(now)
    _failed[ip] = recent
    return jsonify(error="Wrong username or password."), 401


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/me")
def me():
    auth = _read(AUTH_FILE, {})
    return jsonify(admin=bool(session.get("admin")), defaultPassword=bool(auth.get("default")) if session.get("admin") else None)


@app.post("/api/admin/password")
@admin_required
def change_password():
    body = request.get_json(silent=True) or {}
    auth = _read(AUTH_FILE, {})
    if not check_password_hash(auth.get("hash", ""), body.get("current", "")):
        return jsonify(error="Current password is wrong."), 400
    new = body.get("new", "")
    if len(new) < 8:
        return jsonify(error="New password must be at least 8 characters."), 400
    auth.update(hash=generate_password_hash(new), default=False,
                username=(body.get("username") or auth.get("username") or DEFAULT_USER).strip())
    _write(AUTH_FILE, auth)
    return jsonify(ok=True)


# ---- items CRUD

@app.post("/api/admin/items")
@admin_required
def create_item():
    with _lock:
        db = load_items()
        item = normalise(request.get_json(silent=True) or {})
        item["id"] = uuid.uuid4().hex[:12]
        if any(i["sku"].lower() == item["sku"].lower() for i in db["items"]):
            return jsonify(error=f"SKU {item['sku']} already exists."), 400
        db["items"].append(item)
        return jsonify(save_items(db["items"]) | {"item": item})


@app.put("/api/admin/items/<item_id>")
@admin_required
def update_item(item_id):
    with _lock:
        db = load_items()
        for n, it in enumerate(db["items"]):
            if it["id"] == item_id:
                merged = normalise(it | (request.get_json(silent=True) or {}) | {"id": item_id})
                if any(o["id"] != item_id and o["sku"].lower() == merged["sku"].lower() for o in db["items"]):
                    return jsonify(error=f"SKU {merged['sku']} already exists."), 400
                db["items"][n] = merged
                return jsonify(save_items(db["items"]) | {"item": merged})
    return jsonify(error="Item not found"), 404


@app.delete("/api/admin/items/<item_id>")
@admin_required
def delete_item(item_id):
    with _lock:
        db = load_items()
        items = [i for i in db["items"] if i["id"] != item_id]
        if len(items) == len(db["items"]):
            return jsonify(error="Item not found"), 404
        return jsonify(save_items(items))


# ---- images

def _save_image(f):
    ext = Path(f.filename or "").suffix.lower()
    if ext not in IMAGE_EXT:
        raise ValueError(f"{f.filename}: only PNG, JPG, WEBP or GIF images are allowed.")
    head = f.stream.read(16)
    f.stream.seek(0)
    sigs = (b"\x89PNG", b"\xff\xd8\xff", b"GIF8", b"RIFF")
    if not head.startswith(sigs):
        raise ValueError(f"{f.filename}: file content is not a valid image.")
    stem = re.sub(r"[^A-Za-z0-9_-]+", "-", Path(f.filename).stem).strip("-")[:60] or "img"
    name = f"{stem}{ext}"
    if (UPLOADS / name).exists():
        name = f"{stem}-{uuid.uuid4().hex[:6]}{ext}"
    f.save(UPLOADS / name)
    return stem, name


def _drop_upload_if_unused(url, items):
    """Delete an uploaded file once no item points at it any more."""
    if url.startswith("/uploads/") and not any(i["image"] == url for i in items):
        (UPLOADS / Path(url).name).unlink(missing_ok=True)


@app.post("/api/admin/items/<item_id>/image")
@admin_required
def set_item_image(item_id):
    """Upload one photo and attach it to the item (used by the right-click menu)."""
    f = request.files.get("file")
    if not f:
        return jsonify(error="No file received"), 400
    with _lock:
        db = load_items()
        it = next((i for i in db["items"] if i["id"] == item_id), None)
        if not it:
            return jsonify(error="Item not found"), 404
        try:
            _, name = _save_image(f)
        except ValueError as e:
            return jsonify(error=str(e)), 400
        old, it["image"], it["updated"] = it["image"], f"/uploads/{name}", int(time.time())
        _drop_upload_if_unused(old, db["items"])
        return jsonify(save_items(db["items"]) | {"item": it})


@app.delete("/api/admin/items/<item_id>/image")
@admin_required
def remove_item_image(item_id):
    with _lock:
        db = load_items()
        it = next((i for i in db["items"] if i["id"] == item_id), None)
        if not it:
            return jsonify(error="Item not found"), 404
        old, it["image"] = it["image"], ""
        _drop_upload_if_unused(old, db["items"])
        return jsonify(save_items(db["items"]) | {"item": it})


@app.post("/api/admin/upload")
@admin_required
def upload_images():
    """Upload one or more images. Files named after a SKU (e.g. KVS-CEM-001.jpg)
    are linked to that item automatically."""
    files = request.files.getlist("files")
    if not files:
        return jsonify(error="No files received"), 400
    saved, errors, linked = [], [], []
    with _lock:
        db = load_items()
        by_sku = {i["sku"].lower(): i for i in db["items"]}
        for f in files:
            try:
                stem, name = _save_image(f)
            except ValueError as e:
                errors.append(str(e))
                continue
            url = f"/uploads/{name}"
            saved.append({"file": f.filename, "url": url})
            it = by_sku.get(stem.lower())
            if it and request.form.get("autolink", "1") == "1":
                it["image"] = url
                linked.append(it["sku"])
            # also resolve items whose Excel image cell named this file
            for i in db["items"]:
                if i["image"] and Path(i["image"]).name.lower() == (f.filename or "").lower() and not i["image"].startswith("/uploads/"):
                    i["image"] = url
                    linked.append(i["sku"])
        out = save_items(db["items"]) if linked else load_items()
    return jsonify(saved=saved, errors=errors, linked=sorted(set(linked)), version=out["version"])


# ---- Excel

@app.get("/api/admin/template")
@admin_required
def template():
    from seed import SEED_ITEMS
    sample = [normalise(dict(i)) for i in SEED_ITEMS[:3]]
    return send_file(build_workbook(sample), as_attachment=True, download_name="KVSCO_items_template.xlsx",
                     mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@app.get("/api/admin/export")
@admin_required
def export():
    stamp = time.strftime("%Y%m%d_%H%M")
    return send_file(build_workbook(load_items()["items"]), as_attachment=True,
                     download_name=f"KVSCO_items_{stamp}.xlsx",
                     mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@app.post("/api/admin/import")
@admin_required
def import_excel():
    f = request.files.get("file")
    if not f or not (f.filename or "").lower().endswith((".xlsx", ".xlsm")):
        return jsonify(error="Please choose an .xlsx workbook."), 400
    mode = request.form.get("mode", "merge")
    dry = request.form.get("dry", "1") == "1"
    try:
        rows, errors = parse_workbook(io.BytesIO(f.read()))
    except Exception as e:  # corrupt / non-Excel file
        return jsonify(error=f"Could not read workbook: {e}"), 400

    with _lock:
        db = load_items()
        existing = {i["sku"].lower(): i for i in db["items"]}
        result, added, updated, seen = [], [], [], set()
        for raw in rows:
            sku = str(raw.get("sku") or "").strip()
            key = sku.lower()
            if key and key in seen:
                errors.append({"row": None, "error": f"Duplicate SKU {sku} — later row ignored"})
                continue
            if key and key in existing:
                old = existing[key]
                # blank cells in the sheet keep the current value
                patch = {k: v for k, v in raw.items() if v is not None and str(v).strip() != ""}
                if "availability" not in patch and "stock" in patch:
                    patch["availability"] = None  # re-derive from new stock
                item = normalise(old | patch | {"id": old["id"]})
                updated.append(item["sku"])
            else:
                item = normalise(raw)
                added.append(item["sku"])
            seen.add(item["sku"].lower())
            result.append(item)

        if mode == "replace":
            final = result
            removed = [i["sku"] for i in db["items"] if i["sku"].lower() not in seen]
        else:
            touched = {i["sku"].lower() for i in result}
            final = [i for i in db["items"] if i["sku"].lower() not in touched] + result
            removed = []

        unresolved = [i["sku"] for i in result if i["image"] and not re.match(r"^(https?://|/uploads/)", i["image"])]
        summary = dict(mode=mode, rows=len(rows), added=added, updated=updated, removed=removed,
                       errors=errors, unresolvedImages=unresolved, total=len(final), committed=False)
        if not dry:
            summary["version"] = save_items(final)["version"]
            summary["committed"] = True
    return jsonify(summary)


# ---- settings

SETTING_KEYS = {"company_name", "tagline_en", "tagline_ta", "phone", "whatsapp", "email",
                "address_en", "address_ta", "hours_en", "hours_ta", "show_prices", "map_url"}


@app.put("/api/admin/settings")
@admin_required
def update_settings():
    body = request.get_json(silent=True) or {}
    s = load_settings()
    for k, v in body.items():
        if k in SETTING_KEYS:
            s[k] = bool(v) if k == "show_prices" else str(v).strip()
    _write(SETTINGS_FILE, s)
    with _lock:
        save_items(load_items()["items"])  # bump version so open pages refresh
    return jsonify(settings=s)


@app.errorhandler(413)
def too_large(_e):
    return jsonify(error="File too large (max 25 MB)."), 413


if __name__ == "__main__":
    host = os.environ.get("KVS_HOST", "127.0.0.1")
    port = int(os.environ.get("KVS_PORT", "5050"))
    auth = _read(AUTH_FILE, {})
    print(f"\n  KVS&CO showroom  ->  http://{host}:{port}")
    print(f"  Admin            ->  http://{host}:{port}/admin")
    if auth.get("default"):
        print(f"  Default login: {DEFAULT_USER} / {DEFAULT_PASSWORD}  (change it in Admin > Settings)\n")
    app.run(host=host, port=port, debug=False, threaded=True)
