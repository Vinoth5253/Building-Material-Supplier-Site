// KVS&CO admin
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const AV_KEYS = ["in_stock", "low_stock", "out_of_stock", "on_order"];
  const state = { lang: store.get("kvs_lang") === "ta" ? "ta" : "en", items: [], settings: {}, q: "", cat: "", av: "", editing: null, xlFile: null, ctxItem: null };

  // admin strings first, then shared site strings (availability, categories)
  const t = (k, vars = {}) => {
    let s = ADMIN_I18N[state.lang][k] ?? I18N[state.lang][k] ?? ADMIN_I18N.en[k] ?? I18N.en[k] ?? k;
    for (const [a, b] of Object.entries(vars)) s = s.split(`{${a}}`).join(b);
    return s;
  };
  const catName = (c) => (state.lang === "ta" && I18N.ta.cat[c]) || c;
  const itemName = (i) => (state.lang === "ta" && i.name_ta) || i.name_en;

  function paintStatic() {
    document.documentElement.lang = state.lang;
    $$("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    $$("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
    $$("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    $$("[data-i18n-title]").forEach((el) => (el.title = t(el.dataset.i18nTitle)));
    $$(".lang-switch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === state.lang)));
    const avOpts = AV_KEYS.map((k) => `<option value="${k}">${esc(t(k))}</option>`).join("");
    $("#aAv").innerHTML = `<option value="">${esc(t("all_availability"))}</option>` + avOpts;
    $("#aAv").value = state.av;
    const ev = $("#editAv"), cur = ev.value;
    ev.innerHTML = avOpts; if (cur) ev.value = cur;
    if (state.xlFile) $("#xlName").textContent = state.xlFile.name;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".lang-switch button[data-lang]");
    if (!b || b.dataset.lang === state.lang) return;
    state.lang = b.dataset.lang; store.set("kvs_lang", state.lang);
    paintStatic(); renderItems();
    if ($("#editModal").classList.contains("open")) $("#editTitle").textContent = t(state.editing ? "edit_item" : "add_item");
  });

  async function api(url, opts = {}) {
    const headers = { "X-KVS-Admin": "1", ...(opts.json ? { "Content-Type": "application/json" } : {}) };
    const r = await fetch(url, { method: opts.method || "GET", headers, body: opts.json ? JSON.stringify(opts.json) : opts.body, credentials: "same-origin" });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && !url.endsWith("/login")) { showLogin(); throw new Error(data.error || "Session expired — please sign in again."); }
    if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  }

  let toastTimer;
  function toast(msg, isErr) {
    const el = $("#toast");
    el.textContent = msg; el.classList.toggle("error", !!isErr); el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }
  const fail = (e) => toast(e.message || String(e), true);

  // ---------- auth
  function showLogin() { $("#appView").hidden = true; $("#loginView").hidden = false; $("#loginForm [name=username]").focus(); }
  async function showApp(defaultPw) {
    $("#loginView").hidden = true; $("#appView").hidden = false;
    $("#pwWarn").hidden = !defaultPw;
    await loadData();
  }
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    $("#loginError").textContent = "";
    try {
      const d = await api("/api/login", { method: "POST", json: { username: f.get("username"), password: f.get("password") } });
      e.target.reset();
      showApp(d.defaultPassword);
    } catch (err) { $("#loginError").textContent = err.message; }
  });
  $("#logoutBtn").addEventListener("click", async () => { await api("/api/logout", { method: "POST" }).catch(() => {}); showLogin(); });

  // ---------- data
  async function loadData() {
    const d = await fetch("/api/catalog", { cache: "no-store" }).then((r) => r.json());
    state.items = d.items; state.settings = d.settings || {};
    renderItems(); fillSettings();
  }
  function applyResult(d) {
    // CRUD endpoints return the full item list; keep local copy in sync
    if (d.items) state.items = d.items;
    renderItems();
  }

  // ---------- items tab
  const cats = () => [...new Set(state.items.map((i) => i.category))].sort();
  function renderItems() {
    const counts = { "": state.items.length };
    AV_KEYS.forEach((k) => (counts[k] = state.items.filter((i) => i.availability === k).length));
    $("#kpis").innerHTML = ["", ...AV_KEYS]
      .map((k) => `<button type="button" class="kpi ${k}" data-av="${k}" aria-pressed="${state.av === k}"><b>${counts[k]}</b><span>${esc(t(k || "kpi_total"))}</span></button>`).join("");

    const cs = cats();
    $("#aCat").innerHTML = `<option value="">${esc(t("all_categories"))}</option>` + cs.map((c) => `<option value="${esc(c)}">${esc(catName(c))}</option>`).join("");
    $("#aCat").value = state.cat;
    $("#catList").innerHTML = [...new Set([...cs, ...Object.keys(CAT_HUE)])].map((c) => `<option value="${esc(c)}">`).join("");

    const q = state.q.toLowerCase();
    const list = state.items.filter((i) => (!state.cat || i.category === state.cat) && (!state.av || i.availability === state.av) &&
      (!q || [i.sku, i.name_en, i.name_ta, i.category, catName(i.category), i.brand].join(" ").toLowerCase().includes(q)));
    $("#rows").innerHTML = list.map((i) => `
      <tr data-id="${esc(i.id)}">
        <td class="thumb"><button type="button" class="thumb-btn" data-act="image" title="${esc(t(i.image ? "ctx_change_image" : "ctx_add_image"))}" aria-label="${esc(t(i.image ? "ctx_change_image" : "ctx_add_image"))}">${productArt(i)}</button></td>
        <td class="nm"><b>${esc(itemName(i))}</b><small>${esc(i.sku)}${i.unit ? " · " + esc(i.unit) : ""}</small></td>
        <td>${esc(catName(i.category))}</td>
        <td class="num">${i.price == null ? "—" : Number(i.price).toLocaleString("en-IN")}</td>
        <td class="num">${i.stock == null ? "—" : i.stock}</td>
        <td><select class="select av-sel ${i.availability}" data-field="availability" aria-label="${esc(t("th_avail"))}">
          ${AV_KEYS.map((k) => `<option value="${k}" ${k === i.availability ? "selected" : ""}>${esc(t(k))}</option>`).join("")}</select></td>
        <td><label class="switch"><input type="checkbox" data-field="highlight" ${i.highlight ? "checked" : ""} aria-label="${esc(t("th_highlight"))}"><span class="track"></span></label></td>
        <td><label class="switch"><input type="checkbox" data-field="innovation" ${i.innovation ? "checked" : ""} aria-label="${esc(t("th_innov"))}"><span class="track"></span></label></td>
        <td class="acts">
          <button class="btn" type="button" data-act="edit" aria-label="${esc(t("ctx_edit"))}" title="${esc(t("ctx_edit"))}">${icon("edit")}</button>
          <button class="btn btn-danger" type="button" data-act="del" aria-label="${esc(t("ctx_delete"))}" title="${esc(t("ctx_delete"))}">${icon("trash")}</button>
        </td>
      </tr>`).join("") || `<tr><td colspan="9" class="muted" style="text-align:center;padding:40px">${esc(t("no_match"))}</td></tr>`;
    $("#rowCount").textContent = t("showing", { n: list.length, total: state.items.length });
  }

  $("#aq").addEventListener("input", (e) => { state.q = e.target.value; renderItems(); });
  $("#aCat").addEventListener("change", (e) => { state.cat = e.target.value; renderItems(); });
  $("#aAv").addEventListener("change", (e) => { state.av = e.target.value; renderItems(); });
  $("#kpis").addEventListener("click", (e) => { const b = e.target.closest(".kpi"); if (b) { state.av = state.av === b.dataset.av ? "" : b.dataset.av; renderItems(); } });

  const rowItem = (el) => state.items.find((i) => i.id === el.closest("tr")?.dataset.id);

  // quick inline edits
  $("#rows").addEventListener("change", async (e) => {
    const el = e.target.closest("[data-field]"); if (!el) return;
    const it = rowItem(el);
    const value = el.type === "checkbox" ? el.checked : el.value;
    try { applyResult(await api(`/api/admin/items/${it.id}`, { method: "PUT", json: { [el.dataset.field]: value } })); toast(t("saved")); }
    catch (err) { fail(err); renderItems(); }
  });
  $("#rows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const it = rowItem(b);
    if (b.dataset.act === "image") pickImage(it);
    if (b.dataset.act === "edit") openEditor(it);
    if (b.dataset.act === "del") deleteItem(it);
  });

  async function deleteItem(it) {
    if (!confirm(t("confirm_delete", { name: it.name_en, sku: it.sku }))) return;
    try { applyResult(await api(`/api/admin/items/${it.id}`, { method: "DELETE" })); toast(t("deleted")); } catch (err) { fail(err); }
  }

  // ---------- per-item photo: right-click menu, thumbnail click, drag & drop on row
  function pickImage(it) { state.ctxItem = it; $("#rowImgFile").click(); }
  async function uploadItemImage(it, file) {
    const row = $(`#rows tr[data-id="${CSS.escape(it.id)}"]`);
    row?.classList.add("busy");
    toast(t("uploading"));
    const fd = new FormData(); fd.append("file", file);
    try { applyResult(await api(`/api/admin/items/${it.id}/image`, { method: "POST", body: fd })); toast(t("img_uploaded", { name: itemName(it) })); }
    catch (err) { fail(err); row?.classList.remove("busy"); }
  }
  $("#rowImgFile").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f && state.ctxItem) uploadItemImage(state.ctxItem, f);
    e.target.value = "";
  });

  const ctx = $("#ctx");
  function openCtx(it, x, y) {
    state.ctxItem = it;
    $("#ctxHead").textContent = `${itemName(it)} · ${it.sku}`;
    $("#ctxImgLabel").textContent = t(it.image ? "ctx_change_image" : "ctx_add_image");
    $('[data-ctx="remove-image"]', ctx).hidden = !it.image;
    ctx.hidden = false;
    const w = ctx.offsetWidth, h = ctx.offsetHeight;
    ctx.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + "px";
    ctx.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + "px";
    $("button:not([hidden])", ctx).focus();
  }
  const closeCtx = () => { ctx.hidden = true; };
  $("#rows").addEventListener("contextmenu", (e) => {
    const it = rowItem(e.target); if (!it) return;
    e.preventDefault();
    openCtx(it, e.clientX, e.clientY);
  });
  // keyboard: Context-menu key / Shift+F10 on a focused row control
  $("#rows").addEventListener("keydown", (e) => {
    if (e.key !== "ContextMenu" && !(e.shiftKey && e.key === "F10")) return;
    const it = rowItem(e.target); if (!it) return;
    e.preventDefault();
    const r = e.target.getBoundingClientRect();
    openCtx(it, r.left, r.bottom + 4);
  });
  ctx.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-ctx]"); if (!b) return;
    const it = state.ctxItem; closeCtx();
    if (b.dataset.ctx === "image") pickImage(it);
    if (b.dataset.ctx === "edit") openEditor(it);
    if (b.dataset.ctx === "delete") deleteItem(it);
    if (b.dataset.ctx === "remove-image") {
      try { applyResult(await api(`/api/admin/items/${it.id}/image`, { method: "DELETE" })); toast(t("img_removed")); } catch (err) { fail(err); }
    }
  });
  ctx.addEventListener("keydown", (e) => {
    const btns = $$("button:not([hidden])", ctx), i = btns.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
  });
  document.addEventListener("mousedown", (e) => { if (!ctx.hidden && !ctx.contains(e.target)) closeCtx(); });
  addEventListener("scroll", closeCtx, { passive: true });
  addEventListener("resize", closeCtx);

  let dragRow = null;
  const setDrag = (row) => { dragRow?.classList.remove("drop-over"); dragRow = row; row?.classList.add("drop-over"); };
  $("#rows").addEventListener("dragover", (e) => {
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault(); setDrag(e.target.closest("tr[data-id]"));
  });
  $("#rows").addEventListener("dragleave", (e) => { if (!$("#rows").contains(e.relatedTarget)) setDrag(null); });
  $("#rows").addEventListener("drop", (e) => {
    e.preventDefault(); setDrag(null);
    const it = rowItem(e.target); const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
    if (it && f) uploadItemImage(it, f);
  });

  // ---------- editor
  const form = $("#editForm");
  function paintEditArt() { $("#editArt").innerHTML = productArt({ category: form.category.value || "Other", image: form.image.value }); }
  function openEditor(it) {
    state.editing = it || null;
    $("#editTitle").textContent = t(it ? "edit_item" : "add_item");
    $("#editError").textContent = "";
    form.reset();
    const v = it || { availability: "in_stock", category: state.cat || "" };
    ["sku", "name_en", "name_ta", "category", "brand", "unit", "price", "stock", "availability", "desc_en", "desc_ta", "specs", "image"]
      .forEach((k) => (form[k].value = v[k] ?? ""));
    form.highlight.checked = !!v.highlight;
    form.innovation.checked = !!v.innovation;
    paintEditArt();
    $("#editModal").classList.add("open");
    form.sku.focus();
  }
  const closeEditor = () => $("#editModal").classList.remove("open");
  $("#addBtn").addEventListener("click", () => openEditor(null));
  $$("[data-close]").forEach((b) => b.addEventListener("click", closeEditor));
  $("#editModal").addEventListener("click", (e) => { if (e.target.id === "editModal") closeEditor(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeEditor(); closeCtx(); } });
  form.image.addEventListener("input", paintEditArt);
  form.category.addEventListener("input", paintEditArt);
  $("#clearImg").addEventListener("click", () => { form.image.value = ""; paintEditArt(); });
  $("#editImgFile").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append("files", f); fd.append("autolink", "0");
    try {
      const d = await api("/api/admin/upload", { method: "POST", body: fd });
      if (d.errors.length) throw new Error(d.errors[0]);
      form.image.value = d.saved[0].url; paintEditArt(); toast(t("photo_pending"));
    } catch (err) { fail(err); }
    e.target.value = "";
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form).entries());
    body.highlight = form.highlight.checked;
    body.innovation = form.innovation.checked;
    try {
      const d = state.editing
        ? await api(`/api/admin/items/${state.editing.id}`, { method: "PUT", json: body })
        : await api("/api/admin/items", { method: "POST", json: body });
      applyResult(d); closeEditor(); toast(t("item_saved"));
    } catch (err) { $("#editError").textContent = err.message; }
  });

  // ---------- tabs
  function goto(tab) {
    $$(".tabs [data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === tab)));
    $$(".tab-panel").forEach((p) => (p.hidden = p.id !== `tab-${tab}`));
  }
  $(".tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) goto(b.dataset.tab); });
  document.addEventListener("click", (e) => { const a = e.target.closest("[data-goto]"); if (a) { e.preventDefault(); goto(a.dataset.goto); } });

  // ---------- Excel import
  const mode = () => $("input[name=mode]:checked").value;
  async function runImport(dry) {
    const fd = new FormData();
    fd.append("file", state.xlFile); fd.append("mode", mode()); fd.append("dry", dry ? "1" : "0");
    return api("/api/admin/import", { method: "POST", body: fd });
  }
  const chipList = (arr, max = 40) => arr.length ? `<div class="chips">${arr.slice(0, max).map((s) => `<span>${esc(s)}</span>`).join("")}${arr.length > max ? `<span>+${arr.length - max}</span>` : ""}</div>` : "";
  async function preview() {
    if (!state.xlFile) return;
    $("#applyBtn").disabled = true;
    $("#preview").textContent = t("reading");
    try {
      const d = await runImport(true);
      $("#preview").innerHTML = `
        <div class="sum">
          <div><b>${d.rows}</b><span>${esc(t("rows_read"))}</span></div>
          <div><b style="color:var(--st-in)">${d.added.length}</b><span>${esc(t("new_items"))}</span></div>
          <div><b style="color:var(--st-order)">${d.updated.length}</b><span>${esc(t("updated"))}</span></div>
          <div><b style="color:var(--st-out)">${d.removed.length}</b><span>${esc(t("removed"))}</span></div>
        </div>
        ${d.added.length ? `<p style="margin-top:14px"><b>${esc(t("new_l"))}</b></p>${chipList(d.added)}` : ""}
        ${d.updated.length ? `<p style="margin-top:10px"><b>${esc(t("updated_l"))}</b></p>${chipList(d.updated)}` : ""}
        ${d.removed.length ? `<p style="margin-top:10px;color:var(--st-out)"><b>${esc(t("removed_l"))}</b></p>${chipList(d.removed)}` : ""}
        ${d.unresolvedImages.length ? `<p style="margin-top:10px;color:var(--st-low)"><b>${esc(t("unresolved"))}</b></p>${chipList(d.unresolvedImages)}` : ""}
        ${d.errors.length ? `<ul class="list-err">${d.errors.map((er) => `<li>${er.row ? esc(t("row_n", { n: er.row })) : ""}${esc(er.error)}</li>`).join("")}</ul>` : ""}
        <p class="muted small" style="margin-top:12px">${esc(t("after_total", { n: d.total }))}</p>`;
      $("#applyBtn").disabled = d.rows === 0;
    } catch (err) { $("#preview").innerHTML = `<p class="form-error">${esc(err.message)}</p>`; }
  }
  const xlDrop = $("#xlDrop"), xlInput = $("#xlFile");
  ["dragenter", "dragover"].forEach((ev) => xlDrop.addEventListener(ev, (e) => { e.preventDefault(); xlDrop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => xlDrop.addEventListener(ev, (e) => { e.preventDefault(); xlDrop.classList.remove("over"); }));
  const takeXl = (files) => {
    const f = files.find((x) => /\.xls[xm]$/i.test(x.name));
    if (!f) return toast(t("xlsx_only"), true);
    state.xlFile = f; $("#xlName").textContent = f.name; preview();
  };
  xlDrop.addEventListener("drop", (e) => takeXl([...e.dataTransfer.files]));
  xlInput.addEventListener("change", () => { takeXl([...xlInput.files]); xlInput.value = ""; });
  $$("input[name=mode]").forEach((r) => r.addEventListener("change", preview));
  $("#applyBtn").addEventListener("click", async () => {
    if (mode() === "replace" && !confirm(t("confirm_replace"))) return;
    try {
      const d = await runImport(false);
      await loadData();
      toast(t("imported", { a: d.added.length, u: d.updated.length, r: d.removed.length }));
      state.xlFile = null; $("#xlName").textContent = t("drop_xl");
      $("#preview").innerHTML = `<p style="color:var(--st-in);font-weight:700">${esc(t("applied", { n: d.total }))}</p>`;
      $("#applyBtn").disabled = true;
    } catch (err) { fail(err); }
  });

  // ---------- settings
  function fillSettings() {
    for (const el of $("#settingsForm").elements) {
      if (!el.name) continue;
      if (el.type === "checkbox") el.checked = !!state.settings[el.name];
      else el.value = state.settings[el.name] ?? "";
    }
  }
  $("#settingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {};
    for (const el of e.target.elements) if (el.name) body[el.name] = el.type === "checkbox" ? el.checked : el.value;
    try { const d = await api("/api/admin/settings", { method: "PUT", json: body }); state.settings = d.settings; toast(t("details_saved")); } catch (err) { fail(err); }
  });
  $("#pwForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#pwError").textContent = "";
    try {
      await api("/api/admin/password", { method: "POST", json: Object.fromEntries(new FormData(e.target).entries()) });
      e.target.reset(); $("#pwWarn").hidden = true; toast(t("login_updated"));
    } catch (err) { $("#pwError").textContent = err.message; }
  });

  // ---------- boot
  $$(".logo-slot").forEach((el) => (el.innerHTML = LOGO_SVG));
  $$("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
  const th = store.get("kvs_theme"); if (th) document.documentElement.dataset.theme = th;
  paintStatic();
  fetch("/api/me", { cache: "no-store" }).then((r) => r.json()).then((d) => (d.admin ? showApp(d.defaultPassword) : showLogin())).catch(showLogin);
})();
