//! Windows-only WebView2 hooks for the player webview.
//!
//! - Network blocking of ad and tracker hosts through `WebResourceRequested`
//!   (the WebView2 counterpart of the WKContentRuleList in the Swift app).
//! - Accurate back/forward state through `HistoryChanged`.
//! - HTML5 fullscreen (video players) through `ContainsFullScreenElementChanged`.

use crate::{shield, AppState, UI};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, Manager, Webview};
use webview2_com::Microsoft::Web::WebView2::Win32::*;
use webview2_com::{
    take_pwstr, ContainsFullScreenElementChangedEventHandler, HistoryChangedEventHandler,
    WebResourceRequestedEventHandler,
};
use windows::core::{Interface, HSTRING, PWSTR};

pub fn install(webview: &Webview, app: AppHandle) {
    let _ = webview.with_webview(move |platform| unsafe {
        let controller = platform.controller();
        let env = platform.environment();
        let Ok(core) = controller.CoreWebView2() else { return };
        if let Err(e) = install_request_filter(&core, env, app.clone()) {
            eprintln!("[shield] request filter unavailable: {e:?}");
        }
        install_history(&core, app.clone());
        install_fullscreen(&core, app);
    });
}

unsafe fn install_request_filter(
    core: &ICoreWebView2,
    env: ICoreWebView2Environment,
    app: AppHandle,
) -> windows::core::Result<()> {
    let filter = HSTRING::from("*");
    match core.cast::<ICoreWebView2_22>() {
        Ok(core22) => core22.AddWebResourceRequestedFilterWithRequestSourceKinds(
            &filter,
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
            COREWEBVIEW2_WEB_RESOURCE_REQUEST_SOURCE_KINDS_ALL,
        )?,
        Err(_) => core.AddWebResourceRequestedFilter(&filter, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL)?,
    }

    let mut token = Default::default();
    core.add_WebResourceRequested(
        &WebResourceRequestedEventHandler::create(Box::new(move |sender, args| {
            let Some(args) = args else { return Ok(()) };
            let state = app.state::<AppState>();
            if !state.settings().content_rules {
                return Ok(());
            }
            let request = args.Request()?;
            let mut raw = PWSTR::null();
            request.Uri(&mut raw)?;
            let uri = take_pwstr(raw);
            let Ok(parsed) = url::Url::parse(&uri) else { return Ok(()) };
            let Some(host) = parsed.host_str() else { return Ok(()) };
            if !shield::is_blocked_host(host) {
                return Ok(());
            }
            // Never block the site the user chose to open.
            if let Some(sender) = sender {
                let mut src = PWSTR::null();
                if sender.Source(&mut src).is_ok() {
                    let top = take_pwstr(src);
                    if let Some(top_host) = url::Url::parse(&top).ok().and_then(|u| u.host_str().map(str::to_owned)) {
                        if shield::site_key(&top_host) == shield::site_key(host) {
                            return Ok(());
                        }
                    }
                }
            }
            let response = env.CreateWebResourceResponse(
                None,
                403,
                &HSTRING::from("Blocked by Ad-Shield"),
                &HSTRING::from(""),
            )?;
            args.SetResponse(&response)?;
            state.stats.requests.fetch_add(1, Ordering::Relaxed);
            Ok(())
        })),
        &mut token,
    )?;
    Ok(())
}

unsafe fn install_history(core: &ICoreWebView2, app: AppHandle) {
    let mut token = Default::default();
    let _ = core.add_HistoryChanged(
        &HistoryChangedEventHandler::create(Box::new(move |sender, _| {
            let Some(sender) = sender else { return Ok(()) };
            let mut back = windows::core::BOOL::default();
            let mut forward = windows::core::BOOL::default();
            sender.CanGoBack(&mut back)?;
            sender.CanGoForward(&mut forward)?;
            let _ = app.emit_to(
                UI,
                "player:history",
                serde_json::json!({ "canGoBack": back.as_bool(), "canGoForward": forward.as_bool() }),
            );
            Ok(())
        })),
        &mut token,
    );
}

unsafe fn install_fullscreen(core: &ICoreWebView2, app: AppHandle) {
    let mut token = Default::default();
    let _ = core.add_ContainsFullScreenElementChanged(
        &ContainsFullScreenElementChangedEventHandler::create(Box::new(move |sender, _| {
            let Some(sender) = sender else { return Ok(()) };
            let mut active = windows::core::BOOL::default();
            sender.ContainsFullScreenElement(&mut active)?;
            let active = active.as_bool();
            if let Some(window) = app.get_window("main") {
                let _ = window.set_fullscreen(active);
            }
            let _ = app.emit_to(UI, "player:fullscreen", serde_json::json!({ "active": active }));
            Ok(())
        })),
        &mut token,
    );
}

/// Paint the native caption and border in the app bar color (Windows 11),
/// so the title bar and the top bar read as one surface. Older Windows
/// versions ignore the attributes and keep the dark theme title bar.
pub fn tint_caption(window: &tauri::Window) {
    use windows::Win32::Foundation::{COLORREF, HWND};
    use windows::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_CAPTION_COLOR, DWMWA_TEXT_COLOR,
    };
    let Ok(hwnd) = window.hwnd() else { return };
    let hwnd = HWND(hwnd.0 as _);
    // COLORREF is 0x00BBGGRR. #0E0E11 for the bar, #F5F5F7 for the title text.
    let caption = COLORREF(0x0011_0E0E);
    let text = COLORREF(0x00F7_F5F5);
    let size = std::mem::size_of::<COLORREF>() as u32;
    unsafe {
        let _ = DwmSetWindowAttribute(hwnd, DWMWA_CAPTION_COLOR, &caption as *const _ as _, size);
        let _ = DwmSetWindowAttribute(hwnd, DWMWA_BORDER_COLOR, &caption as *const _ as _, size);
        let _ = DwmSetWindowAttribute(hwnd, DWMWA_TEXT_COLOR, &text as *const _ as _, size);
    }
}
