---
version: alpha
name: KVS&CO Showroom
description: >
  Neumorphic + glassmorphic showcase catalogue for KVS&CO, a building materials
  supplier. Soft extruded surfaces carry the controls; frosted glass panels float
  over warm construction-toned light blobs and carry the content.
colors:
  bg: "#E9EEF4"
  surface: "#E9EEF4"
  shadow-light: "#FFFFFF"
  shadow-dark: "#BCC6D3"
  ink: "#17202B"
  ink-muted: "#5A6575"
  primary: "#E2702B"        # safety / terracotta orange
  primary-ink: "#FFFFFF"
  secondary: "#1F8A70"      # oxidised copper green
  gold: "#F2B33D"           # innovation accent
  glass-fill: "rgba(255,255,255,0.42)"
  glass-border: "rgba(255,255,255,0.65)"
  status-in: "#1F9D55"
  status-low: "#D99A00"
  status-out: "#D64545"
  status-order: "#3B7DDD"
  dark-bg: "#1B2028"
  dark-shadow-light: "#262E39"
  dark-shadow-dark: "#10141A"
  dark-ink: "#E8EDF3"
  dark-ink-muted: "#9AA6B6"
  dark-glass-fill: "rgba(32,39,50,0.55)"
  dark-glass-border: "rgba(255,255,255,0.08)"
typography:
  family-latin: "Plus Jakarta Sans"
  family-tamil: "Noto Sans Tamil"
  display: { size: "clamp(2.2rem, 5vw, 4rem)", weight: 800, lineHeight: 1.05, tracking: "-0.02em" }
  h2: { size: "clamp(1.6rem, 3vw, 2.4rem)", weight: 800, lineHeight: 1.15 }
  h3: { size: "1.1rem", weight: 700, lineHeight: 1.3 }
  body: { size: "1rem", weight: 500, lineHeight: 1.6 }
  small: { size: "0.82rem", weight: 600, lineHeight: 1.4 }
spacing:
  unit: "4px"
  scale: [4, 8, 12, 16, 24, 32, 48, 72, 96]
  gutter-mobile: "16px"
  container: "1240px"
rounded:
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  pill: "999px"
elevation:
  neu-raised: "8px 8px 18px {colors.shadow-dark}, -8px -8px 18px {colors.shadow-light}"
  neu-raised-sm: "4px 4px 10px {colors.shadow-dark}, -4px -4px 10px {colors.shadow-light}"
  neu-inset: "inset 4px 4px 10px {colors.shadow-dark}, inset -4px -4px 10px {colors.shadow-light}"
  glass: "0 20px 50px rgba(23,32,43,0.12)"
  glass-blur: "18px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.pill}"
    shadow: "{elevation.neu-raised-sm}"
  button-neu:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    shadow: "{elevation.neu-raised-sm}"
    pressedShadow: "{elevation.neu-inset}"
  input:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    shadow: "{elevation.neu-inset}"
  glass-panel:
    backgroundColor: "{colors.glass-fill}"
    borderColor: "{colors.glass-border}"
    rounded: "{rounded.lg}"
    shadow: "{elevation.glass}"
  product-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    shadow: "{elevation.neu-raised}"
  status-badge:
    rounded: "{rounded.pill}"
    colors: ["{colors.status-in}", "{colors.status-low}", "{colors.status-out}", "{colors.status-order}"]
---

## Overview
A showroom, not a shop. The page should feel like walking into a clean, well-lit
yard office: tactile controls you want to press (neumorphism) and content that
floats on frosted glass over warm light. No cart, no checkout — every call to
action leads to a phone call or WhatsApp enquiry.

## Colors
Neutral cool-grey base (`bg`) so neumorphic shadows read. One warm action colour
(`primary`, terracotta/safety orange) for CTAs and the active state. Copper green
(`secondary`) for trust and the "in stock" family; gold is reserved for the
**New Innovations** section. Status colours are only ever used for availability.
Background light blobs use primary, secondary and gold at low opacity behind glass.
Dark mode swaps the base to `dark-bg` and keeps the same accents.

## Typography
Plus Jakarta Sans for Latin, Noto Sans Tamil when the language is Tamil (Tamil
glyphs are taller — headings drop tracking to 0 and line-height rises to 1.3).
Weights 500 body / 700 titles / 800 display. Never set Tamil in all caps or with
negative tracking.

## Layout
Max container 1240px, 16px gutter on phones. Sticky glass header. Section order:
Hero → Highlights (horizontal rail) → Categories (chip grid) → Catalogue (filters +
responsive grid, `minmax(240px,1fr)`) → New Innovations (bento) → Why us → Contact.
Generous vertical rhythm: 96px between sections on desktop, 64px on mobile.

## Elevation & Depth
Two depth languages, never mixed on one element:
- **Neumorphic** (same colour as background, paired light/dark shadows) for
  controls, chips, cards and inputs. Pressed/selected = inset shadow.
- **Glass** (translucent fill + blur + hairline white border) for panels that sit
  above the colourful background: header, hero card, modals, innovation tiles.

## Shapes
Soft and rounded: cards 24px, panels 24–32px, inputs and buttons pill-shaped.
Product imagery sits in a 16px-rounded inset well.

## Components
- **Header**: glass bar, logo mark + wordmark, nav, search (neu inset), language
  switcher (segmented neu control EN | தமிழ்), theme toggle.
- **Product card**: neu-raised card, inset image well, category label, name,
  unit, indicative price (optional, admin toggle), status badge with dot.
- **Status badge**: pill, tinted background at 14% of the status colour, solid dot.
- **Highlight card**: wider glass card with ribbon.
- **Innovation tile**: glass with gold edge glow and an "Innovation" tag.
- **Modal**: glass panel over a dimmed, blurred backdrop.
- **Admin**: same tokens; tables on neu surfaces, dropzone as an inset well.

## Do's and Don'ts
- Do keep text contrast ≥ 4.5:1 — never put body text on raw glass without the fill.
- Do use the inset shadow for "selected/pressed" so state reads without colour.
- Do give every image a category illustration fallback.
- Don't stack glass on glass more than one level.
- Don't use the primary orange for availability — status colours only.
- Don't add purchase, cart or checkout UI; enquiry only.
