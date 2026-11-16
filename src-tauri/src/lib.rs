//! Movie Arena desktop shell.
//!
//! Window layout: one native window ("main") hosting two webviews.
//! - "ui": the React app, auto-resized to fill the window.
//! - "player": created on demand for the chosen streaming site, positioned by
//!   the UI under its toolbar. Remote content gets no IPC access; the shield
//!   talks to it only through injected scripts and `eval_with_callback`.

mod shield;
#[cfg(windows)]
mod webview2;

use serde::{Deserialize, Serialize};
use shield::{ShieldSettings, ShieldStats, StatsSnapshot};
use std::collections::hash_map::RandomState;
use std::hash::{BuildHasher, Hasher};
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, State, Webview, WebviewBuilder,
    WebviewUrl, WindowBuilder,
};

pub const UI: &str = "ui";
pub const PLAYER: &str = "player";

#[cfg(target_os = "macos")]
const PLAYER_USER_AGENT: Option<&str> = Some(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
);
#[cfg(not(target_os = "macos"))]
const PLAYER_USER_AGENT: Option<&str> = None; // WebView2 already reports as Edge.

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Default)]
struct PlayerState {
    bounds: Option<Bounds>,
    hidden: bool,
    current_host: Option<String>,
}

pub struct AppState {
    settings: Mutex<ShieldSettings>,
    pub stats: Arc<ShieldStats>,
    player: Mutex<PlayerState>,
    token: String,
    data_dir: PathBuf,
    /// Serialises player creation so double-clicks cannot build two webviews.
    build_lock: tokio_like::AsyncLock,
}

impl AppState {
    pub fn settings(&self) -> ShieldSettings {
        *self.settings.lock().unwrap()
    }
}

/// A tiny async-friendly lock built on std, so we avoid a tokio dependency.
mod tokio_like {
    use std::sync::{Condvar, Mutex};
    #[derive(Default)]
    pub struct AsyncLock {
        busy: Mutex<bool>,
        cv: Condvar,
    }
    pub struct Guard<'a>(&'a AsyncLock);
    impl AsyncLock {
        pub fn lock(&self) -> Guard<'_> {
            let mut busy = self.busy.lock().unwrap();
            while *busy {
                busy = self.cv.wait(busy).unwrap();
            }
            *busy = true;
            Guard(self)
        }
    }
    impl Drop for Guard<'_> {
        fn drop(&mut self) {
            *self.0.busy.lock().unwrap() = false;
            self.0.cv.notify_one();
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ShieldState {
    settings: ShieldSettings,
    stats: StatsSnapshot,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BlockedPayload {
    kind: &'static str,
    url: String,
    host: String,
}

fn random_token() -> String {
    let mut h = RandomState::new().build_hasher();
    h.write_u128(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0),
    );
    format!("__ma{:x}", h.finish())
}

fn parse_web_url(raw: &str) -> Result<url::Url, String> {
    let url = url::Url::parse(raw.trim()).map_err(|e| format!("Invalid address: {e}"))?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        other => Err(format!("Unsupported address scheme \"{other}\"")),
    }
}

fn host_of(url: &url::Url) -> String {
    url.host_str().unwrap_or_default().to_ascii_lowercase()
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

fn write_atomic(path: &PathBuf, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}

#[tauri::command]
fn sites_load(state: State<'_, AppState>) -> Option<serde_json::Value> {
    let bytes = std::fs::read(state.data_dir.join("sites.json")).ok()?;
    serde_json::from_slice(&bytes).ok()
}

#[tauri::command]
fn sites_save(state: State<'_, AppState>, sites: serde_json::Value) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(&sites).map_err(|e| e.to_string())?;
    write_atomic(&state.data_dir.join("sites.json"), &bytes)
}

fn load_settings(dir: &PathBuf) -> ShieldSettings {
    std::fs::read(dir.join("shield.json"))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

// ---------------------------------------------------------------------------
// Player webview
// ---------------------------------------------------------------------------

fn player(app: &AppHandle) -> Option<Webview> {
    app.get_webview(PLAYER)
}

fn build_player(app: &AppHandle, url: url::Url, bounds: Bounds) -> Result<Webview, String> {
    let state = app.state::<AppState>();
    let settings = state.settings();
    let window = app.get_window("main").ok_or("Main window is missing")?;

    let nav_app = app.clone();
    let popup_app = app.clone();
    let load_app = app.clone();
    let title_app = app.clone();

    let mut builder = WebviewBuilder::new(PLAYER, WebviewUrl::External(url.clone()))
        .initialization_script_for_all_frames(shield::frame_script(settings, &state.token))
        .background_color(tauri::window::Color(0, 0, 0, 255))
        .on_navigation(move |target| {
            let state = nav_app.state::<AppState>();
            if !matches!(target.scheme(), "http" | "https") {
                return true;
            }
            let host = host_of(target);
            let current = state.player.lock().unwrap().current_host.clone();
            let same_site = current
                .as_deref()
                .map(|c| shield::site_key(c) == shield::site_key(&host))
                .unwrap_or(true);
            if state.settings().popup_shield && !same_site && shield::is_ad_like_host(&host) {
                state.stats.popups.fetch_add(1, Ordering::Relaxed);
                let _ = nav_app.emit_to(
                    UI,
                    "player:blocked",
                    BlockedPayload { kind: "redirect", url: target.to_string(), host },
                );
                return false;
            }
            true
        })
        .on_new_window(move |target, _features| {
            let state = popup_app.state::<AppState>();
            if !state.settings().popup_shield {
                return NewWindowResponse::Allow;
            }
            let host = host_of(&target);
            let ad = shield::is_ad_like_host(&host);
            if ad {
                state.stats.popups.fetch_add(1, Ordering::Relaxed);
            }
            // Non-ad popups are held back too; the UI offers to open them.
            let _ = popup_app.emit_to(
                UI,
                "player:blocked",
                BlockedPayload { kind: if ad { "popup" } else { "window" }, url: target.to_string(), host },
            );
            NewWindowResponse::Deny
        })
        .on_page_load(move |_wv, payload| {
            let url = payload.url();
            let loading = matches!(payload.event(), PageLoadEvent::Started);
            if !loading {
                let state = load_app.state::<AppState>();
                state.player.lock().unwrap().current_host = Some(host_of(url));
            }
            let _ = load_app.emit_to(
                UI,
                "player:load",
                serde_json::json!({ "loading": loading, "url": url.as_str() }),
            );
        })
        .on_document_title_changed(move |_wv, title| {
            let _ = title_app.emit_to(UI, "player:title", serde_json::json!({ "title": title }));
        });

    if let Some(ua) = PLAYER_USER_AGENT {
        builder = builder.user_agent(ua);
    }

    {
        let mut p = state.player.lock().unwrap();
        p.bounds = Some(bounds);
        p.current_host = Some(host_of(&url));
    }

    let webview = window
        .add_child(
            builder,
            LogicalPosition::new(bounds.x, bounds.y),
            LogicalSize::new(bounds.width.max(1.0), bounds.height.max(1.0)),
        )
        .map_err(|e| e.to_string())?;

    #[cfg(windows)]
    webview2::install(&webview, app.clone());

    if state.player.lock().unwrap().hidden {
        let _ = webview.hide();
    }
    Ok(webview)
}

#[tauri::command]
async fn player_open(app: AppHandle, url: String, bounds: Bounds) -> Result<(), String> {
    let url = parse_web_url(&url)?;
    let state = app.state::<AppState>();
    let _guard = state.build_lock.lock();
    state.player.lock().unwrap().hidden = false;
    if let Some(existing) = player(&app) {
        state.player.lock().unwrap().current_host = Some(host_of(&url));
        let _ = existing.show();
        existing.navigate(url).map_err(|e| e.to_string())?;
        apply_bounds(&existing, bounds)?;
        return Ok(());
    }
    build_player(&app, url, bounds)?;
    Ok(())
}

fn apply_bounds(webview: &Webview, bounds: Bounds) -> Result<(), String> {
    webview
        .set_bounds(tauri::Rect {
            position: LogicalPosition::new(bounds.x, bounds.y).into(),
            size: LogicalSize::new(bounds.width.max(1.0), bounds.height.max(1.0)).into(),
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn player_bounds(app: AppHandle, state: State<'_, AppState>, bounds: Bounds) -> Result<(), String> {
    state.player.lock().unwrap().bounds = Some(bounds);
    match player(&app) {
        Some(wv) => apply_bounds(&wv, bounds),
        None => Ok(()),
    }
}

#[tauri::command]
fn player_visible(app: AppHandle, state: State<'_, AppState>, visible: bool) -> Result<(), String> {
    state.player.lock().unwrap().hidden = !visible;
    if let Some(wv) = player(&app) {
        let r = if visible { wv.show() } else { wv.hide() };
        r.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn player_command(app: AppHandle, state: State<'_, AppState>, action: String) -> Result<(), String> {
    let Some(wv) = player(&app) else { return Ok(()) };
    let r = match action.as_str() {
        "back" => wv.eval("history.back()"),
        "forward" => wv.eval("history.forward()"),
        "reload" => wv.reload(),
        "stop" => wv.eval("window.stop()"),
        "skip" => wv.eval(shield::skip_statement(&state.token)),
        "focus" => wv.set_focus(),
        other => return Err(format!("Unknown player action \"{other}\"")),
    };
    r.map_err(|e| e.to_string())
}

#[tauri::command]
fn player_navigate(app: AppHandle, url: String) -> Result<(), String> {
    let url = parse_web_url(&url)?;
    if let Some(wv) = player(&app) {
        wv.navigate(url).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn player_close(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let _guard = state.build_lock.lock();
    if let Some(wv) = player(&app) {
        wv.close().map_err(|e| e.to_string())?;
    }
    {
        let mut p = state.player.lock().unwrap();
        p.current_host = None;
        p.hidden = false;
    }
    if let Some(window) = app.get_window("main") {
        if window.is_fullscreen().unwrap_or(false) {
            let _ = window.set_fullscreen(false);
        }
    }
    Ok(())
}

#[tauri::command]
fn window_fullscreen(app: AppHandle, active: bool) -> Result<(), String> {
    let window = app.get_window("main").ok_or("Main window is missing")?;
    window.set_fullscreen(active).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Shield commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn shield_state(state: State<'_, AppState>) -> ShieldState {
    ShieldState { settings: state.settings(), stats: state.stats.snapshot() }
}

#[tauri::command]
async fn shield_update(app: AppHandle, settings: ShieldSettings) -> Result<(), String> {
    let state = app.state::<AppState>();
    let changed = {
        let mut s = state.settings.lock().unwrap();
        let changed = *s != settings;
        *s = settings;
        changed
    };
    let bytes = serde_json::to_vec_pretty(&settings).map_err(|e| e.to_string())?;
    write_atomic(&state.data_dir.join("shield.json"), &bytes)?;

    // Injected scripts are fixed at creation, so rebuild an open player.
    if changed {
        let _guard = state.build_lock.lock();
        if let Some(wv) = player(&app) {
            let url = wv.url().map_err(|e| e.to_string())?;
            let bounds = state.player.lock().unwrap().bounds;
            wv.close().map_err(|e| e.to_string())?;
            if let Some(bounds) = bounds {
                build_player(&app, url, bounds)?;
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn shield_reset_stats(app: AppHandle, state: State<'_, AppState>) {
    state.stats.reset();
    let _ = app.emit_to(UI, "shield:stats", state.stats.snapshot());
}

/// Collect counters from the player page once a second and push changes to the UI.
fn spawn_stats_pump(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last = StatsSnapshot::default();
        loop {
            std::thread::sleep(Duration::from_millis(1000));
            let state = app.state::<AppState>();
            if let Some(wv) = player(&app) {
                let stats = state.stats.clone();
                let _ = wv.eval_with_callback(shield::drain_expression(&state.token), move |json| {
                    #[derive(Deserialize)]
                    struct Drain {
                        popups: u64,
                        skipped: u64,
                        overlays: u64,
                    }
                    if let Ok(Some(d)) = serde_json::from_str::<Option<Drain>>(&json) {
                        stats.popups.fetch_add(d.popups, Ordering::Relaxed);
                        stats.skipped.fetch_add(d.skipped, Ordering::Relaxed);
                        stats.overlays.fetch_add(d.overlays, Ordering::Relaxed);
                    }
                });
            }
            let now = state.stats.snapshot();
            if now != last {
                last = now;
                let _ = app.emit_to(UI, "shield:stats", now);
            }
        }
    });
}

// ---------------------------------------------------------------------------
// App entry
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            app.manage(AppState {
                settings: Mutex::new(load_settings(&data_dir)),
                stats: Arc::new(ShieldStats::default()),
                player: Mutex::new(PlayerState::default()),
                token: random_token(),
                data_dir,
                build_lock: Default::default(),
            });

            let builder = WindowBuilder::new(app, "main").title("Movie Arena");
            // macOS: the content view spans the title bar, so let the UI draw
            // under a transparent one and lay out around the traffic lights.
            #[cfg(target_os = "macos")]
            let builder = builder
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true);
            let window = builder
                .inner_size(1280.0, 820.0)
                .min_inner_size(960.0, 640.0)
                .theme(Some(tauri::Theme::Dark))
                .background_color(tauri::window::Color(9, 9, 11, 255))
                .center()
                .build()?;

            #[cfg(windows)]
            webview2::tint_caption(&window);

            let size = window.inner_size()?.to_logical::<f64>(window.scale_factor()?);
            window.add_child(
                WebviewBuilder::new(UI, WebviewUrl::App("index.html".into()))
                    .background_color(tauri::window::Color(9, 9, 11, 255))
                    .auto_resize(),
                LogicalPosition::new(0.0, 0.0),
                LogicalSize::new(size.width, size.height),
            )?;

            spawn_stats_pump(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            sites_load,
            sites_save,
            player_open,
            player_bounds,
            player_visible,
            player_command,
            player_navigate,
            player_close,
            window_fullscreen,
            shield_state,
            shield_update,
            shield_reset_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Movie Arena");
}
