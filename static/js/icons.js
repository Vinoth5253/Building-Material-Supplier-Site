// Line icons (24px grid, stroke) + category art used when an item has no photo.
const ICON_PATHS = {
  // categories
  "Cement": '<path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/><path d="M8 12h8M8 15.5h8"/>',
  "Steel & TMT": '<path d="M3 8h18M3 12h18M3 16h18"/><path d="M6 6.5v3M10 6.5v3M14 6.5v3M18 6.5v3M8 10.5v3M12 10.5v3M16 10.5v3M6 14.5v3M10 14.5v3M14 14.5v3M18 14.5v3"/>',
  "Bricks & Blocks": '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19"/>',
  "Sand & Aggregates": '<path d="M2 19c2.5-5 5-8 10-8s7.5 3 10 8H2z"/><circle cx="8" cy="7" r="1.3"/><circle cx="13" cy="5" r="1"/><circle cx="16.5" cy="8" r="1.4"/>',
  "Tiles & Flooring": '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  "Paints & Coatings": '<rect x="3" y="3" width="15" height="7" rx="2"/><path d="M18 6.5h2.5v5H11V15"/><rect x="9" y="15" width="4" height="6" rx="1"/>',
  "Plumbing": '<path d="M3 7h6a4 4 0 0 1 4 4v1"/><path d="M3 4v6M13 12h4a4 4 0 0 1 4 4v4"/><path d="M18 20h6" transform="translate(-3 0)"/><path d="M11 12h4v3h-4z"/>',
  "Electrical": '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  "Hardware & Tools": '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z"/>',
  "Waterproofing": '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9 14.5a3 3 0 0 0 3 3"/>',
  "Wood & Plywood": '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10c4 1 6-1 9 0s5 1 9 0M3 14c4 1 6-1 9 0s5 1 9 0"/>',
  "Roofing": '<path d="M2 12 12 4l10 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  "Other": '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  // ui
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  arrowL: '<path d="m15 18-6-6 6-6"/>',
  arrowR: '<path d="m9 18 6-6-6-6"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3z"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>',
  truck: '<path d="M2 6h11v10H2zM13 9h4l4 4v3h-8"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  helmet: '<path d="M3 18h18M5 18v-3a7 7 0 0 1 14 0v3"/><path d="M10 8V5h4v3"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
};

// hue per category for the fallback art gradient
const CAT_HUE = {
  "Cement": 28, "Steel & TMT": 210, "Bricks & Blocks": 12, "Sand & Aggregates": 40,
  "Tiles & Flooring": 190, "Paints & Coatings": 320, "Plumbing": 200, "Electrical": 48,
  "Hardware & Tools": 230, "Waterproofing": 195, "Wood & Plywood": 30, "Roofing": 160,
};

function icon(name, cls = "") {
  const p = ICON_PATHS[name] || ICON_PATHS.Other;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

function catHue(cat) {
  if (cat in CAT_HUE) return CAT_HUE[cat];
  let h = 0; for (const c of String(cat)) h = (h * 31 + c.charCodeAt(0)) % 360; return h;
}

// Product visual: uploaded photo if present, otherwise category art.
function productArt(item, cls = "art") {
  // the icon always sits underneath; a broken photo just removes itself
  const h = catHue(item.category);
  const img = item.image
    ? `<img src="${String(item.image).replace(/"/g, "&quot;")}" alt="" loading="lazy" onerror="this.remove()">`
    : "";
  return `<div class="${cls}" style="--h:${h}">${icon(item.category, "art-icon")}${img}</div>`;
}

const LOGO_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 20h18" stroke="var(--ink)"/><path d="M5 20V10l7-6 7 6v10" stroke="var(--primary)"/><path d="M9 20v-5h6v5" stroke="var(--secondary)"/></svg>`;
