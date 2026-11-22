//! Ad-Shield: settings, session counters, host heuristics and the script
//! injected into every frame of the player webview.
//!
//! Port of `AdBlockerEngine.swift`. WebKit content rule lists have no
//! cross-platform equivalent, so request blocking lives in `webview2.rs`
//! (Windows) and the cosmetic + behavioural parts live in the injected script.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShieldSettings {
    /// Fast-skip video ads and press player skip buttons.
    pub auto_skip: bool,
    /// Block popups, popunders, ad redirects and click-trap overlays.
    pub popup_shield: bool,
    /// Network blocking of known ad and tracker hosts, plus cosmetic hiding.
    pub content_rules: bool,
}

impl Default for ShieldSettings {
    fn default() -> Self {
        Self { auto_skip: true, popup_shield: true, content_rules: true }
    }
}

#[derive(Default)]
pub struct ShieldStats {
    pub popups: AtomicU64,
    pub skipped: AtomicU64,
    pub overlays: AtomicU64,
    pub requests: AtomicU64,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct StatsSnapshot {
    pub popups: u64,
    pub skipped: u64,
    pub overlays: u64,
    pub requests: u64,
}

impl ShieldStats {
    pub fn snapshot(&self) -> StatsSnapshot {
        StatsSnapshot {
            popups: self.popups.load(Ordering::Relaxed),
            skipped: self.skipped.load(Ordering::Relaxed),
            overlays: self.overlays.load(Ordering::Relaxed),
            requests: self.requests.load(Ordering::Relaxed),
        }
    }

    pub fn reset(&self) {
        for c in [&self.popups, &self.skipped, &self.overlays, &self.requests] {
            c.store(0, Ordering::Relaxed);
        }
    }
}

/// Hosts blocked at the network layer. Substring match against the host,
/// carried over from the Swift content rule list.
const BLOCKED_HOST_PATTERNS: &[&str] = &[
    "doubleclick.net", "googlesyndication", "googleadservices", "adnxs", "popads", "popcash",
    "onclickads", "propellerads", "adsterra", "monetag", "exoclick", "trafficjunky",
    "juicyads", "adtrue", "tsyndicate", "adkeeper", "yadro", "bet365", "1xbet", "mostbet",
    "melbet", "vungle", "applovin", "adroll", "criteo", "taboola", "outbrain", "adserver",
    "adservice", "popunder", "hilltopads", "clickadu", "richpartners", "a-ads.com",
    "ad-maven", "admaven", "galaksion", "pushground", "mgid.com", "revcontent",
];

/// Label tokens that mark a popup or redirect target as an ad. The Swift app
/// used `host.contains("ad")`, which also matched hosts like "cloudflare-
/// download" or "reader"; matching whole labels avoids those false positives.
const AD_LABEL_TOKENS: &[&str] = &[
    "ad", "ads", "adserver", "adservice", "advert", "pop", "popup", "popunder", "track",
    "tracker", "tracking", "click", "clicks", "clk", "bet", "bets", "betting", "casino",
    "redirect", "offer", "offers", "promo",
];

pub fn is_blocked_host(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    BLOCKED_HOST_PATTERNS.iter().any(|p| host.contains(p))
}

pub fn is_ad_like_host(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    if is_blocked_host(&host) {
        return true;
    }
    host.split(|c| c == '.' || c == '-')
        .any(|label| AD_LABEL_TOKENS.contains(&label))
}

/// Registrable-ish domain: last two labels. Good enough to treat
/// `www.site.to` and `cdn.site.to` as the same site.
pub fn site_key(host: &str) -> String {
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    let labels: Vec<&str> = host.split('.').collect();
    if labels.len() <= 2 {
        host
    } else {
        labels[labels.len() - 2..].join(".")
    }
}

/// Build the script injected at document start into every frame.
/// `token` is a per-launch random name so pages cannot trivially probe for it.
pub fn frame_script(settings: ShieldSettings, token: &str) -> String {
    let cfg = serde_json::json!({
        "token": token,
        "autoSkip": settings.auto_skip,
        "popupShield": settings.popup_shield,
        "cosmetic": settings.content_rules,
    });
    FRAME_SCRIPT.replace("__MA_CFG__", &cfg.to_string())
}

/// Expression evaluated in the top frame to collect and reset counters.
pub fn drain_expression(token: &str) -> String {
    format!("(function(){{try{{return window['{token}'].drain();}}catch(e){{return null;}}}})()")
}

/// Statement that runs a manual skip in the top frame and every child frame.
pub fn skip_statement(token: &str) -> String {
    format!("(function(){{try{{window['{token}'].skip();}}catch(e){{}}}})()")
}

/// Expression evaluated in the top frame to list media the page has loaded.
pub fn media_expression(token: &str) -> String {
    format!("(function(){{try{{return window['{token}'].media();}}catch(e){{return null;}}}})()")
}

const FRAME_SCRIPT: &str = r#"
(function () {
  'use strict';
  var CFG = __MA_CFG__;
  var T = CFG.token;
  if (window[T + '_installed']) return;
  try { Object.defineProperty(window, T + '_installed', { value: true }); } catch (e) { return; }

  var isTop = false;
  try { isTop = window.top === window; } catch (e) { isTop = false; }

  var counts = { popups: 0, skipped: 0, overlays: 0 };
  function report(kind) {
    if (isTop) { counts[kind]++; return; }
    try { var m = {}; m[T] = kind; window.top.postMessage(m, '*'); } catch (e) {}
  }

  function relaySkip() {
    var frames = document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      try { var m = {}; m[T + '_cmd'] = 'skip'; frames[i].contentWindow.postMessage(m, '*'); } catch (e) {}
    }
  }

  // ---- Media scout ---------------------------------------------------------
  // Passive: watch the URLs this frame loads so the toolbar can offer to save
  // the video that is playing. Child frames forward to the top frame.
  var media = [];
  var mediaSeen = Object.create(null);
  var perfSeen = 0;
  var MEDIA_EXT = /\.(m3u8|mpd|mp4|m4v|mkv|webm|mov|avi|ogv)(?:[?#]|$)/i;

  function cookieOf() {
    try { return document.cookie || ''; } catch (e) { return ''; }
  }

  function mediaKind(url) {
    var clean = String(url).split(/[?#]/)[0].toLowerCase();
    if (/\.m3u8$/.test(clean)) return 'hls';
    if (/\.mpd$/.test(clean)) return 'dash';
    if (/\.(mp4|m4v|mkv|webm|mov|avi|ogv)$/.test(clean)) return 'file';
    return '';
  }

  // MSE and DASH players fetch video as many small .mp4 chunks. Offering those
  // as "the video" would save an unplayable fragment.
  function looksLikeSegment(url) {
    var file = String(url).split(/[?#]/)[0].split('/').pop() || '';
    return /^(init|seg|segment|chunk|frag|part)[-_.0-9]/i.test(file);
  }

  function addMedia(url, referer, cookie) {
    if (!url || typeof url !== 'string') return;
    if (!/^https?:/i.test(url)) return;
    if (!MEDIA_EXT.test(url)) return;
    var kind = mediaKind(url);
    if (!kind || (kind === 'file' && looksLikeSegment(url))) return;
    if (mediaSeen[url]) return;
    mediaSeen[url] = true;
    media.push({ url: url, referer: referer || location.href, cookie: cookie || cookieOf() });
    if (media.length > 40) {
      var dropped = media.shift();
      delete mediaSeen[dropped.url];
    }
    if (!isTop) {
      try {
        var m = {};
        m[T + '_media'] = { url: url, referer: location.href, cookie: cookieOf() };
        window.top.postMessage(m, '*');
      } catch (e) {}
    }
  }

  function scanMedia() {
    try {
      var entries = performance.getEntriesByType('resource');
      for (; perfSeen < entries.length; perfSeen++) addMedia(entries[perfSeen].name);
    } catch (e) {}
    try {
      var nodes = document.querySelectorAll('video, audio, source');
      for (var i = 0; i < nodes.length; i++) addMedia(nodes[i].currentSrc || nodes[i].src);
    } catch (e) {}
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    if (isTop && typeof d[T] === 'string' && Object.prototype.hasOwnProperty.call(counts, d[T])) {
      counts[d[T]]++;
    }
    if (isTop && d[T + '_media'] && typeof d[T + '_media'] === 'object') {
      var found = d[T + '_media'];
      addMedia(found.url, found.referer, found.cookie);
    }
    if (d[T + '_cmd'] === 'skip') { manualSkip(); relaySkip(); }
  }, true);

  if (isTop) {
    try {
      Object.defineProperty(window, T, {
        value: {
          drain: function () {
            var c = { popups: counts.popups, skipped: counts.skipped, overlays: counts.overlays };
            counts.popups = counts.skipped = counts.overlays = 0;
            return c;
          },
          skip: function () { manualSkip(); relaySkip(); },
          media: function () {
            return { page: location.href, title: document.title, items: media.slice() };
          }
        }
      });
    } catch (e) {}
  }

  // ---- Popup and redirect shield -------------------------------------------
  if (CFG.popupShield) {
    try {
      window.open = function () { report('popups'); return null; };
    } catch (e) {}
    try { window.alert = function () { return true; }; } catch (e) {}
  }

  // ---- Cosmetic rules ------------------------------------------------------
  if (CFG.cosmetic) {
    var css = '.ad-banner,.adsbox,.advertisement,[id*="ad-container"],[class*="ad-overlay"],' +
      '[class*="click-trap"],.ad-placement,.native-ad,#disclaimer-overlay,' +
      'div[style*="z-index: 2147483647"]:not(:has(video)):not(:has(iframe)),' +
      'div[style*="z-index: 999999"]:not(:has(video)):not(:has(iframe))' +
      '{display:none!important}';
    var addStyle = function () {
      var root = document.head || document.documentElement;
      if (!root) return false;
      var s = document.createElement('style');
      s.textContent = css;
      root.appendChild(s);
      return true;
    };
    if (!addStyle()) document.addEventListener('DOMContentLoaded', addStyle, { once: true });
  }

  // ---- Ad skipping ---------------------------------------------------------
  var AD_CONTEXT = /(^|[^a-z])(ads?|advert|preroll|midroll|vast|ima|sponsor)([^a-z]|$)/i;
  var STRICT_SKIP = [
    '.ytp-ad-skip-button', '.ytp-ad-skip-button-modern', '.ytp-skip-ad-button',
    '.videoAdUiSkipButton', '.vjs-skip-ad', '.jw-skip', '.ad-skip-btn', '.skip-ad',
    '[id*="skipAd"]', '[class*="skip-ad"]', '[class*="skipAd"]'
  ];
  var LOOSE_SKIP = '[class*="skip-button"],button[class*="skip"],[aria-label*="Skip"]';
  var pressed = typeof WeakSet === 'function' ? new WeakSet() : null;

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function inAdContext(el) {
    for (var n = el, depth = 0; n && depth < 6; n = n.parentElement, depth++) {
      var sig = (n.id || '') + ' ' + (typeof n.className === 'string' ? n.className : '');
      if (AD_CONTEXT.test(sig)) return true;
    }
    return /skip\s*ad/i.test(el.textContent || '') || /skip\s*ad/i.test(el.getAttribute('aria-label') || '');
  }
  function press(el) {
    if (!visible(el) || typeof el.click !== 'function') return false;
    if (pressed && pressed.has(el)) return false;
    if (pressed) pressed.add(el);
    try { el.click(); return true; } catch (e) { return false; }
  }
  function isAdVideo(v) {
    if (v.closest && (v.closest('.ad-container') || v.closest('.video-ads') || v.closest('[class*="ima-"]'))) return true;
    if (v.classList && v.classList.contains('ad-showing')) return true;
    var d = v.duration;
    return !!(d && isFinite(d) && d < 35 && !v.controls && inAdContext(v));
  }

  function autoSkip() {
    var i, list;
    for (i = 0; i < STRICT_SKIP.length; i++) {
      list = document.querySelectorAll(STRICT_SKIP[i]);
      for (var j = 0; j < list.length; j++) if (press(list[j])) report('skipped');
    }
    list = document.querySelectorAll(LOOSE_SKIP);
    for (i = 0; i < list.length; i++) if (inAdContext(list[i]) && press(list[i])) report('skipped');

    var videos = document.querySelectorAll('video');
    for (i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (v.paused || v.__maSkipped || !isAdVideo(v)) continue;
      try {
        v.__maSkipped = true;
        v.muted = true;
        v.playbackRate = 16;
        if (v.duration > 0 && isFinite(v.duration)) v.currentTime = Math.max(0, v.duration - 0.1);
        report('skipped');
      } catch (e) {}
    }
  }

  function removeClickTraps() {
    var traps = document.querySelectorAll('div[style*="z-index: 2147483647"], div[style*="z-index: 999999"], .jw-ad-container, [id*="click-layer"]');
    for (var i = 0; i < traps.length; i++) {
      var el = traps[i];
      if (el.querySelector('video, iframe')) continue;
      if (el.offsetHeight > 200 || el.offsetWidth > 200) {
        el.remove();
        report('overlays');
      }
    }
  }

  // Manual "Skip ad" from the toolbar: the user asked for it, so be generous.
  function manualSkip() {
    var list = document.querySelectorAll(STRICT_SKIP.join(',') + ',' + LOOSE_SKIP);
    var hit = false;
    for (var i = 0; i < list.length; i++) {
      if (visible(list[i])) { try { list[i].click(); hit = true; } catch (e) {} }
    }
    var videos = document.querySelectorAll('video');
    for (i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (v.duration && isFinite(v.duration) && v.duration < 40 && !v.paused) {
        try { v.currentTime = v.duration; hit = true; } catch (e) {}
      }
    }
    if (hit) report('skipped');
  }

  function tick() {
    if (CFG.autoSkip) autoSkip();
    if (CFG.popupShield) removeClickTraps();
  }
  if (CFG.autoSkip || CFG.popupShield) {
    setInterval(tick, 500);
    document.addEventListener('DOMContentLoaded', tick);
  }

  // ---- Media scout wiring --------------------------------------------------
  try {
    var originalFetch = window.fetch;
    if (originalFetch) {
      window.fetch = function (input) {
        try { addMedia(typeof input === 'string' ? input : (input && input.url)); } catch (e) {}
        return originalFetch.apply(this, arguments);
      };
    }
  } catch (e) {}
  try {
    var originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      try { addMedia(String(url)); } catch (e) {}
      return originalOpen.apply(this, arguments);
    };
  } catch (e) {}
  setInterval(scanMedia, 2000);
  scanMedia();
  document.addEventListener('DOMContentLoaded', scanMedia);
})();
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ad_hosts() {
        assert!(is_ad_like_host("pop.example.com"));
        assert!(is_ad_like_host("ads-cdn.example.net"));
        assert!(is_ad_like_host("www.1xbet.com"));
        assert!(is_ad_like_host("track.something.io"));
        assert!(!is_ad_like_host("cloudflare.com"));
        assert!(!is_ad_like_host("reader.example.com"));
        assert!(!is_ad_like_host("www.rivestream.app"));
        assert!(!is_ad_like_host("hydrahd.ws"));
    }

    #[test]
    fn site_keys() {
        assert_eq!(site_key("www.movy.sx"), "movy.sx");
        assert_eq!(site_key("cno.to"), "cno.to");
    }

    #[test]
    fn script_embeds_config() {
        let s = frame_script(ShieldSettings::default(), "tok123");
        assert!(s.contains("\"token\":\"tok123\""));
        assert!(!s.contains("__MA_CFG__"));
    }
}
