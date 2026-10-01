---
name: Estoca
description: Warehouse data-collector software for a per-visitor inventory sandbox.
colors:
  trigger: "#ECCB67"
  trigger-hover: "#DEBE5F"
  trigger-ink: "#1B1F22"
  rail: "#23272B"
  rail-raised: "#30363B"
  rail-foreground: "#EEF1F0"
  rail-muted: "#A3ACB0"
  entrada: "#368D64"
  saida: "#973C30"
  ajuste: "#3C58B4"
  background: "#EEF1F0"
  card: "#FBFCFB"
  foreground: "#1B1F22"
  muted-foreground: "#545D62"
  secondary: "#E3E8E6"
  well: "#E6EAE8"
  border: "#D3DAD8"
  input: "#BFC8C5"
  warn: "#8A5300"
  warn-soft: "#F7ECD4"
  danger-soft: "#F6E1DC"
  danger-ink: "#773226"
  destructive: "#9C4535"
  danger-ink-deep: "#7D2616"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 72"
  readout:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 760
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1, 'lnum' 1"
    fontVariation: "'wdth' 72"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 86"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1"
  control:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.43
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  key-legend:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
  sku:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    letterSpacing: "0.04em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 88"
rounded:
  sm: "4px"
  md: "6px"
  lg: "10px"
  xl: "12px"
spacing:
  key-gap: "8px"
  grid-gap: "16px"
  grid-gap-lg: "20px"
  panel-inset: "20px"
  gutter: "16px"
  gutter-sm: "24px"
  gutter-lg: "32px"
components:
  button-trigger:
    backgroundColor: "{colors.trigger}"
    textColor: "{colors.trigger-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-trigger-hover:
    backgroundColor: "{colors.trigger-hover}"
  button-trigger-lg:
    backgroundColor: "{colors.trigger}"
    textColor: "{colors.trigger-ink}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
  button-graphite:
    backgroundColor: "{colors.rail}"
    textColor: "#F4F6F5"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-graphite-hover:
    backgroundColor: "{colors.rail-raised}"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.secondary}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "#FFFFFF"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-locked:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  input-field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  kbd-legend:
    backgroundColor: "{colors.card}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.key-legend}"
    rounded: "{rounded.sm}"
    padding: "0 4px"
    height: "20px"
  op-glyph-entrada:
    backgroundColor: "{colors.entrada}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    size: "24px"
  op-glyph-saida:
    backgroundColor: "{colors.saida}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    size: "24px"
  op-glyph-ajuste:
    backgroundColor: "{colors.ajuste}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    size: "24px"
  op-key:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  op-key-selected:
    backgroundColor: "{colors.secondary}"
  urgency-zerado:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger-ink-deep}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "24px"
  urgency-critico:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "24px"
  urgency-baixo:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "24px"
  panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  graphite-display:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-foreground}"
    rounded: "{rounded.lg}"
    padding: "20px 24px"
  movement-readout:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-foreground}"
    typography: "{typography.readout}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  dialog:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
  status-bar:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-muted}"
    typography: "{typography.label}"
    padding: "0 16px"
    height: "40px"
  rail-nav-item:
    backgroundColor: "transparent"
    textColor: "#CFD5D3"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  rail-nav-item-active:
    backgroundColor: "{colors.rail-raised}"
    textColor: "{colors.rail-foreground}"
---

# Design System: Estoca

## Overview

**Creative North Star: "The Coletor"**

Estoca is drawn as the software on a warehouse RF data collector. A graphite polycarbonate housing (status bar, rail, displays) wraps a cool, light work surface. The instruments are few and literal: one read field, a key per operation, and a wide condensed numeric display that shows the balance before and after. Anything that can be pressed is a key with a lip; anything that reports is a graphite display; everything else is quiet grey-white surface with hairline borders.

Density is operational rather than airy: 40px control rows, 13px labels sitting over heavy condensed figures, 16 to 20px between panels. One family, Archivo, carries every voice by moving along its width axis: condensed and heavy for figures, normal width for the interface. Color is rationed. One trigger yellow commits, three operation colors appear only as signs, and text stays achromatic.

The confirmed rejection is the KPI-card SaaS admin: four rounded stat tiles, a gradient area chart, a zinc sidebar. Totals live in one graphite display strip; balance history is a step line in graphite ink with shaped markers.

**Key Characteristics:**
- Graphite display material around a cool light work surface.
- One trigger yellow, for the primary commit and the focus cue on graphite.
- Operation color confined to + − = sign tiles and chart markers, with shape as the second channel.
- Archivo on the width axis: 72% heavy tabular figures for readouts, normal width for UI.
- Keys carry a 2px bottom lip that collapses on press; displays carry a 3px inset bezel.
- Key legends (M, /, E, S, A) appear only on shortcuts that actually work.

## Colors

Cool, near-achromatic greys, one hot trigger, and three small signal colors that never touch text.

### Primary
- **Trigger Yellow** (#ECCB67): the primary commit key and nothing else on the light surface: "Registrar movimentação" in the toolbar, the confirm key in the movement dialog, "Entrar" at login, retry and new-sandbox on the boot panel. On graphite it is also the focus outline, and it is the text-selection color. Ink on it is Trigger Ink (#1B1F22); hover deepens to Pressed Yellow (#DEBE5F); the key edge is a darker ochre (#B79C51). All accents are held at moderate chroma (OKLCH C ≈ 0.12) so keys read as painted plastic, not signage.

### Secondary
- **Graphite Polycarbonate** (#23272B): the display material. Rail, status bar, Painel display strip, movement readout, Administração countdown panel, boot and login panels. Off the displays it is the default non-commit key face, the selected segment in the history type filter, the value-by-category bars, and the balance step line.
- **Raised Graphite** (#30363B): active rail item, the Atalhos card on the rail, graphite key hover, login info cells, boot error notice.
- **Display Light** (#EEF1F0): figures and primary copy on graphite.
- **Display Dim** (#A3ACB0): labels, units and secondary copy on graphite; inactive rail icons, lock icons, the countdown hourglass.

### Tertiary
- **Entrada Green** (#368D64): the + tile and the ▲ chart marker; also the one-time good-read row flash (22% mix fading to transparent).
- **Saída Red** (#973C30): the − tile and the ▼ chart marker. The destructive key face is its own muted brick, Destructive (#9C4535), with hover #893B2D.
- **Ajuste Indigo** (#3C58B4): the = tile and the ◆ chart marker.

### Neutral
- **Work Surface** (#EEF1F0): page background. It is the same value as Display Light on purpose: the housing prints in the color of the paper.
- **Card White** (#FBFCFB): panels, fields, dialogs, outline keys; also the 2px halo stroke around chart markers.
- **Ink** (#1B1F22): all text on light surfaces, focus ring on light surfaces.
- **Muted Ink** (#545D62): descriptions, meta lines, axis ticks, idle Kbd legends.
- **Pressed Grey** (#E3E8E6): hover and selected key face, the Baixo tag, chart gridlines.
- **Well** (#E6EAE8): dialog footers, table heads, code chips, bar tracks.
- **Hairline** (#D3DAD8): every default border and divider.
- **Field Edge** (#BFC8C5): input, select and outline-key borders; the locked key's dashed edge.
- **Warn Ochre on Warn Cream** (#8A5300 on #F7ECD4): the Crítico tag and the falls-below-limit notice in the movement dialog.
- **Deep Rust on Danger Blush** (#7D2616 on #F6E1DC): the Zerado tag, server errors, the error-state tile.
- **Rust Ink** (#773226): inline field errors and the destructive key edge.

### Named Rules
**The One Trigger Rule.** Trigger yellow is reserved for the primary commit action and for the focus cue on graphite. The single carve-out is the logo's small yellow read mark. Countdowns, active nav icons, locks and status icons are neutral (Display Light or Display Dim), never yellow.

**The Signs Only Rule.** Operation color lives only in the + − = glyph tiles and the chart markers. Chart markers also carry shape (▲ entrada, ▼ saída, ◆ ajuste) because the green/red pair sits in the CVD 6–8 ΔE floor band. Signed quantities, labels and table text stay achromatic.

**The Graphite Is a Display Rule.** Graphite means "this reports": rail, status bar, display strip, movement readout, countdown panel, boot and login panel. It is never a container color for ordinary lists or forms.

## Typography

**Display Font:** Archivo (variable, `wdth` axis loaded) with ui-sans-serif, system-ui fallback
**Body Font:** Archivo, same file
**Label/Mono Font:** none; SKUs and codes use Archivo at 88% width with tabular figures

**Character:** One grotesque doing every job by changing width, the way a collector's segment display and its printed keypad share one housing. Condensed heavy figures read as instrument output; normal-width UI text reads as the manual.

### Hierarchy
- **Display** (800, 56px, 44px under 640px, line-height 1, 72% width, proportional figures): the stored-value total in the Painel display strip. One per screen.
- **Readout** (760, 40px in the movement readout; 120/104/64px for the Administração countdown; 32px for display-strip cells; 26px on login cells; 22px in the quantity field; 20px for low-stock balances): any balance, count or countdown. Tabular lining figures, 72% width, line-height 1.
- **Headline** (800, 32px, 28px under 640px, line-height 1.25, 86% width): page titles only, in the page header.
- **Title** (700, 16px): panel headings; dialog titles step up to 18px at -0.01em.
- **Body** (400, 15px, line-height 1.5): page descriptions (max 70ch), field text, readout notes. Dense panel content drops to 14px.
- **Control** (600, 14px): key labels, operation names, low-stock product names.
- **Label** (400, 13px): meta lines under panel titles, labels above figures, status-bar copy, field help.
- **Key legend** (700, 11px): Kbd legends only.
- **SKU** (400, 13 to 15px, 0.04em tracking, 88% width, tabular): product codes and the sandbox ID.

### Named Rules
**The Width Axis Rule.** Voice comes from the width axis, not from a second family: 72% for figures, 70% for the wordmark, 86% for page titles, 88% for codes, 100% for UI. Do not add a mono or a display face.

**The Tabular Floor Rule.** The body sets `tnum` globally so every number in a column aligns; readouts add lining figures. The one exception is the display-strip total and unit count, which switch to proportional figures for a tighter large-size setting.

## Layout

A fixed instrument frame around a scrolling work area. The graphite status bar (40px) is sticky across the full width. At 1024px and up a 240px graphite rail sits at left, sticky under the status bar; below 1024px the rail becomes a 280px sheet opened from the status bar. A sticky toolbar under the status bar holds the read field (flexible width) and the trigger key (40px tall), translucent Work Surface at 85% behind a 2px blur.

Main content is capped at 1320px with gutters of 16px, 24px from 640px, and 32px from 1024px. At 1024px and up pages use a 12-column grid with 20px gaps (16px below): the Painel splits 8/4 (display strip and timeline left, low-stock queue and value-by-category right), Administração splits 7/5 (countdown display and sandbox identity). Panels pad 20px horizontally with a 16/12px header. Keys inside a group sit 8px apart. Dialogs become bottom sheets on phones (8px inset, body scrolls on its own so header and actions stay in reach) and center at 512px wide from 640px (600px for the movement dialog).

## Elevation & Depth

Flat and tonal. Depth comes from three surfaces stepping in value (Work Surface, Card White, Well), 1px hairlines, and pressed-material cues rather than cast shadows. Keys carry an inset bottom lip; displays carry a heavier inset bezel. Only floating layers (dialogs, select menus) cast a soft shadow, over a 45% Ink scrim.

### Shadow Vocabulary
- **Key lip** (`box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.16)` on trigger, `0.35` on graphite, `0.22` on destructive; `inset 0 -2px 0 rgb(27 31 34 / 0.07)` on outline and operation keys): the 2px bottom edge of anything pressable. On press it collapses to 1px and the key drops 1px.
- **Key seated** (`box-shadow: inset 0 2px 0 rgb(27 31 34 / 0.14)` with a 1px drop): the selected operation key, held down.
- **Display bezel** (`box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.3)`): every graphite display (display strip, movement readout, countdown panel).
- **Panel rest** (`box-shadow: 0 1px 0 rgb(27 31 34 / 0.04)`): the hairline seat under a Card White panel.
- **Field well** (`box-shadow: inset 0 1px 0 rgb(27 31 34 / 0.05)`): inputs and the read field sit slightly recessed.
- **Dialog lift** (`box-shadow: 0 24px 64px -24px rgb(27 31 34 / 0.5)`): dialogs only.
- **Menu lift** (`box-shadow: 0 12px 32px -12px rgb(27 31 34 / 0.35)`): select menus.

### Named Rules
**The Lip Is a Key Rule.** The 2px bottom lip (a `border-b-2` or an inset bottom shadow) belongs only to real keys: buttons, Kbd legends, OpGlyph tiles, and the operation selector keys; the build extends the same key material to the other pressable controls (select trigger, segmented type filter, active rail item). Non-pressable icon tiles (empty- and error-state tiles, boot step markers, login role checks) stay flat.

**The Keycap Is Not a Stripe Rule.** `impeccable detect` flags `border-accent-on-rounded` on the Kbd and OpGlyph lips. That finding was ruled during the finish review as this world's keycap material, not an accent stripe. Do not "fix" it away.

## Shapes

One radius rule with four steps, chosen by what the object is: keycaps and tags 4px, controls 6px, panels and displays 10px, dialogs 12px. Nothing is pill-shaped. Borders are 1px hairlines; the locked key swaps its solid edge for a dashed Field Edge border so a forbidden action still reads as a key, just not a live one. Keycaps and sign tiles are square-ish (20 to 36px). Chart markers are triangles and a diamond with rounded joins and a 2px Card White halo. The wordmark's read mark is a small square at 2px radius.

## Components

### Buttons
Keys, not pills: a flat face, a 1px edge, a 2px lip that collapses on press.
- **Shape:** gently squared (6px). Heights 32px (small), 36px (default), 40px (toolbar), 44px (large, login and boot).
- **Trigger:** Trigger Yellow face, Trigger Ink label, ochre edge, 0.16 lip. One per view, for the commit.
- **Graphite (default):** Graphite face, near-white label, 0.35 lip; hover lifts to Raised Graphite.
- **Outline:** Card White face, Field Edge border, faint 0.07 lip; hover to Pressed Grey. Cancel, stepper keys, per-row "Entrada".
- **Destructive:** Saída Red face, Rust Ink edge, white label, 0.22 lip.
- **Ghost / Link:** no lip; ghost hovers to Pressed Grey, link carries a 35% underline that goes solid on hover.
- **Locked:** dashed Field Edge border, transparent face, Muted Ink label at 500. Still clickable: it opens the reason.
- **Press / Focus:** 150ms ease-out on background, shadow, color and transform; press drops 1px. Focus is a 2px Ink outline at 2px offset; on graphite the outline turns Trigger Yellow.
- **Disabled:** 45% opacity while sending; an `aria-disabled` commit key sits at 55% but stays clickable so it can surface the reason.

### Key legends (Kbd)
- **Style:** 20px tall, 4px radius, 1px edge with a 2px bottom border, 11px bold legend. Three tones: light (Card White on Field Edge), on-trigger (7% black face on the yellow key), on-rail (6% white face, Display Dim legend).
- **Use:** only on shortcuts that work: M (registrar movimentação), / (read field), E, S, A (operation keys in the movement dialog).

### Operation glyph (OpGlyph)
- **Style:** a square sign key, 20 / 24 / 36px, 4px radius, operation color face, white bold + − = sign, a 2px darker bottom edge in the same hue.
- **Rule:** always paired with the operation word or placed in a labelled row; the tile is `aria-hidden`.

### Chips (urgency tags)
- **Style:** 24px, 4px radius, 12px bold, icon + word. Zerado: X-circle on Danger Blush in Deep Rust. Crítico: warning-diamond on Warn Cream in Warn Ochre. Baixo: warning-triangle on Pressed Grey in Ink.
- **Rule:** low-stock status always ships icon + word, never color alone.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** Card White on the Work Surface.
- **Shadow Strategy:** panel rest hairline only (see Elevation & Depth).
- **Border:** 1px Hairline.
- **Internal Padding:** 20px sides; header 16px top, 12px bottom, with a real h2 and an optional 13px meta line. Nothing decorative sits above the heading. Row lists inside panels divide with hairlines and run edge to edge.

### Inputs / Fields
- **Style:** 40px, 6px radius, Card White, Field Edge border, recessed 1px inner shadow, 15px text, placeholder in a dimmed grey (#6B7479). Select triggers share the shape and take the key lip instead of the recess.
- **Read field:** the collector's scan field. A barcode icon at left, a light `/` Kbd at right, full remaining width of the toolbar.
- **Focus:** border and a 2px outline both go to Ink (1px offset).
- **Error / Disabled:** error turns the border Saída Red and prints a 13px Rust Ink message below; disabled and read-only fall to Pressed Grey.

### Navigation
- **Status bar:** 40px graphite strip, 13px Display Dim copy. Left: shield + "Sandbox isolada", the copyable sandbox ID in SKU style, hourglass + countdown in Display Light semibold. Right: profile switch menu.
- **Rail:** 240px graphite column. Wordmark at top (70% width, 22px, with the yellow read mark). Items are 40px, 15px, 6px radius, icon at 20px. Inactive: light grey text (#CFD5D3), Display Dim icon; hover to 5% white. Active: Raised Graphite face with a 0.25 key lip, semibold Display Light text, filled icon in Display Light. Locked areas show a Display Dim lock and explain on click. An Atalhos card at the foot lists the working shortcuts with on-rail Kbd legends.
- **Mobile:** the same rail content inside a 280px left sheet opened from the status bar.

### Graphite display (signature)
The Painel display strip: a 10px-radius graphite panel with the 3px bezel. Left cell carries a 13px Display Dim label, the Display-role total, and a one-line derivation. Right cells (units, active categories) split by 10% white hairlines and use the Readout role at 32px. The Administração countdown and the login/boot panels are the same material.

### Movement readout (signature)
The collector display inside the movement dialog: balance before (Readout, Display Dim), the large OpGlyph with the signed quantity, and the balance after (Readout, Display Light). Digits roll into place as the user types (200ms, cubic-bezier(0.16, 1, 0.3, 1)); a negative result tints the final figure a pale coral (#FF9A86). Ajuste reads as a replacement: "No sistema", then "Saldo final (contado)", then the difference stated once under a 10% white rule.

### Operation selector keys (signature)
Three keys in a row (E, S, A): Card White face, Field Edge border, 0.07 lip, OpGlyph + name + Kbd. The selected key is seated: Pressed Grey face, Graphite border, inset top shadow, dropped 1px. On phones the legend hides and the key stacks glyph over name.

### Balance timeline
A step-after line in Graphite at 2px on a Card White panel, Pressed Grey gridlines, 12px Muted Ink ticks. Only the markers carry operation color, and each carries its shape. A legend repeats the shapes, and a disclosure below offers the same data as a table.

### Dialogs
12px radius, Card White, Dialog lift over a 45% Ink scrim. Header and footer are fixed; the body scrolls. The footer sits on Well with Cancel (outline) and the commit (trigger) at right. Entry is 200ms fade with a 16px rise on phones and a 0.98 zoom on larger screens. While a request is in flight every exit is locked.

### Good read
After a confirmed movement, the new history row flashes once: Entrada Green at 22% fading to transparent over 1.6s (cubic-bezier(0.16, 1, 0.3, 1)). With reduced motion the row keeps a static 12% tint instead.

## Do's and Don'ts

### Do:
- **Do** reserve Trigger Yellow (#ECCB67) for the one primary commit key in a view and for the focus outline on graphite; the logo's read mark is the only other yellow.
- **Do** keep operation color inside the + − = tiles and the chart markers, and give every chart marker its shape (▲ entrada, ▼ saída, ◆ ajuste).
- **Do** use graphite (#23272B) with the 3px inset bezel for anything that reports a live value: display strip, movement readout, countdown, boot and login panels.
- **Do** set every balance, quantity and countdown in the Readout role (Archivo 72% width, 760, tabular lining figures).
- **Do** give real keys the 2px bottom lip and let it collapse to 1px with a 1px drop on press.
- **Do** ship low-stock status as icon + word (Zerado / Crítico / Baixo).
- **Do** show a Kbd legend only where the shortcut works.
- **Do** keep locked actions visible as dashed keys that explain on click.

### Don't:
- **Don't** color countdowns, active nav icons, locks or status icons yellow; they are Display Light or Display Dim.
- **Don't** tint text, signed quantities or table cells with entrada, saída or ajuste color; the sign carries the color, the text stays achromatic.
- **Don't** add a lip to non-pressable icon tiles (empty- and error-state tiles, boot step markers, role checks); they stay flat.
- **Don't** remove the Kbd or OpGlyph bottom border to satisfy the `border-accent-on-rounded` detector finding; it is the keycap lip, ruled in the finish review.
- **Don't** build the KPI-card SaaS admin: four rounded stat tiles, a gradient area chart, a zinc sidebar.
- **Don't** add a second type family; move along Archivo's width axis instead.
- **Don't** use radii outside 4 / 6 / 10 / 12px, and don't use pills.
- **Don't** use cast shadows on the work surface; only dialogs and menus lift.
