# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Desktop app built with Tauri 2. The interface is a web surface inside a native window. Windows 10/11 (WebView2) is the target; macOS builds work for development.

## Stack

Tauri 2 (Rust) + React 19 + TypeScript + Vite. Chosen to port the existing SwiftUI app `../moviearena` (inferred: the user asked for "Tauri" and left the rest open).

## Users

People who watch movies, TV and anime on free streaming sites (the FMHY list) and want one place to launch them without fighting popups and video ads. They sit at a desktop or laptop, often in the evening, often in a dim room. Inferred from the Swift app; not confirmed in an interview.

## Product Purpose

Movie Arena is a launcher and theater for streaming portals. It keeps a curated catalog of sites, lets the user add their own links, and opens any site inside the app with an ad shield in front of it. Success means picking a source and getting to a playing video with fewer clicks and no popunders.

## Positioning

A browser tab gives you the raw site. Movie Arena puts a curated catalog, per-site favorites and history, source switching, and an ad shield that runs in every frame of the player into one window.

## Operating Context

- Browse: home rows by category, hero carousel of top picks, feature filters, search.
- Watch: the site opens in a native child webview under a slim toolbar (back, forward, reload, switch source, skip ad, shield stats, favorite, open in browser, fullscreen, close).
- Manage: add, edit and delete custom links; toggle shield features; reset stats; restore the default catalog.

## Capabilities and Constraints

- The catalog and its copy come from the Swift app (`StreamingSite.swift`, `SiteStore.swift`). Ratings and summaries are the original author's descriptions, not measured data.
- Shield features: fast-skip video ads, popup and redirect shield, content rules (network blocking on Windows via WebView2, cosmetic hiding everywhere).
- Remote sites get no IPC access. All communication with the player goes through injected scripts and native callbacks.
- Native child webviews draw above the HTML interface, so anything that overlaps the player (menus, dialogs) must be a native menu or hide the player while open.

## Brand Commitments

- Name: Movie Arena.
- App icon: brushed-steel clapperboard on black (`src-tauri/icons/icon.png`). Monochrome identity.
- The Swift app's look is a dark, Apple TV-like canvas with white primary buttons. The port keeps that world. The user asked to "port" the app, so this visual direction is pinned and no new concept was rolled.

## Evidence on Hand

- Default catalog of 22 sites with names, URLs, categories, features, summaries, ratings and accent colors.
- No screenshots, testimonials or usage numbers. Do not invent any.

## Product Principles

1. Getting to a playing video beats everything else on screen.
2. The shield earns trust by showing what it blocked, never by claiming more than it does.
3. Feel native on Windows: system type for controls, native menus, keyboard support, no web-page chrome.
4. The user's own links are first-class, equal to the curated catalog.
