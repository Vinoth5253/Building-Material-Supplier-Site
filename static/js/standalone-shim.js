// Standalone demo backend (used only by build_standalone.py).
// Answers the pages' /api/* calls inside the browser; changes live in this browser's localStorage.
(() => {
  if (window.__kvsShim) return;
  window.__kvsShim = true;

  const SEED = window.KVS_SEED;                 // { items, settings, images: {key: dataURI} }
  const KEY = "kvs_demo_db_v1";
  const AV = ["in_stock", "low_stock", "out_of_stock", "on_order"];
  const AV_LABEL = { in_stock: "In Stock", low_stock: "Low Stock", out_of_stock: "Out of Stock", on_order: "On Order" };
  const LOW = 10;
  const DEMO_USER = "admin", DEMO_PASS = "kvs@2026";
  const XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";

  // seed photos are referenced as "seedimg:<key>" so they are not copied into localStorage
  const imgByKey = SEED.images || {};
  const keyByImg = Object.fromEntries(Object.entries(imgByKey).map(([k, v]) => [v, k]));
  const resolveImg = (s) => (s && s.startsWith("seedimg:") ? imgByKey[s.slice(8)] || "" : s);
  const packImg = (s) => (s && keyByImg[s] ? "seedimg:" + keyByImg[s] : s);

  // ---------------------------------------------------------------- storage
  let canStore = true, mem = null, memAdmin = false;
  try { localStorage.setItem("__kvs", "1"); localStorage.removeItem("__kvs"); } catch { canStore = false; }
  const fresh = () => ({ version: Date.now(), items: JSON.parse(JSON.stringify(SEED.items)), settings: { ...SEED.settings }, auth: { username: DEMO_USER, password: DEMO_PASS } });
  function load() {
    if (canStore) {
      try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.items)) return d; } catch { /* corrupt -> reseed */ }
    }
    return mem || (mem = fresh());
  }
  function save(d) {
    d.version = Date.now();
    if (canStore) {
      try { localStorage.setItem(KEY, JSON.stringify(d)); }
      catch { throw new Error("Browser storage is full — remove some photos or use smaller images."); }
    }
    mem = d;
    return d;
  }
  const isAdmin = () => { try { return sessionStorage.getItem("kvs_demo_admin") === "1"; } catch { return memAdmin; } };
  const setAdmin = (v) => { memAdmin = v; try { v ? sessionStorage.setItem("kvs_demo_admin", "1") : sessionStorage.removeItem("kvs_demo_admin"); } catch { /* ignore */ } };

  // ---------------------------------------------------------------- normalising (mirrors app.py)
  const rid = () => Math.random().toString(16).slice(2, 14).padEnd(12, "0");
  const yes = (v) => typeof v === "boolean" ? v : ["yes", "y", "true", "1", "✓", "x", "ஆம்"].includes(String(v ?? "").trim().toLowerCase());
  const num = (v, int) => {
    if (v == null || String(v).trim() === "") return null;
    const n = parseFloat(String(v).replace(/[,₹\s]/g, ""));
    return isNaN(n) ? null : int ? Math.trunc(n) : n;
  };
  function parseAv(v, stock) {
    const s = String(v ?? "").trim().toLowerCase().replace(/[-_]/g, " ");
    if (s) {
      if (["in stock", "available", "yes", "instock", "in"].includes(s)) return "in_stock";
      if (s.startsWith("low") || ["limited", "few left"].includes(s)) return "low_stock";
      if (s.startsWith("out") || ["no", "unavailable", "sold out", "nil"].includes(s)) return "out_of_stock";
      if (s.includes("order") || ["pre order", "coming soon", "awaited"].includes(s)) return "on_order";
    }
    if (stock == null) return "in_stock";
    if (stock <= 0) return "out_of_stock";
    return stock <= LOW ? "low_stock" : "in_stock";
  }
  const str = (v) => String(v ?? "").trim();
  function normalise(it) {
    const stock = num(it.stock, true);
    const out = {
      id: it.id || rid(), sku: str(it.sku), name_en: str(it.name_en), name_ta: str(it.name_ta),
      category: str(it.category) || "Other", brand: str(it.brand), desc_en: str(it.desc_en), desc_ta: str(it.desc_ta),
      unit: str(it.unit), price: num(it.price), stock, image: packImg(str(it.image)),
      highlight: yes(it.highlight), innovation: yes(it.innovation), specs: str(it.specs), updated: Math.floor(Date.now() / 1000),
    };
    out.availability = AV.includes(it.availability) ? it.availability : parseAv(it.availability, stock);
    if (!out.sku) out.sku = "KVS-" + out.id.slice(0, 6).toUpperCase();
    return out;
  }

  // ---------------------------------------------------------------- Excel (SheetJS, loaded on first use)
  const COLUMNS = [
    ["sku", "SKU", 16, ["code", "item code", "part no", "id"]],
    ["name_en", "Name (English)", 34, ["name", "item", "item name", "product", "product name"]],
    ["name_ta", "Name (Tamil)", 34, ["tamil name", "பெயர்"]],
    ["category", "Category", 20, ["group", "type"]],
    ["brand", "Brand", 18, ["make", "manufacturer"]],
    ["unit", "Unit", 16, ["uom", "pack", "per"]],
    ["price", "Price (INR)", 13, ["price", "rate", "mrp", "price inr"]],
    ["stock", "Stock Qty", 11, ["stock", "qty", "quantity", "stock quantity"]],
    ["availability", "Availability", 16, ["status", "available"]],
    ["highlight", "Highlight (Yes/No)", 16, ["highlight", "featured"]],
    ["innovation", "New Innovation (Yes/No)", 20, ["innovation", "new innovation", "new"]],
    ["image", "Image (URL or file name)", 30, ["image", "image url", "photo", "picture"]],
    ["desc_en", "Description (English)", 50, ["description", "details"]],
    ["desc_ta", "Description (Tamil)", 50, ["tamil description", "விவரம்"]],
    ["specs", "Specs (Key: Value; ...)", 50, ["specs", "specifications"]],
  ];
  const headerKey = (h) => {
    h = String(h ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const c = COLUMNS.find(([k, head, , al]) => h === head.toLowerCase() || h === k || al.includes(h));
    return c ? c[0] : null;
  };
  let xlsxP = null;
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return (xlsxP ??= new Promise((ok, bad) => {
      const s = document.createElement("script");
      s.src = XLSX_URL;
      s.onload = () => ok(window.XLSX);
      s.onerror = () => { xlsxP = null; bad(new Error("Excel features need an internet connection (the Excel library could not be loaded).")); };
      document.head.appendChild(s);
    }));
  }
  async function downloadWorkbook(items, filename) {
    const X = await loadXLSX();
    const rows = [COLUMNS.map((c) => c[1])];
    items.forEach((it) => rows.push(COLUMNS.map(([k]) => {
      const v = it[k];
      if (k === "availability") return AV_LABEL[v] || v;
      if (k === "highlight" || k === "innovation") return v ? "Yes" : "No";
      if (k === "image") return /^https?:\/\//i.test(v || "") ? v : ""; // embedded photos stay in the app; blank keeps them on import
      return v ?? "";
    })));
    const ws = X.utils.aoa_to_sheet(rows);
    ws["!cols"] = COLUMNS.map((c) => ({ wch: c[2] }));
    const help = X.utils.aoa_to_sheet([
      ["KVS&CO item workbook"], [],
      ["SKU", "Unique code per item. Import matches existing items by SKU (merge mode)."],
      ["Name (English/Tamil)", "Tamil is optional — English is shown if Tamil is blank."],
      ["Price (INR)", "Optional indicative price. Leave blank for 'Price on request'."],
      ["Stock Qty", "Optional. If Availability is blank it is derived: 0 = Out of Stock, 1-10 = Low Stock, more = In Stock."],
      ["Availability", "In Stock / Low Stock / Out of Stock / On Order."],
      ["Highlight / New Innovation", "Yes puts the item in the Highlights rail / New Innovations section."],
      ["Image", "Optional web URL. Easier: leave blank and add photos in Admin > Items (right-click an item). Blank keeps the existing photo."],
      ["Specs", "Key: Value pairs separated by semicolons, e.g. Grade: 53; Standard: IS 12269"],
      [], ["Import modes", "Merge = add new SKUs and update existing ones. Replace = the workbook becomes the full catalogue."],
    ]);
    help["!cols"] = [{ wch: 28 }, { wch: 100 }];
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, "Items");
    X.utils.book_append_sheet(wb, help, "How to use");
    X.writeFile(wb, filename);
  }
  async function parseWorkbook(file) {
    const X = await loadXLSX();
    let wb;
    try { wb = X.read(await file.arrayBuffer(), { type: "array" }); } catch (e) { throw new Error("Could not read workbook: " + e.message); }
    const ws = wb.Sheets.Items || wb.Sheets[wb.SheetNames[0]];
    const grid = X.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: true });
    if (!grid.length) throw new Error("The sheet is empty.");
    const keys = grid[0].map(headerKey);
    if (!keys.includes("name_en") && !keys.includes("sku")) throw new Error("No 'Name (English)' or 'SKU' column found. Download the template to see the expected headers.");
    const rows = [], errors = [];
    grid.slice(1).forEach((row, n) => {
      if (!row || row.every((v) => v == null || String(v).trim() === "")) return;
      const raw = {};
      keys.forEach((k, i) => { if (k) raw[k] = row[i]; });
      if (!str(raw.name_en)) { errors.push({ row: n + 2, error: "Missing Name (English)" }); return; }
      rows.push(raw);
    });
    return { rows, errors };
  }
  function runImport(d, rows, errors, mode, dry) {
    const existing = new Map(d.items.map((i) => [i.sku.toLowerCase(), i]));
    const result = [], added = [], updated = [], seen = new Set();
    for (const raw of rows) {
      const key = str(raw.sku).toLowerCase();
      if (key && seen.has(key)) { errors.push({ row: null, error: `Duplicate SKU ${str(raw.sku)} — later row ignored` }); continue; }
      let item;
      if (key && existing.has(key)) {
        const old = existing.get(key);
        const patch = Object.fromEntries(Object.entries(raw).filter(([, v]) => v != null && String(v).trim() !== ""));
        if (!("availability" in patch) && "stock" in patch) patch.availability = null;
        item = normalise({ ...old, ...patch, id: old.id });
        updated.push(item.sku);
      } else {
        item = normalise(raw);
        added.push(item.sku);
      }
      seen.add(item.sku.toLowerCase());
      result.push(item);
    }
    let final, removed = [];
    if (mode === "replace") {
      final = result;
      removed = d.items.filter((i) => !seen.has(i.sku.toLowerCase())).map((i) => i.sku);
    } else {
      final = d.items.filter((i) => !seen.has(i.sku.toLowerCase())).concat(result);
    }
    const unresolvedImages = result.filter((i) => i.image && !/^(https?:\/\/|data:|seedimg:)/i.test(i.image)).map((i) => i.sku);
    const summary = { mode, rows: rows.length, added, updated, removed, errors, unresolvedImages, total: final.length, committed: false };
    if (!dry) { d.items = final; summary.version = save(d).version; summary.committed = true; }
    return summary;
  }

  // ---------------------------------------------------------------- photos -> resized data URLs
  async function toDataURL(file) {
    const ext = (file.name.match(/\.[^.]+$/) || [""])[0].toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) throw new Error(`${file.name}: only PNG, JPG, WEBP or GIF images are allowed.`);
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error(`${file.name}: file content is not a valid image.`)); i.src = url; });
      const s = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return ext === ".png" ? c.toDataURL("image/webp", 0.85) : c.toDataURL("image/jpeg", 0.82);
    } finally { URL.revokeObjectURL(url); }
  }

  // ---------------------------------------------------------------- router
  const res = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
  const view = (d) => ({ version: d.version, items: d.items.map((i) => ({ ...i, image: resolveImg(i.image) })) });
  const SETTING_KEYS = ["company_name", "tagline_en", "tagline_ta", "phone", "whatsapp", "email", "address_en", "address_ta", "hours_en", "hours_ta", "show_prices", "map_url"];

  async function route(path, method, body) {
    const json = () => (typeof body === "string" ? JSON.parse(body || "{}") : {});
    const d = load();
    if (path === "/api/catalog") return res(200, { ...view(d), settings: d.settings });
    if (path === "/api/version") return res(200, { version: d.version });
    if (path === "/api/me") return res(200, { admin: isAdmin(), defaultPassword: false });
    if (path === "/api/login") {
      const b = json();
      if (b.username === d.auth.username && b.password === d.auth.password) { setAdmin(true); return res(200, { ok: true, defaultPassword: false }); }
      return res(401, { error: "Wrong username or password." });
    }
    if (path === "/api/logout") { setAdmin(false); return res(200, { ok: true }); }
    if (!isAdmin()) return res(401, { error: "Not signed in" });

    if (path === "/api/admin/password") {
      const b = json();
      if (b.current !== d.auth.password) return res(400, { error: "Current password is wrong." });
      if (String(b.new || "").length < 8) return res(400, { error: "New password must be at least 8 characters." });
      d.auth = { username: str(b.username) || d.auth.username, password: b.new };
      save(d); return res(200, { ok: true });
    }
    if (path === "/api/admin/settings" && method === "PUT") {
      const b = json();
      for (const [k, v] of Object.entries(b)) if (SETTING_KEYS.includes(k)) d.settings[k] = k === "show_prices" ? !!v : str(v);
      save(d); return res(200, { settings: d.settings });
    }
    if (path === "/api/admin/items" && method === "POST") {
      const item = normalise(json()); item.id = rid();
      if (d.items.some((i) => i.sku.toLowerCase() === item.sku.toLowerCase())) return res(400, { error: `SKU ${item.sku} already exists.` });
      d.items.push(item); save(d);
      return res(200, { ...view(d), item: { ...item, image: resolveImg(item.image) } });
    }
    const m = path.match(/^\/api\/admin\/items\/([^/]+)(\/image)?$/);
    if (m) {
      const idx = d.items.findIndex((i) => i.id === m[1]);
      if (idx < 0) return res(404, { error: "Item not found" });
      let it = d.items[idx];
      if (m[2] && method === "POST") {
        const f = body.get("file"); if (!f) return res(400, { error: "No file received" });
        it.image = await toDataURL(f); it.updated = Math.floor(Date.now() / 1000);
      } else if (m[2] && method === "DELETE") {
        it.image = "";
      } else if (method === "PUT") {
        it = normalise({ ...it, image: resolveImg(it.image), ...json(), id: it.id });
        if (d.items.some((o) => o.id !== it.id && o.sku.toLowerCase() === it.sku.toLowerCase())) return res(400, { error: `SKU ${it.sku} already exists.` });
        d.items[idx] = it;
      } else if (method === "DELETE") {
        d.items.splice(idx, 1); save(d); return res(200, view(d));
      }
      save(d);
      return res(200, { ...view(d), item: { ...it, image: resolveImg(it.image) } });
    }
    if (path === "/api/admin/upload") {
      const saved = [], errors = [];
      for (const f of body.getAll("files")) {
        try { saved.push({ file: f.name, url: await toDataURL(f) }); } catch (e) { errors.push(e.message); }
      }
      return res(200, { saved, errors, linked: [], version: d.version });
    }
    if (path === "/api/admin/import") {
      const f = body.get("file");
      if (!f || !/\.xls[xm]$/i.test(f.name)) return res(400, { error: "Please choose an .xlsx workbook." });
      const { rows, errors } = await parseWorkbook(f);
      return res(200, runImport(d, rows, errors, body.get("mode") || "merge", body.get("dry") !== "0"));
    }
    return res(404, { error: "Not found" });
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, opts = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.startsWith("/api/")) return realFetch(input, opts);
    try { return await route(url.split("?")[0], (opts.method || "GET").toUpperCase(), opts.body); }
    catch (e) { return res(400, { error: e.message || String(e) }); }
  };

  // template / export links -> generate the workbook in the browser
  document.addEventListener("click", async (e) => {
    const a = e.target.closest('a[href^="/api/admin/"]');
    if (!a) return;
    e.preventDefault();
    try {
      if (a.getAttribute("href").endsWith("/template")) await downloadWorkbook(SEED.items.slice(0, 3), "KVSCO_items_template.xlsx");
      else await downloadWorkbook(load().items, `KVSCO_items_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) { alert(err.message); }
  }, true);

  // demo banner (admin page only)
  document.addEventListener("DOMContentLoaded", () => {
    const login = document.getElementById("loginForm");
    if (!login) return;
    const hint = document.createElement("p");
    hint.className = "demo-hint";
    hint.innerHTML = `Demo login: <b>${DEMO_USER}</b> / <b>${DEMO_PASS}</b>`;
    login.querySelector(".form-error").before(hint);
    const bar = document.createElement("div");
    bar.className = "demo-bar glass";
    bar.innerHTML = `<span><b>Demo copy.</b> Changes are saved only in this browser${canStore ? "" : " (and lost when the page closes)"}.</span>
      <button type="button" class="btn btn-sm">Reset demo data</button>`;
    bar.querySelector("button").addEventListener("click", () => {
      if (!confirm("Reset all items, photos and settings back to the original demo data?")) return;
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      mem = null; location.reload();
    });
    document.querySelector(".admin-main")?.prepend(bar);
  });
})();
