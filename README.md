# Movie Arena for Windows

Tauri port of the macOS SwiftUI app in `../moviearena`. It keeps the same catalog, favorites, history, custom links, theater player and Ad-Shield, and runs on Windows 10 and 11 through WebView2.

## Run it

```sh
npm install
npm run tauri dev        # development, works on macOS and Windows
npm run tauri build      # installers for the OS you build on
```

A Mac can't produce the Windows installer. Push a `v*` tag, or run the "Build Windows installer" workflow by hand in GitHub Actions. It uploads an NSIS `.exe` and an `.msi`. The installer bundles the WebView2 bootstrapper, so it also works on machines that don't have WebView2 yet.

## How it is put together

| Swift | Tauri |
|---|---|
| `ContentView`, `AppleTVComponents` | `src/App.tsx`, `src/components/*` (React) |
| `SiteStore` + UserDefaults | `src/lib/store.ts`, saved to `%APPDATA%\win.moviearena.app\sites.json` |
| `WKWebView` in `PlayerWebView` | a second native webview ("player") placed under the toolbar by `src-tauri/src/lib.rs` |
| `WKContentRuleList` | WebView2 `WebResourceRequested` filter in `src-tauri/src/webview2.rs` (Windows only) |
| `WKUserScript` shield scripts | `src-tauri/src/shield.rs`, injected into every frame |
| `WKUIDelegate` popup handling | `on_new_window` and `on_navigation` in `lib.rs` |

Sites you open never get access to Tauri's IPC. The app reads shield counters with `eval_with_callback` and sends commands with `eval`. The capability file grants permissions to the "ui" webview only.

Native webviews always draw above HTML. Because of that, the source switcher and the right-click menus are native menus, and the player hides while a dialog is open.

## Changes from the Swift app

- Auto-skip no longer presses every `[aria-label*="Skip"]` button. On most players that was "skip forward 10s", fired every 500ms. It now presses skip buttons only inside ad containers or ones labelled "skip ad".
- Overlay removal skips elements that contain the player iframe.
- Popup filtering matches whole host labels (`pop.`, `ads-`, `bet.`). The old `host.contains("ad")` check also matched normal hosts.
- New windows that don't look like ads are held instead of opened. The toolbar offers "Open here".
- The feature filter on Home now filters the rows. In the Swift app it changed nothing there.
- Back and forward follow WebView2's real history state, and HTML5 fullscreen on a video makes the window fullscreen.
- Deleting a link can be undone, and restoring the default catalog keeps your own links.

## Design

The look carries over from the Swift app: a dark canvas, white capsule buttons and frosted chips. Each site gets a "channel tile", lit with that site's two accent colors (they were already in the Swift data but never shown) and labelled with a Mona Sans wordmark. The width, weight and case come from a hash of the name, so a site keeps the same mark everywhere. Controls use Segoe UI Variable on Windows.
