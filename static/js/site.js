// KVS&CO public showroom
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  const AV_ORDER = ["in_stock", "low_stock", "on_order", "out_of_stock"];
  const state = {
    lang: store.get("kvs_lang") === "ta" ? "ta" : "en",
    items: [], settings: {}, version: 0,
    q: "", cat: "", av: "", sort: "featured",
  };

  const t = (k, vars = {}) => {
    let s = I18N[state.lang][k] ?? I18N.en[k] ?? k;
    for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, b);
    return s;
  };
  const catName = (c) => I18N[state.lang].cat[c] || c;
  const nm = (it) => (state.lang === "ta" && it.name_ta) || it.name_en;
  const ds = (it) => (state.lang === "ta" && it.desc_ta) || it.desc_en;
  const fmtPrice = (p) => "₹" + Number(p).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const badge = (av) => `<span class="badge ${esc(av)}">${esc(t(av))}</span>`;
  const priceHtml = (it) => {
    if (!state.settings.show_prices || it.price == null) return `<span class="price req">${esc(t("price_on_request"))}</span>`;
    return `<span class="price">${fmtPrice(it.price)}<small>${esc(it.unit)}</small></span>`;
  };
  const waLink = (it) => {
    const num = String(state.settings.whatsapp || "").replace(/\D/g, "");
    const msg = it ? t("wa_msg", { name: it.name_en, sku: it.sku }) : "Hello KVS&CO";
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  };
  const telLink = () => "tel:" + String(state.settings.phone || "").replace(/[^\d+]/g, "");

  // ---------- static text + icons
  function paintStatic() {
    document.documentElement.lang = state.lang;
    $$("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    $$("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
    $$("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    $$("#langSwitch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === state.lang)));
    const s = state.settings;
    $("#tagline").textContent = (state.lang === "ta" && s.tagline_ta) || s.tagline_en || "";
    $("#footName").textContent = s.company_name || "KVS&CO";

    $("#fAv").innerHTML = [["", t("all_availability")], ...AV_ORDER.map((a) => [a, t(a)])]
      .map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("");
    $("#fAv").value = state.av;
    $("#fSort").innerHTML = [["featured", "sort_featured"], ["name", "sort_name"], ["price_asc", "sort_price_asc"], ["price_desc", "sort_price_desc"]]
      .map(([v, k]) => `<option value="${v}">${esc(t(k))}</option>`).join("");
    $("#fSort").value = state.sort;
  }

  function hydrateIcons(root = document) {
    $$("[data-icon]", root).forEach((el) => { el.innerHTML = icon(el.dataset.icon); el.removeAttribute("data-icon"); });
  }

  // ---------- data-driven sections
  const categories = () => {
    const counts = {};
    state.items.forEach((i) => (counts[i.category] = (counts[i.category] || 0) + 1));
    const known = Object.keys(CAT_HUE);
    return Object.keys(counts).sort((a, b) => {
      const ia = known.indexOf(a), ib = known.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    }).map((c) => ({ c, n: counts[c] }));
  };

  function renderHero() {
    const inStock = state.items.filter((i) => i.availability === "in_stock" || i.availability === "low_stock").length;
    countUp($("#statProducts"), state.items.length);
    countUp($("#statCats"), categories().length);
    countUp($("#statStock"), inStock);
    const picks = state.items.filter((i) => i.highlight).slice(0, 3);
    $("#heroMini").innerHTML = picks.map((i) => `
      <div class="row"><span class="ic">${icon(i.category)}</span><span class="nm">${esc(nm(i))}</span>${badge(i.availability)}</div>`).join("");
    $("#heroCall").href = telLink();
  }

  function countUp(el, to) {
    const from = Number(el.dataset.v || 0);
    el.dataset.v = to;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || from === to) { el.textContent = to; return; }
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / 900);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function renderHighlights() {
    const list = state.items.filter((i) => i.highlight);
    $("#highlights").hidden = !list.length;
    $("#rail").innerHTML = list.map((i) => `
      <button type="button" class="hl-card glass" data-id="${esc(i.id)}">
        <div class="hl-media">
          <span class="hl-ribbon">${icon("star")}${esc(t("highlight_tag"))}</span>
          ${productArt(i)}
          ${badge(i.availability)}
        </div>
        <div class="hl-body">
          <span class="tag tag-primary" style="align-self:flex-start">${esc(catName(i.category))}</span>
          <h3>${esc(nm(i))}</h3>
          <p>${esc(ds(i))}</p>
          <div class="hl-foot">${priceHtml(i)}<span class="more">${esc(t("view"))}${icon("arrowR")}</span></div>
        </div>
      </button>`).join("");
    $("#railDots").innerHTML = list.map((_, n) => `<button type="button" aria-label="${n + 1} / ${list.length}"></button>`).join("");
    updateDots();
  }

  // ---------- highlights carousel: auto-slide, pause on hover/focus/touch
  const rail = () => $("#rail");
  const railStep = () => {
    const c = rail().querySelector(".hl-card");
    return c ? c.getBoundingClientRect().width + parseFloat(getComputedStyle(rail()).columnGap || 0) : rail().clientWidth;
  };
  function updateDots() {
    const r = rail(), dots = $$("#railDots button");
    if (!dots.length) return;
    const atEnd = r.scrollLeft >= r.scrollWidth - r.clientWidth - 4;
    const idx = atEnd ? dots.length - 1 : Math.round(r.scrollLeft / railStep());
    dots.forEach((d, n) => d.setAttribute("aria-current", String(n === idx)));
  }
  function slide(dir = 1) {
    const r = rail();
    const max = r.scrollWidth - r.clientWidth;
    if (dir > 0 && r.scrollLeft >= max - 4) r.scrollTo({ left: 0, behavior: "smooth" });
    else if (dir < 0 && r.scrollLeft <= 4) r.scrollTo({ left: max, behavior: "smooth" });
    else r.scrollBy({ left: dir * railStep(), behavior: "smooth" });
  }
  let autoTimer = null, paused = false;
  function startAuto() {
    clearInterval(autoTimer);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    autoTimer = setInterval(() => { if (!paused && !document.hidden) slide(1); }, 4000);
  }

  function renderCategories() {
    const cats = categories();
    $("#catGrid").innerHTML = cats.map(({ c, n }) => `
      <button type="button" class="cat-chip" data-cat="${esc(c)}" aria-pressed="${state.cat === c}">
        <span class="ci">${icon(c)}</span><b>${esc(catName(c))}</b><small>${esc(t("items_count", { n }))}</small>
      </button>`).join("");
    $("#fCat").innerHTML = `<option value="">${esc(t("all_categories"))}</option>` +
      cats.map(({ c }) => `<option value="${esc(c)}">${esc(catName(c))}</option>`).join("");
    $("#fCat").value = state.cat;
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    let list = state.items.filter((i) =>
      (!state.cat || i.category === state.cat) &&
      (!state.av || i.availability === state.av) &&
      (!q || [i.name_en, i.name_ta, i.category, catName(i.category), i.brand, i.sku, i.desc_en, i.desc_ta].join(" ").toLowerCase().includes(q)));
    const byPrice = (dir) => (a, b) => (a.price == null) - (b.price == null) || dir * ((a.price ?? 0) - (b.price ?? 0));
    const sorts = {
      featured: (a, b) => (b.highlight - a.highlight) || (b.innovation - a.innovation) || AV_ORDER.indexOf(a.availability) - AV_ORDER.indexOf(b.availability),
      name: (a, b) => nm(a).localeCompare(nm(b), state.lang),
      price_asc: byPrice(1), price_desc: byPrice(-1),
    };
    return list.sort(sorts[state.sort] || sorts.featured);
  }

  function renderGrid() {
    const list = filtered();
    $("#count").textContent = t("items_count", { n: list.length });
    $("#clearBtn").hidden = !(state.q || state.cat || state.av);
    $$(".cat-chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === state.cat)));
    if (!list.length) {
      $("#grid").innerHTML = `<div class="empty glass" style="grid-column:1/-1">${icon("search")}<p>${esc(t("no_results"))}</p></div>`;
      return;
    }
    $("#grid").innerHTML = list.map((i) => `
      <button type="button" class="card" data-id="${esc(i.id)}">
        <div class="top">
          <div class="flags">${i.innovation ? `<span class="tag tag-gold">${icon("sparkle")}${esc(t("innov_tag"))}</span>` : ""}</div>
          ${productArt(i)}
        </div>
        <div><div class="cat">${esc(catName(i.category))}</div><h3>${esc(nm(i))}</h3><div class="unit">${esc(i.unit)}</div></div>
        <div class="foot">${priceHtml(i)}${badge(i.availability)}</div>
      </button>`).join("");
  }

  function renderInnovations() {
    const list = state.items.filter((i) => i.innovation);
    $("#innovations").hidden = !list.length;
    $("#bento").innerHTML = list.map((i, n) => `
      <button type="button" class="in-tile glass ${n === 0 ? "big" : ""}" data-id="${esc(i.id)}">
        ${productArt(i)}
        <span class="tag tag-gold" style="align-self:flex-start">${icon("sparkle")}${esc(t("innov_tag"))}</span>
        <h3>${esc(nm(i))}</h3>
        <p>${esc(ds(i))}</p>
        <div class="row">${priceHtml(i)}${badge(i.availability)}</div>
      </button>`).join("");
  }

  function renderContact() {
    const s = state.settings;
    const L = (en, ta) => (state.lang === "ta" && s[ta]) || s[en] || "";
    const rows = [
      ["phone", t("phone"), s.phone ? `<a href="${esc(telLink())}">${esc(s.phone)}</a>` : ""],
      ["mail", t("email"), s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ""],
      ["pin", t("address"), L("address_en", "address_ta") ? (s.map_url ? `<a href="${esc(s.map_url)}" target="_blank" rel="noopener">${esc(L("address_en", "address_ta"))}</a>` : `<span>${esc(L("address_en", "address_ta"))}</span>`) : ""],
      ["clock", t("hours"), L("hours_en", "hours_ta") ? `<span>${esc(L("hours_en", "hours_ta"))}</span>` : ""],
    ].filter((r) => r[2]);
    $("#infoList").innerHTML = rows.map(([ic, label, val]) =>
      `<div class="info"><span class="ic">${icon(ic)}</span><div><small>${esc(label)}</small>${val}</div></div>`).join("");
    $("#ctaCall").href = telLink();
    $("#ctaWa").href = waLink();
  }

  function renderAll() {
    paintStatic();
    renderHero(); renderHighlights(); renderCategories(); renderGrid(); renderInnovations(); renderContact();
    observeReveal();
  }

  // ---------- product modal
  let lastFocus = null;
  function openItem(id) {
    const i = state.items.find((x) => x.id === id);
    if (!i) return;
    const specs = String(i.specs || "").split(";").map((s) => s.trim()).filter(Boolean).map((s) => {
      const k = s.indexOf(":");
      return k > 0 ? [s.slice(0, k).trim(), s.slice(k + 1).trim()] : ["", s];
    });
    const facts = [[t("sku"), i.sku], [t("unit"), i.unit], [t("category"), catName(i.category)], [t("brand"), i.brand]].filter((f) => f[1]);
    $("#modalBody").innerHTML = `
      <div class="pd">
        ${productArt(i)}
        <div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${i.innovation ? `<span class="tag tag-gold">${icon("sparkle")}${esc(t("innov_tag"))}</span>` : ""}
            ${i.highlight ? `<span class="tag tag-primary">${esc(t("highlight_tag"))}</span>` : ""}
          </div>
          <h2 id="pdTitle">${esc(nm(i))}</h2>
          ${badge(i.availability)}
          <p class="desc">${esc(ds(i))}</p>
          ${state.settings.show_prices && i.price != null ? `<small style="color:var(--muted);font-weight:700">${esc(t("indicative"))}</small>` : ""}
          <div>${priceHtml(i)}</div>
          <div class="facts">${facts.map(([k, v]) => `<div class="fact"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join("")}</div>
          ${specs.length ? `<h3 style="margin:0 0 6px;font-size:1rem">${esc(t("specs"))}</h3><table>${specs.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>` : ""}
          <div class="actions">
            <a class="btn btn-primary" href="${esc(waLink(i))}" target="_blank" rel="noopener">${icon("chat")}${esc(t("enquire"))}</a>
            <a class="btn" href="${esc(telLink())}">${icon("phone")}${esc(t("call"))}</a>
          </div>
        </div>
      </div>`;
    lastFocus = document.activeElement;
    $("#modal").classList.add("open");
    document.body.style.overflow = "hidden";
    $("#modalClose").focus();
  }
  function closeModal() {
    $("#modal").classList.remove("open");
    document.body.style.overflow = "";
    lastFocus?.focus();
  }

  // ---------- reveal
  let io;
  function observeReveal() {
    if (!("IntersectionObserver" in window)) { $$(".reveal").forEach((e) => e.classList.add("in")); return; }
    io ??= new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    $$(".reveal:not(.in)").forEach((e) => io.observe(e));
  }

  // ---------- theme
  function applyTheme(th) {
    if (th) document.documentElement.dataset.theme = th; else delete document.documentElement.dataset.theme;
    const dark = th ? th === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    $("#themeBtn").innerHTML = icon(dark ? "sun" : "moon");
  }

  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  // ---------- data + live refresh
  async function load(quiet) {
    try {
      const r = await fetch("/api/catalog", { cache: "no-store" });
      const d = await r.json();
      const changed = state.version && d.version !== state.version;
      Object.assign(state, { items: d.items, settings: d.settings || {}, version: d.version });
      renderAll();
      if (changed && !quiet) toast(t("updated"));
    } catch (e) { console.error(e); }
  }
  async function poll() {
    if (document.hidden) return;
    try {
      const r = await fetch("/api/version", { cache: "no-store" });
      const { version } = await r.json();
      if (version !== state.version) load();
    } catch { /* offline */ }
  }

  // ---------- events
  function wire() {
    $("#logoMark").innerHTML = LOGO_SVG;
    $("#year").textContent = new Date().getFullYear();
    hydrateIcons();
    applyTheme(store.get("kvs_theme"));
    $("#themeBtn").addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = cur === "dark" ? "light" : "dark";
      store.set("kvs_theme", next); applyTheme(next);
    });
    $("#langSwitch").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-lang]");
      if (!b || b.dataset.lang === state.lang) return;
      state.lang = b.dataset.lang; store.set("kvs_lang", state.lang); renderAll();
    });

    const setQ = (v, from) => {
      state.q = v;
      if (from !== "q") $("#q").value = v;
      if (from !== "h") $("#headerSearch").value = v;
      renderGrid();
    };
    $("#q").addEventListener("input", (e) => setQ(e.target.value, "q"));
    $("#headerSearch").addEventListener("input", (e) => setQ(e.target.value, "h"));
    $("#headerSearch").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#catalog").scrollIntoView(); });
    $("#fCat").addEventListener("change", (e) => { state.cat = e.target.value; renderGrid(); });
    $("#fAv").addEventListener("change", (e) => { state.av = e.target.value; renderGrid(); });
    $("#fSort").addEventListener("change", (e) => { state.sort = e.target.value; renderGrid(); });
    $("#clearBtn").addEventListener("click", () => { state.cat = state.av = ""; $("#fCat").value = $("#fAv").value = ""; setQ(""); });
    $("#catGrid").addEventListener("click", (e) => {
      const b = e.target.closest(".cat-chip"); if (!b) return;
      state.cat = state.cat === b.dataset.cat ? "" : b.dataset.cat;
      $("#fCat").value = state.cat; renderGrid();
      $("#catalog").scrollIntoView();
    });

    document.addEventListener("click", (e) => {
      const card = e.target.closest("[data-id]");
      if (card && !e.target.closest(".modal")) openItem(card.dataset.id);
    });
    $("#modalClose").addEventListener("click", closeModal);
    $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#modal").classList.contains("open")) closeModal(); });

    $("#railPrev").addEventListener("click", () => { slide(-1); startAuto(); });
    $("#railNext").addEventListener("click", () => { slide(1); startAuto(); });
    $("#railDots").addEventListener("click", (e) => {
      const n = $$("#railDots button").indexOf(e.target.closest("button"));
      if (n >= 0) { rail().scrollTo({ left: n * railStep(), behavior: "smooth" }); startAuto(); }
    });
    const hl = $("#highlights");
    hl.addEventListener("mouseenter", () => (paused = true));
    hl.addEventListener("mouseleave", () => (paused = false));
    hl.addEventListener("focusin", () => (paused = true));
    hl.addEventListener("focusout", () => (paused = false));
    rail().addEventListener("touchstart", () => (paused = true), { passive: true });
    rail().addEventListener("touchend", () => setTimeout(() => (paused = false), 3000), { passive: true });
    rail().addEventListener("scroll", () => requestAnimationFrame(updateDots), { passive: true });
    startAuto();

    // active nav link on scroll
    const links = $$(".site-nav a");
    const secs = links.map((a) => $(a.getAttribute("href"))).filter(Boolean);
    addEventListener("scroll", () => {
      const y = scrollY + 120;
      let cur = secs[0];
      secs.forEach((s) => { if (s.offsetTop <= y) cur = s; });
      links.forEach((a) => a.classList.toggle("active", $(a.getAttribute("href")) === cur));
    }, { passive: true });

    setInterval(poll, 20000);
    document.addEventListener("visibilitychange", poll);
  }

  wire();
  paintStatic();
  load(true);
})();
