---
name: Movie Arena
description: A living-room channel guide and theater for streaming portals, with an ad shield in front of every site.
colors:
  canvas: "#09090b"
  bar: "#0e0e11"
  raised: "#16161a"
  raised-2: "#1d1d22"
  tile: "#121216"
  line: "rgb(255 255 255 / 0.08)"
  line-strong: "rgb(255 255 255 / 0.14)"
  fill-1: "rgb(255 255 255 / 0.06)"
  fill-2: "rgb(255 255 255 / 0.1)"
  fg: "#f5f5f7"
  fg-2: "rgb(235 235 245 / 0.64)"
  fg-3: "rgb(235 235 245 / 0.5)"
  on-white: "#0a0a0c"
  marquee-white: "#ffffff"
  marquee-white-hover: "#e8e8ed"
  shield: "#34d399"
  heart: "#ff375f"
  danger: "#ff6b6b"
typography:
  display:
    fontFamily: "Mona Sans Variable, Segoe UI Variable Display, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(44px, 5.2vw, 72px)"
    fontWeight: 620
    lineHeight: 0.95
    letterSpacing: "-0.02em"
    fontVariation: "wdth 78..122, wght 620..860, picked per channel"
  headline:
    fontFamily: "Mona Sans Variable, Segoe UI Variable Display, Segoe UI, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 760
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontVariation: "wdth 108"
  title:
    fontFamily: "Segoe UI Variable Text, Segoe UI Variable, Segoe UI, system-ui, -apple-system, SF Pro Text, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI Variable, Segoe UI, system-ui, -apple-system, SF Pro Text, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Segoe UI Variable Text, Segoe UI Variable, Segoe UI, system-ui, -apple-system, SF Pro Text, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.45
  caption:
    fontFamily: "Segoe UI Variable Text, Segoe UI Variable, Segoe UI, system-ui, -apple-system, SF Pro Text, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
rounded:
  xs: "6px"
  sm: "8px"
  track: "10px"
  md: "12px"
  lg: "18px"
  full: "999px"
spacing:
  gutter: "clamp(24px, 3.2vw, 48px)"
  bar: "56px"
  player-bar: "48px"
  control-gap: "8px"
  row-gap: "18px"
  row-stack: "30px"
components:
  capsule-solid:
    backgroundColor: "{colors.marquee-white}"
    textColor: "{colors.on-white}"
    rounded: "{rounded.full}"
    padding: "0 22px"
    height: "40px"
  capsule-solid-hover:
    backgroundColor: "{colors.marquee-white-hover}"
  capsule-frost:
    backgroundColor: "rgb(255 255 255 / 0.12)"
    textColor: "{colors.marquee-white}"
    rounded: "{rounded.full}"
    padding: "0 22px"
    height: "40px"
  button-primary:
    backgroundColor: "{colors.marquee-white}"
    textColor: "{colors.on-white}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.marquee-white-hover}"
  button-ghost:
    backgroundColor: "{colors.fill-1}"
    textColor: "{colors.fg}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.fill-2}"
  button-icon:
    textColor: "{colors.fg-2}"
    rounded: "{rounded.full}"
    size: "28px"
  tab:
    textColor: "{colors.fg-2}"
    rounded: "7px"
    padding: "0 13px"
    height: "30px"
  tab-selected:
    backgroundColor: "{colors.marquee-white}"
    textColor: "{colors.on-white}"
  filter-chip:
    backgroundColor: "{colors.fill-1}"
    textColor: "{colors.fg-2}"
    rounded: "{rounded.full}"
    padding: "0 13px"
    height: "30px"
  filter-chip-pressed:
    backgroundColor: "{colors.marquee-white}"
    textColor: "{colors.on-white}"
  input:
    backgroundColor: "{colors.fill-1}"
    textColor: "{colors.fg}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "36px"
  channel-tile:
    backgroundColor: "{colors.tile}"
    rounded: "{rounded.md}"
    width: "248px"
  dialog:
    backgroundColor: "{colors.raised}"
    rounded: "14px"
    width: "520px"
  panel:
    backgroundColor: "{colors.raised-2}"
    rounded: "{rounded.track}"
---

# Design System: Movie Arena

## Overview

**Creative North Star: "The Night Channel Guide"**

Movie Arena reads like a living-room TV guide seen in a dark room. A near-black canvas holds rows of lit channel tiles. Each streaming site is a channel with its own light and its own lettering, so the catalog looks like a lineup rather than a list of bookmarks. Controls stay quiet and native to Windows so the channels carry the color.

Density is medium. Rows scroll sideways, the billboard gives one pick the full width, and the player strips the chrome down to one slim bar so the video owns the window. Color lives almost entirely inside tiles. Everything outside a tile is neutral, white, or one of three functional signals.

The world rejects the generic bookmark grid of favicons and raw URLs. A site is never shown as a favicon plus a link; it gets a lit tile and a wordmark.

**Key Characteristics:**
- Night canvas (#09090b) with translucent white fills and hairlines for every surface step
- White is the only action color; primaries are solid white with near-black text
- Per-channel light pools built from each site's own accent pair
- Mona Sans wordmarks whose width, weight and case vary per channel, Segoe UI Variable for every control
- tvOS-style tile focus: tilt toward the pointer, sheen, lift shadow
- Frosted glass only where controls float over lit art

## Colors

A monochrome night palette with white as the voice and color borrowed from each channel.

### Primary
- **Marquee White** (marquee-white): every primary action. Stream now, Add link, Skip ad, the selected tab, a pressed filter, an on switch. Text on it is On-White Ink.
- **Pressed Marquee** (marquee-white-hover): hover state of solid white controls.
- **On-White Ink** (on-white): text and glyphs that sit on white.

### Channel light (per site, not tokens)
Each site carries an `accent` and `secondary` hex in its catalog entry, exposed to CSS as `--a` and `--b`. They paint two radial light pools over the tile base: `--a` from the top left at 46%, `--b` from the bottom right at 36%, mixed in oklab, with a darkening wash and a 7% grain overlay. The billboard uses the same pair at 58% and 48%. Custom links get a pair derived from a hash of their name. These colors appear inside tiles, the billboard, the player's source mark and the stage placeholder, nowhere else.

### Neutral
- **Night Canvas** (canvas): app background.
- **Bar Black** (bar): top bar, player bar, dialog footers.
- **Tile Base** (tile): the dark floor under every channel's light.
- **Raised** (raised): dialog surface.
- **Raised Two** (raised-2): grouped panels inside dialogs, toasts.
- **Hairline** (line) and **Strong Hairline** (line-strong): 1px inset rings and dividers. Inputs, dialogs and the toast use the strong ring.
- **Fill One / Fill Two** (fill-1, fill-2): resting and hover backgrounds for ghost, pill, filter and icon controls.
- **Paper White** (fg): primary text.
- **Dim Text** (fg-2): secondary text, idle tabs and filters, setting descriptions.
- **Faint Text** (fg-3): captions, hosts, placeholders, counts.

### Signals
- **Shield Green** (shield): the ad shield only. Shield icon, the blocked count's bump, "Ad-Shield on", the shield dialog badge.
- **Heart Red** (heart): favorites only. Filled heart on tiles, the player bar and the frost capsule.
- **Danger Coral** (danger): destructive actions and invalid fields.

### Named Rules
**The White Voice Rule.** The only action color is white. A primary control is solid white with On-White Ink; nothing else gets a brand fill.

**The Borrowed Light Rule.** Saturated color belongs to channels. It comes from the site's own accent pair and stays inside its tile, billboard or source mark. App chrome never uses a channel's color.

**The One Signal Rule.** Green means the shield, red means a favorite, coral means destroy. Never reuse a signal color for decoration or for a different meaning.

## Typography

**Display Font:** Mona Sans Variable (with Segoe UI Variable Display, system-ui)
**Body Font:** Segoe UI Variable Text (with Segoe UI, system-ui, SF Pro Text)

**Character:** Mona Sans is the channel voice, stretched and weighted differently for each site so every wordmark looks like its own logo. Segoe UI Variable runs every control so the app feels like Windows, not a web page.

### Hierarchy
- **Display** (Mona Sans, weight 620 to 860 and width 78% to 122% per channel, clamp(44px, 5.2vw, 72px), line-height 0.95): the billboard title. The same wordmark appears at clamp(120px, 17vw, 260px) and 10% white as the drifting giant behind the billboard.
- **Wordmark in tile** (Mona Sans, per-channel axes, sized in container-query units to fill about 72% of the tile, capped at 20cqi): the channel's name inside every tile and source mark.
- **Headline** (Mona Sans, 760, width 108%, 34px, line-height 1.05, -0.02em): page titles such as search results and My Links.
- **Title** (Segoe UI, 600, 18px, -0.005em): row titles and dialog titles.
- **Body** (Segoe UI, 400, 14px, line-height 1.45): default text. Billboard summary runs 14.5px at line-height 1.5, capped at 52ch; page subtitles cap at 60ch; empty-state copy caps at 44ch.
- **Label** (Segoe UI, 500 or 600, 13px): buttons, tabs, captions' names (13.5px, 600), player bar text.
- **Caption** (Segoe UI, 400 to 600, 12px): tile summaries, hosts, hints, group labels, counts. Counts use tabular numerals.

### Named Rules
**The Channel Lettering Rule.** A site's wordmark is derived from a hash of its name: width from {78, 88, 100, 112, 122}%, weight from {620, 700, 780, 860}, case as-is, upper or lower. The same name renders the same everywhere. Never set a channel name in Mona Sans by hand with fixed axes; route it through the wordmark.

**The System Controls Rule.** Every control, label and paragraph uses the Segoe UI Variable stack. Mona Sans is reserved for channel wordmarks, page titles and the app name.

**The Tabular Count Rule.** Ratings, blocked counts, row counts and tallies use tabular numerals so live numbers do not jitter.

## Layout

The app is a two-row grid: a 56px top bar and a scrolling body. The player replaces the whole window with a 48px bar over a black stage, and collapses the bar to zero in immersive mode.

Horizontal edges come from one fluid gutter, clamp(24px, 3.2vw, 48px), applied to the top bar, billboard, filters, row headers and grids. Everything aligns to it.

Home is a vertical stack: billboard (clamp(300px, 40vh, 400px) tall, 24px from the bar), a filter strip, then category rows 30px apart. Each row is a sideways track of 248px tiles with 18px gaps, x-axis scroll snap at proximity, and hidden scrollbars. Paddles fade in on row hover. Full category and search pages switch to an auto-fill grid of tiles at least 232px wide with 28px row and 20px column gaps.

The billboard places copy bottom-left, 40px in and 36px up, stopping at 60% of the width, with a left and bottom scrim so it always reads. Carousel arrows sit top-right and progress dots bottom-right.

The window is desktop-only, so breakpoints shed chrome rather than reflowing. Below 1440px the app name text hides; below 1240px the search shortcut hint and top bar button labels hide and buttons tighten to 10px padding; below 1080px tabs tighten too. Below 1100px the player bar drops its labels and shortens the host.

Common gaps are 6px between chips and pills, 8px between bar controls, 10px inside captions and row heads, 14px in the billboard copy stack, 22px between dialog groups.

## Elevation & Depth

Depth is a hybrid. Surfaces step up by tone (canvas, bar, tile, raised, raised-2) and every edge is a 1px inset white ring rather than a border. Shadows are soft, black and ambient, used on things that float: tiles, the billboard, dialogs and the toast. Glass blur appears only where a control sits on lit art or over the app behind a dialog.

### Shadow Vocabulary
- **Tile rest** (`box-shadow: 0 2px 6px rgb(0 0 0 / 0.35), 0 8px 24px rgb(0 0 0 / 0.25)`): channel tiles at rest.
- **Tile lift** (`box-shadow: 0 18px 40px rgb(0 0 0 / 0.55), 0 6px 14px rgb(0 0 0 / 0.4)`): a tile under hover or focus, paired with a 22% white inset ring.
- **Pop** (`box-shadow: 0 24px 64px rgb(0 0 0 / 0.6), 0 4px 16px rgb(0 0 0 / 0.4)`): billboard, dialogs, toast.

### Named Rules
**The Hairline Edge Rule.** Edges are `inset 0 0 0 1px` white at 8% or 14%, never a solid gray border. Dividers inside panels are a 1px inset line on the top or left.

**The Lit From Inside Rule.** Tiles glow from their own light pools and lift on focus. Depth comes from light and soft black shadow, never from a hard offset shadow.

**The Glass Over Light Rule.** Backdrop blur (12px to 16px, saturate 1.4) is for chips, rating badges, favorite buttons, carousel arrows, row paddles and the frost capsule, all of which float over lit art. Flat chrome on the canvas stays opaque.

## Shapes

Corners are soft and consistent. Small controls (inputs, primary and ghost buttons, search, pill buttons) use 8px. Channel tiles use 12px, the billboard 18px, dialogs 14px. Segmented tracks (category tabs, the dialog segmented control) and dialog panels use a 10px outer track with 7px inner segments, so the inner radius nests inside the outer one.

Anything round on the canvas or over art is a full capsule (999px): the Stream now capsule, filters, chips, favorite and icon buttons, the back button, the skip button, switches, carousel dots. Feature tags on tiles and the My Link badge use a tighter 5px.

Tiles are always 16:9. The source mark in the player bar is a tiny 44 by 26 tile with a 6px corner.

## Components

### Buttons
Quiet, native and tactile. White is reserved for the one action that matters on each surface.
- **Shape:** gently rounded rectangles (8px) in chrome; full capsules on the billboard and the player bar.
- **Primary:** solid white with On-White Ink, 32px tall, 14px side padding, 13px at weight 600. Hover shifts to #e8e8ed; press scales to 0.97.
- **Capsule:** the billboard's Stream now. 40px tall, 22px padding, 14px at 600, full radius. The frost variant beside it is white at 12% with a 16px blur and a 16% ring; hover raises it to 20%.
- **Ghost:** Fill One with a hairline ring, Paper White text at 500. Hover moves to Fill Two. The danger variant uses coral text and, once armed for confirmation, turns solid coral with dark text.
- **Pill:** the Ad-Shield button. Ghost styling with a green shield icon and a tabular count that bumps to green and scales 1.35 when something is blocked.
- **Icon:** 28px circle, Dim Text, Fill Two on hover. Disabled drops to 32% opacity.
- **Focus:** a 2px solid white outline at 2px offset on every focusable element.

### Chips
- **Rating chip:** 20px capsule, white text at 11px and 600, dark glass (rgb(10 10 12 / 0.45), 12px blur), tabular numerals.
- **Feature tag:** same glass at 19px tall with a 5px corner and 10.5px text.
- **My Link badge:** solid white with On-White Ink, 5px corner, pushed to the right of the tile's bottom edge. Marks a user's own link.
- **Filter chip:** 30px capsule, Fill One with a hairline, Dim Text. Pressed turns solid white with On-White Ink and drops the ring.

### Cards / Containers
- **Corner Style:** 12px on tiles, 14px on dialogs, 10px on panels.
- **Background:** tiles use Tile Base under channel light; dialogs use Raised; panels use Raised Two; dialog footers use Bar Black.
- **Shadow Strategy:** tiles use Tile rest and Tile lift; dialogs and toast use Pop.
- **Border:** hairline inset ring only.
- **Internal Padding:** dialog head 20px 20px 16px 24px, body 4px 24px 22px, foot 14px 20px. Setting rows 14px 16px.

### Inputs / Fields
- **Style:** 36px tall, Fill One with a strong hairline, 8px corner, 12px side padding, 14px text. Faint placeholder. Hover lifts the fill to 8% white.
- **Focus:** the fill drops to 4% and a 2px white underline appears inside the bottom edge, in the Fluent manner. The top bar search uses the same underline.
- **Error:** the ring turns coral and a coral hint appears below.
- **Labels:** 12.5px at 600 in Dim Text, 6px above the field.

### Switches
Fluent-style. 40 by 20 track with a 55% white outline and a 12px knob. On, the track goes solid white and the knob turns On-White Ink and slides 20px. Pressing stretches the knob to 15px.

### Navigation
- **Top bar:** Bar Black, 56px, with the app icon and name at left, the category tabs centered, and search, Ad-Shield and Add link at right. It doubles as the window drag region.
- **Tabs:** a segmented track at 4% white with a hairline, 3px inset. Idle tabs are Dim Text at 13px and 500; hover adds Fill One; the selected tab is solid white with On-White Ink at 600.
- **Player bar:** Bar Black, 48px. A capsule back button, history icons, the source switcher (mini tile plus name and host), a growing spacer, the white Skip ad capsule, the shield pill, favorite and window controls. Thin 18px separators group them. Loading shows a 2px white sweep along the bottom edge.

### Channel tile (signature)
The unit of the whole system. A 16:9 tile with a 12px corner, the channel's light pools and grain, its wordmark centered, a rating chip and favorite button on top, and up to two feature tags on the bottom. On hover or focus it scales to 1.045, tilts up to about 3.5 degrees toward the pointer in perspective, shows a sheen that follows the pointer, and takes the lift shadow. Keyboard focus adds a 3px white ring. The favorite button fades in on hover and stays visible once on, filled in Heart Red, with a 1.35 pop when added. Below the tile sits a caption: name at 13.5px and 600, summary in Faint Text, both truncated to one line.

### Billboard (signature)
A full-gutter-width hero of one top pick. The channel's light at higher strength, a giant 10% white wordmark drifting 3% over 18 seconds, a scrim, the display wordmark title, meta line, summary, feature tags and the two capsules. Progress dots double as the timer: the active dot widens to 28px and fills white over 8 seconds, pausing on hover or focus.

### Motion
Everything eases out on cubic-bezier(0.16, 1, 0.3, 1). Control state changes take 140ms to 180ms, tile transforms 420ms, entrances 200ms to 360ms (dialogs rise 12px and scale from 0.98, the toast rises 12px). Reduced motion cuts all animation and transition to 1ms and disables tile tilt.

## Do's and Don'ts

### Do:
- **Do** give every site a lit tile and a hashed Mona Sans wordmark, including user-added links.
- **Do** make the one primary action on a surface solid white (#ffffff) with On-White Ink (#0a0a0c).
- **Do** draw edges as 1px inset white rings at 8% or 14%.
- **Do** align every horizontal edge to the gutter, clamp(24px, 3.2vw, 48px).
- **Do** use Segoe UI Variable for every control and Mona Sans only for wordmarks, page titles and the app name.
- **Do** use tabular numerals for any number that updates live.
- **Do** keep blur for controls that float over lit art.
- **Do** honor reduced motion by removing tilt and animation.

### Don't:
- **Don't** show a site as a favicon plus a URL in a bookmark grid.
- **Don't** use a channel's accent color in app chrome, buttons or text.
- **Don't** use Shield Green, Heart Red or Danger Coral for anything other than the shield, favorites and destructive actions.
- **Don't** introduce a colored primary button; white is the action color.
- **Don't** use solid gray borders or hard offset shadows.
- **Don't** set a channel name in Mona Sans with fixed axes outside the wordmark logic.
