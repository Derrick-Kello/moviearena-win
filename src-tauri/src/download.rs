//! Offline capture for the player: direct video files and HLS streams.
//!
//! Streaming sites rarely offer a download button. The player either loads a
//! progressive file or plays an HLS playlist through Media Source Extensions.
//! This module turns either one into something the library can list and play
//! without internet: a single video file, or a folder holding a rewritten
//! playlist plus its segments.
//!
//! Encrypted HLS with `AES-128` is supported by downloading the key and
//! rewriting the playlist so hls.js can decrypt it offline. DRM schemes
//! (`SAMPLE-AES`, Widevine, PlayReady) are refused, not circumvented.

use crate::library;
use crate::UI;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, CONTENT_TYPE, COOKIE, RANGE, REFERER};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MAX_SEGMENTS: usize = 20_000;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub url: String,
    pub name: String,
    #[serde(default)]
    pub referer: Option<String>,
    #[serde(default)]
    pub cookie: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    File,
    Hls,
}

pub struct Plan {
    pub url: url::Url,
    /// Display name. For HLS this ends in `.m3u8`; the path is the folder.
    pub name: String,
    pub path: PathBuf,
    pub kind: Kind,
    pub referer: Option<String>,
    pub cookie: Option<String>,
}

pub fn classify(url: &url::Url) -> Result<Kind, String> {
    let path = url.path().to_ascii_lowercase();
    if path.ends_with(".m3u8") {
        Ok(Kind::Hls)
    } else if path.ends_with(".mpd") {
        Err("DASH streams aren't supported yet. Try a source that uses HLS.".into())
    } else {
        Ok(Kind::File)
    }
}

/// Work out where the download will land before the async work starts, so the
/// UI can show the transfer immediately.
pub fn plan(app: &AppHandle, request: Request) -> Result<Plan, String> {
    let url = url::Url::parse(request.url.trim()).map_err(|e| format!("Invalid video address: {e}"))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Only http and https addresses can be downloaded.".into());
    }
    let kind = classify(&url)?;
    let dir = library::dir(app)?;
    let suggested = library::safe_name(&request.name);
    let (name, path) = match kind {
        Kind::File => {
            let file_name = if library::download_allowed(&suggested) {
                suggested
            } else {
                format!("{}.mp4", without_media_ext(&suggested))
            };
            let path = library::unique(&dir, &file_name);
            let display = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or(file_name);
            (display, path)
        }
        Kind::Hls => {
            let path = library::unique(&dir, &without_media_ext(&suggested));
            let display = format!(
                "{}.m3u8",
                path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "video".into())
            );
            (display, path)
        }
    };
    Ok(Plan { url, name, path, kind, referer: request.referer, cookie: request.cookie })
}

/// Classify a URL the player loaded. `None` means it is not media we can save.
pub fn media_kind(url: &str) -> Option<&'static str> {
    let path = url.split(['?', '#']).next().unwrap_or(url).to_ascii_lowercase();
    if path.ends_with(".m3u8") {
        Some("hls")
    } else if path.ends_with(".mpd") {
        Some("dash")
    } else if [".mp4", ".m4v", ".mkv", ".webm", ".mov", ".avi", ".ogv"]
        .iter()
        .any(|ext| path.ends_with(ext))
    {
        Some("file")
    } else {
        None
    }
}

/// A friendly file or folder name for a discovered URL.
pub fn suggest_name(url: &str, title: &str, kind: &str) -> String {
    let parsed = url::Url::parse(url).ok();
    let segment = parsed
        .as_ref()
        .and_then(|u| u.path_segments().and_then(|s| s.last()))
        .unwrap_or("");
    let clean_title = if title.trim().is_empty() { "video" } else { title.trim() };
    match kind {
        "hls" => format!("{}.m3u8", without_media_ext(clean_title)),
        "dash" => format!("{}.mpd", without_media_ext(clean_title)),
        _ => {
            let decoded = percent_decode(segment);
            if library::is_video(&decoded) {
                library::safe_name(&decoded)
            } else {
                format!("{}.mp4", without_media_ext(clean_title))
            }
        }
    }
}

fn percent_decode(raw: &str) -> String {
    let bytes = raw.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(high), Some(low)) = (hex_value(bytes[i + 1]), hex_value(bytes[i + 2])) {
                out.push(high * 16 + low);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn without_media_ext(raw: &str) -> String {
    let p = Path::new(raw);
    let ext = p.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase());
    let strip = matches!(
        ext.as_deref(),
        Some("m3u8" | "mpd" | "mp4" | "m4v" | "mkv" | "webm" | "mov" | "avi" | "ogv")
    );
    let base = if strip { p.file_stem().and_then(|s| s.to_str()).unwrap_or(raw) } else { raw };
    let cleaned = library::safe_name(base);
    if cleaned.is_empty() {
        "video".into()
    } else {
        cleaned
    }
}

pub async fn run(app: AppHandle, plan: Plan) {
    let url = plan.url.as_str().to_string();
    let result = match plan.kind {
        Kind::File => download_file(&plan).await,
        Kind::Hls => download_hls(&plan).await,
    };
    match result {
        Ok(path) => {
            let _ = app.emit_to(
                UI,
                "download:finished",
                serde_json::json!({ "url": url, "path": path, "success": true }),
            );
        }
        Err(message) => {
            match plan.kind {
                Kind::File => {
                    let _ = tokio::fs::remove_file(temp_file(&plan.path)).await;
                }
                Kind::Hls => {
                    let _ = tokio::fs::remove_dir_all(temp_dir(&plan.path)).await;
                }
            }
            let _ = app.emit_to(UI, "download:error", serde_json::json!({ "url": url, "message": message }));
            let _ = app.emit_to(
                UI,
                "download:finished",
                serde_json::json!({ "url": url, "path": serde_json::Value::Null, "success": false }),
            );
        }
    }
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(UA)
        .connect_timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| e.to_string())
}

fn headers(plan: &Plan) -> HeaderMap {
    headers_for(plan, plan.referer.as_deref())
}

/// A referer override matters for CDNs that check the playlist URL on segments.
fn headers_for(plan: &Plan, referer: Option<&str>) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(ACCEPT, HeaderValue::from_static("*/*"));
    if let Some(referer) = referer {
        if let Ok(value) = HeaderValue::from_str(referer) {
            headers.insert(REFERER, value);
        }
    }
    if let Some(cookie) = &plan.cookie {
        if let Ok(value) = HeaderValue::from_str(cookie) {
            headers.insert(COOKIE, value);
        }
    }
    headers
}

fn temp_file(path: &Path) -> PathBuf {
    PathBuf::from(format!("{}.crdownload", path.display()))
}

fn temp_dir(path: &Path) -> PathBuf {
    PathBuf::from(format!("{}.part", path.display()))
}

async fn download_file(plan: &Plan) -> Result<String, String> {
    let temp = temp_file(&plan.path);
    let client = client()?;
    let response = client
        .get(plan.url.clone())
        .headers(headers(plan))
        .send()
        .await
        .map_err(|e| format!("Could not reach the video: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("The video server answered {}.", response.status()));
    }
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if content_type.starts_with("text/html") {
        return Err("That address returned a web page, not a video.".into());
    }

    let mut file = tokio::fs::File::create(&temp)
        .await
        .map_err(|e| format!("Could not create the file: {e}"))?;
    let mut response = response;
    let mut written = 0u64;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("The download stopped: {e}"))?
    {
        tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(|e| format!("Could not write the file: {e}"))?;
        written += chunk.len() as u64;
    }
    tokio::io::AsyncWriteExt::flush(&mut file).await.ok();
    drop(file);

    if written == 0 {
        let _ = tokio::fs::remove_file(&temp).await;
        return Err("The server sent an empty file.".into());
    }
    tokio::fs::rename(&temp, &plan.path)
        .await
        .map_err(|e| format!("Could not save the file: {e}"))?;
    Ok(plan.path.to_string_lossy().into_owned())
}

// ---------------------------------------------------------------------------
// HLS
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct Key {
    uri: url::Url,
    iv: Option<String>,
}

#[derive(Clone)]
struct Init {
    uri: url::Url,
    range: Option<(u64, u64)>,
}

#[derive(Clone)]
struct Segment {
    uri: url::Url,
    duration: f64,
    range: Option<(u64, u64)>,
    key: Option<Key>,
    init: Option<Init>,
    discontinuity: bool,
}

struct Playlist {
    segments: Vec<Segment>,
    media_sequence: u64,
    version: Option<String>,
    target_duration: u64,
}

fn attr<'a>(line: &'a str, name: &str) -> Option<&'a str> {
    let needle = format!("{name}=");
    let mut rest = line;
    loop {
        let idx = rest.find(&needle)?;
        let boundary = idx == 0 || rest.as_bytes()[idx - 1] == b',';
        if boundary {
            let tail = &rest[idx + needle.len()..];
            if let Some(quoted) = tail.strip_prefix('"') {
                let end = quoted.find('"')?;
                return Some(&quoted[..end]);
            }
            let end = tail.find(',').unwrap_or(tail.len());
            return Some(tail[..end].trim());
        }
        rest = &rest[idx + needle.len()..];
    }
}

fn parse_range(raw: &str) -> Option<(u64, u64)> {
    let raw = raw.trim();
    let (length, offset) = match raw.split_once('@') {
        Some((length, offset)) => (length, offset.parse().ok()?),
        None => (raw, 0),
    };
    Some((length.parse().ok()?, offset))
}

fn range_key(range: Option<(u64, u64)>) -> String {
    range.map(|(length, offset)| format!("{length}@{offset}")).unwrap_or_default()
}

fn is_master(text: &str) -> bool {
    text.lines().any(|line| line.trim_start().starts_with("#EXT-X-STREAM-INF:"))
}

fn pick_variant(base: &url::Url, text: &str) -> Option<url::Url> {
    let mut lines = text.lines().map(str::trim).filter(|line| !line.is_empty());
    let mut best: Option<(u64, url::Url)> = None;
    while let Some(line) = lines.next() {
        let Some(rest) = line.strip_prefix("#EXT-X-STREAM-INF:") else { continue };
        let bandwidth = attr(rest, "BANDWIDTH").and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
        let mut uri = None;
        for next in lines.by_ref() {
            if next.starts_with('#') {
                continue;
            }
            uri = base.join(next).ok();
            break;
        }
        if let Some(uri) = uri {
            if best.as_ref().map_or(true, |(seen, _)| bandwidth > *seen) {
                best = Some((bandwidth, uri));
            }
        }
    }
    best.map(|(_, uri)| uri)
}

fn parse_playlist(base: &url::Url, text: &str) -> Result<Playlist, String> {
    let mut segments: Vec<Segment> = Vec::new();
    let mut key: Option<Key> = None;
    let mut init: Option<Init> = None;
    let mut pending_range: Option<(u64, u64)> = None;
    let mut pending_duration: Option<f64> = None;
    let mut pending_discontinuity = false;
    let mut media_sequence = 0u64;
    let mut version = None;
    let mut target_duration = 0u64;

    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(rest) = line.strip_prefix("#EXT-X-MEDIA-SEQUENCE:") {
            media_sequence = rest.trim().parse().unwrap_or(0);
        } else if let Some(rest) = line.strip_prefix("#EXT-X-VERSION:") {
            version = Some(rest.trim().to_string());
        } else if let Some(rest) = line.strip_prefix("#EXT-X-TARGETDURATION:") {
            target_duration = rest.trim().parse().unwrap_or(0);
        } else if let Some(rest) = line.strip_prefix("#EXT-X-KEY:") {
            let method = attr(rest, "METHOD").unwrap_or("NONE").to_ascii_uppercase();
            match method.as_str() {
                "NONE" => key = None,
                "AES-128" => {
                    let uri = attr(rest, "URI").ok_or("An encrypted stream is missing its key address.")?;
                    key = Some(Key {
                        uri: base.join(uri).map_err(|e| format!("Bad key address: {e}"))?,
                        iv: attr(rest, "IV").map(str::to_string),
                    });
                }
                other => {
                    return Err(format!(
                        "This stream is protected with {other} and can't be saved. Try another source."
                    ))
                }
            }
        } else if let Some(rest) = line.strip_prefix("#EXT-X-MAP:") {
            let uri = attr(rest, "URI").ok_or("This stream is missing its init segment.")?;
            init = Some(Init {
                uri: base.join(uri).map_err(|e| format!("Bad init segment address: {e}"))?,
                range: attr(rest, "BYTERANGE").and_then(parse_range),
            });
        } else if let Some(rest) = line.strip_prefix("#EXT-X-BYTERANGE:") {
            pending_range = parse_range(rest);
        } else if let Some(rest) = line.strip_prefix("#EXTINF:") {
            pending_duration = Some(rest.split(',').next().unwrap_or("").trim().parse().unwrap_or(0.0));
        } else if line == "#EXT-X-DISCONTINUITY" {
            pending_discontinuity = true;
        } else if line.starts_with('#') {
            // Other tags are not needed once the playlist is rewritten.
        } else {
            let uri = base.join(line).map_err(|e| format!("Bad segment address: {e}"))?;
            let duration = pending_duration.take().unwrap_or(0.0);
            if duration > 0.0 {
                target_duration = target_duration.max(duration.ceil() as u64);
            }
            segments.push(Segment {
                uri,
                duration,
                range: pending_range.take(),
                key: key.clone(),
                init: init.clone(),
                discontinuity: std::mem::take(&mut pending_discontinuity),
            });
            if segments.len() > MAX_SEGMENTS {
                return Err("That playlist is too long to save.".into());
            }
        }
    }

    if segments.is_empty() {
        return Err("That playlist has no video segments.".into());
    }
    Ok(Playlist {
        segments,
        media_sequence,
        version,
        target_duration: target_duration.max(1),
    })
}

async fn fetch_text(
    client: &reqwest::Client,
    url: &url::Url,
    plan: &Plan,
    referer: Option<&str>,
) -> Result<String, String> {
    let response = client
        .get(url.clone())
        .headers(headers_for(plan, referer))
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Could not load the stream playlist: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("The stream server answered {}.", response.status()));
    }
    let text = response
        .text()
        .await
        .map_err(|e| format!("Could not read the stream playlist: {e}"))?;
    let head = text.trim_start();
    if head.starts_with("<!DOCTYPE") || head.starts_with("<html") {
        return Err("That stream address returned a web page, not a playlist.".into());
    }
    Ok(text)
}

async fn fetch_bytes(
    client: &reqwest::Client,
    url: &url::Url,
    plan: &Plan,
    range: Option<(u64, u64)>,
    referer: Option<&str>,
) -> Result<Vec<u8>, String> {
    let mut request = client.get(url.clone()).headers(headers_for(plan, referer));
    if let Some((length, offset)) = range {
        let value = format!("bytes={offset}-{}", offset + length.saturating_sub(1));
        request = request.header(RANGE, HeaderValue::from_str(&value).map_err(|e| e.to_string())?);
    }
    let response = request
        .timeout(Duration::from_secs(180))
        .send()
        .await
        .map_err(|e| format!("Could not load a stream segment: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("The stream server answered {} for a segment.", response.status()));
    }
    let status = response.status();
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Could not read a stream segment: {e}"))?;
    if let Some((length, offset)) = range {
        if status == reqwest::StatusCode::OK {
            let start = offset as usize;
            let end = (offset + length) as usize;
            if start >= bytes.len() {
                return Err("A stream segment was shorter than expected.".into());
            }
            return Ok(bytes[start..end.min(bytes.len())].to_vec());
        }
    }
    Ok(bytes.to_vec())
}

fn ext_of(url: &url::Url, fallback: &str) -> String {
    Path::new(url.path())
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .filter(|e| e.len() <= 5 && e.chars().all(|c| c.is_ascii_alphanumeric()))
        .unwrap_or_else(|| fallback.to_string())
}

fn segment_ext(url: &url::Url, has_init: bool) -> String {
    let ext = ext_of(url, if has_init { "m4s" } else { "ts" });
    if matches!(ext.as_str(), "ts" | "m4s" | "mp4" | "aac" | "m4a" | "cmfv" | "cmfa") {
        ext
    } else if has_init {
        "m4s".into()
    } else {
        "ts".into()
    }
}

fn rewrite_playlist(
    playlist: &Playlist,
    key_names: &HashMap<String, String>,
    init_names: &HashMap<String, String>,
    segment_names: &[String],
) -> String {
    let mut out = String::new();
    out.push_str("#EXTM3U\n");
    out.push_str(&format!("#EXT-X-VERSION:{}\n", playlist.version.as_deref().unwrap_or("3")));
    out.push_str(&format!("#EXT-X-TARGETDURATION:{}\n", playlist.target_duration));
    out.push_str(&format!("#EXT-X-MEDIA-SEQUENCE:{}\n", playlist.media_sequence));
    out.push_str("#EXT-X-PLAYLIST-TYPE:VOD\n");

    let mut last_key: Option<String> = None;
    let mut last_init: Option<String> = None;
    for (i, segment) in playlist.segments.iter().enumerate() {
        if segment.discontinuity {
            out.push_str("#EXT-X-DISCONTINUITY\n");
        }
        match &segment.key {
            Some(key) => {
                let name = key_names.get(key.uri.as_str()).expect("key was collected");
                let id = format!("{name}|{:?}", key.iv);
                if last_key.as_deref() != Some(id.as_str()) {
                    out.push_str(&format!("#EXT-X-KEY:METHOD=AES-128,URI=\"{name}\""));
                    if let Some(iv) = &key.iv {
                        out.push_str(&format!(",IV={iv}"));
                    }
                    out.push('\n');
                    last_key = Some(id);
                }
            }
            None => {
                if last_key.is_some() {
                    out.push_str("#EXT-X-KEY:METHOD=NONE\n");
                    last_key = None;
                }
            }
        }
        if let Some(init) = &segment.init {
            let id = format!("{}#{}", init.uri, range_key(init.range));
            if last_init.as_deref() != Some(id.as_str()) {
                let name = init_names.get(&id).expect("init segment was collected");
                out.push_str(&format!("#EXT-X-MAP:URI=\"{name}\"\n"));
                last_init = Some(id);
            }
        }
        out.push_str(&format!("#EXTINF:{:.3},\n{}\n", segment.duration, segment_names[i]));
    }
    out.push_str("#EXT-X-ENDLIST\n");
    out
}

async fn download_hls(plan: &Plan) -> Result<String, String> {
    let temp = temp_dir(&plan.path);
    let _ = tokio::fs::remove_dir_all(&temp).await;
    tokio::fs::create_dir_all(&temp)
        .await
        .map_err(|e| format!("Could not create the stream folder: {e}"))?;

    let client = client()?;
    let first = fetch_text(&client, &plan.url, plan, plan.referer.as_deref()).await?;
    if !first.trim_start().starts_with("#EXTM3U") {
        return Err("That address is not an HLS playlist.".into());
    }
    if first.lines().any(|line| {
        let tag = line.trim_start().to_ascii_uppercase();
        tag.starts_with("#EXT-X-SESSION-KEY:") && tag.contains("SAMPLE-AES")
    }) {
        return Err("This stream is protected with DRM and can't be saved. Try another source.".into());
    }
    let (media_url, media_text) = if is_master(&first) {
        let variant = pick_variant(&plan.url, &first).ok_or("That playlist has no playable variant.")?;
        let text = fetch_text(&client, &variant, plan, Some(plan.url.as_str())).await?;
        (variant, text)
    } else {
        (plan.url.clone(), first)
    };
    let playlist = parse_playlist(&media_url, &media_text)?;

    // Keys, init segments and media segments, named for the local playlist.
    let mut key_names: HashMap<String, String> = HashMap::new();
    let mut init_names: HashMap<String, String> = HashMap::new();
    let mut files: Vec<(String, url::Url, Option<(u64, u64)>)> = Vec::new();
    let mut segment_names = Vec::with_capacity(playlist.segments.len());

    for segment in &playlist.segments {
        if let Some(key) = &segment.key {
            if !key_names.contains_key(key.uri.as_str()) {
                let name = format!("key{}.bin", key_names.len());
                key_names.insert(key.uri.as_str().to_string(), name.clone());
                files.push((name, key.uri.clone(), None));
            }
        }
    }
    for segment in &playlist.segments {
        if let Some(init) = &segment.init {
            let id = format!("{}#{}", init.uri, range_key(init.range));
            if !init_names.contains_key(&id) {
                let name = format!("init{}.{}", init_names.len(), ext_of(&init.uri, "mp4"));
                init_names.insert(id, name.clone());
                files.push((name, init.uri.clone(), init.range));
            }
        }
    }
    for segment in &playlist.segments {
        let name = format!("seg{:05}.{}", segment_names.len(), segment_ext(&segment.uri, segment.init.is_some()));
        segment_names.push(name.clone());
        files.push((name, segment.uri.clone(), segment.range));
    }

    for (name, url, range) in &files {
        let bytes = fetch_bytes(&client, url, plan, *range, Some(media_url.as_str())).await?;
        tokio::fs::write(temp.join(name), &bytes)
            .await
            .map_err(|e| format!("Could not save a stream segment: {e}"))?;
    }

    let out = rewrite_playlist(&playlist, &key_names, &init_names, &segment_names);
    tokio::fs::write(temp.join(library::HLS_INDEX), out.as_bytes())
        .await
        .map_err(|e| format!("Could not write the offline playlist: {e}"))?;
    tokio::fs::rename(&temp, &plan.path)
        .await
        .map_err(|e| format!("Could not finish the offline stream: {e}"))?;
    Ok(plan.path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> url::Url {
        url::Url::parse("https://cdn.example/films/movie/index.m3u8").unwrap()
    }

    #[test]
    fn attributes_are_quoted_or_bare() {
        let line = r#"METHOD=AES-128,URI="key.bin",IV=0x0102"#;
        assert_eq!(attr(line, "METHOD"), Some("AES-128"));
        assert_eq!(attr(line, "URI"), Some("key.bin"));
        assert_eq!(attr(line, "IV"), Some("0x0102"));
        assert_eq!(attr("BANDWIDTH=1200000,RESOLUTION=1920x1080", "BANDWIDTH"), Some("1200000"));
    }

    #[test]
    fn playlist_keeps_sequence_and_segments() {
        let text = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXT-X-MEDIA-SEQUENCE:7\n\
                    #EXTINF:4.0,\nseg-a.ts\n#EXTINF:4.0,\nseg-b.ts\n#EXT-X-ENDLIST\n";
        let playlist = parse_playlist(&base(), text).unwrap();
        assert_eq!(playlist.media_sequence, 7);
        assert_eq!(playlist.segments.len(), 2);
        assert_eq!(playlist.segments[0].uri.as_str(), "https://cdn.example/films/movie/seg-a.ts");
        assert_eq!(playlist.target_duration, 4);
    }

    #[test]
    fn byte_ranges_and_init_segments_parse() {
        let text = "#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:4\n\
                    #EXT-X-MAP:URI=\"init.mp4\"\n\
                    #EXT-X-BYTERANGE:100@0\n#EXTINF:4.0,\nall.m4s\n\
                    #EXT-X-BYTERANGE:100@100\n#EXTINF:4.0,\nall.m4s\n";
        let playlist = parse_playlist(&base(), text).unwrap();
        assert_eq!(playlist.segments[0].range, Some((100, 0)));
        assert_eq!(playlist.segments[1].range, Some((100, 100)));
        assert!(playlist.segments[0].init.is_some());
    }

    #[test]
    fn drm_is_refused() {
        let text = "#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI=\"skd://key\"\n#EXTINF:4,\na.ts\n";
        let error = parse_playlist(&base(), text).err().expect("DRM playlist should fail");
        assert!(error.contains("SAMPLE-AES"));
    }

    #[test]
    fn master_picks_the_highest_bandwidth() {
        let text = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=500000\nlow/index.m3u8\n\
                    #EXT-X-STREAM-INF:BANDWIDTH=2500000\nhigh/index.m3u8\n";
        assert_eq!(
            pick_variant(&base(), text).unwrap().as_str(),
            "https://cdn.example/films/movie/high/index.m3u8"
        );
    }

    fn segment(name: &str, duration: f64) -> Segment {
        Segment {
            uri: base().join(name).unwrap(),
            duration,
            range: None,
            key: None,
            init: None,
            discontinuity: false,
        }
    }

    fn key(name: &str, iv: Option<&str>) -> Key {
        Key { uri: base().join(name).unwrap(), iv: iv.map(str::to_string) }
    }

    fn init(name: &str) -> Init {
        Init { uri: base().join(name).unwrap(), range: None }
    }

    fn plain(segments: Vec<Segment>) -> Playlist {
        Playlist { segments, media_sequence: 0, version: Some("6".into()), target_duration: 4 }
    }

    #[test]
    fn rewritten_playlist_lists_local_segments() {
        let playlist = plain(vec![segment("a.ts", 4.0), segment("b.ts", 3.5)]);
        let out = rewrite_playlist(
            &playlist,
            &HashMap::new(),
            &HashMap::new(),
            &["seg00000.ts".into(), "seg00001.ts".into()],
        );
        assert_eq!(
            out,
            "#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-TARGETDURATION:4\n#EXT-X-MEDIA-SEQUENCE:0\n\
             #EXT-X-PLAYLIST-TYPE:VOD\n#EXTINF:4.000,\nseg00000.ts\n#EXTINF:3.500,\nseg00001.ts\n\
             #EXT-X-ENDLIST\n"
        );
    }

    #[test]
    fn rewritten_playlist_emits_key_once_and_clears_it() {
        let mut first = segment("a.ts", 4.0);
        first.key = Some(key("key0.bin", Some("0x0102")));
        let mut second = segment("b.ts", 4.0);
        second.key = Some(key("key0.bin", Some("0x0102")));
        let third = segment("c.ts", 4.0);

        let mut key_names = HashMap::new();
        key_names.insert(base().join("key0.bin").unwrap().to_string(), "key0.bin".to_string());

        let out = rewrite_playlist(
            &plain(vec![first, second, third]),
            &key_names,
            &HashMap::new(),
            &["seg00000.ts".into(), "seg00001.ts".into(), "seg00002.ts".into()],
        );
        assert_eq!(out.matches("#EXT-X-KEY:").count(), 2);
        assert!(out.contains("#EXT-X-KEY:METHOD=AES-128,URI=\"key0.bin\",IV=0x0102\n"));
        assert!(out.contains("#EXT-X-KEY:METHOD=NONE\n"));
        assert!(out.find("METHOD=NONE").unwrap() > out.find("seg00001.ts").unwrap());
    }

    #[test]
    fn rewritten_playlist_emits_init_segments_per_file() {
        let mut first = segment("all.m4s", 4.0);
        first.init = Some(init("init.mp4"));
        let mut second = segment("all.m4s", 4.0);
        second.init = Some(init("init.mp4"));
        let mut third = segment("other.m4s", 4.0);
        third.init = Some(init("other-init.mp4"));
        third.discontinuity = true;

        let mut init_names = HashMap::new();
        init_names.insert(
            format!("{}#", base().join("init.mp4").unwrap()),
            "init0.mp4".to_string(),
        );
        init_names.insert(
            format!("{}#", base().join("other-init.mp4").unwrap()),
            "init1.mp4".to_string(),
        );

        let out = rewrite_playlist(
            &plain(vec![first, second, third]),
            &HashMap::new(),
            &init_names,
            &["seg00000.m4s".into(), "seg00001.m4s".into(), "seg00002.m4s".into()],
        );
        assert_eq!(out.matches("#EXT-X-MAP:").count(), 2);
        assert!(out.contains("#EXT-X-MAP:URI=\"init0.mp4\"\n"));
        assert!(out.contains("#EXT-X-MAP:URI=\"init1.mp4\"\n"));
        assert!(out.contains("#EXT-X-DISCONTINUITY\n"));
    }

    #[test]
    fn rewritten_playlist_defaults_version() {
        let mut playlist = plain(vec![segment("a.ts", 4.0)]);
        playlist.version = None;
        let out = rewrite_playlist(&playlist, &HashMap::new(), &HashMap::new(), &["seg00000.ts".into()]);
        assert!(out.contains("#EXT-X-VERSION:3\n"));
    }

    /// A throwaway HTTP server so the HLS path can be exercised end to end.
    fn serve(routes: Vec<(&'static str, &'static [u8])>) -> String {
        use std::io::{Read, Write};
        use std::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { continue };
                let mut buf = [0u8; 4096];
                let read = stream.read(&mut buf).unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..read]);
                let path = request.split_whitespace().nth(1).unwrap_or("/").to_string();
                let body = routes
                    .iter()
                    .find(|(route, _)| *route == path)
                    .map(|(_, body)| *body)
                    .unwrap_or(b"not found");
                let status = if body == b"not found" { "404 Not Found" } else { "200 OK" };
                let head = format!(
                    "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                let _ = stream.write_all(head.as_bytes());
                let _ = stream.write_all(body);
            }
        });
        format!("http://{address}")
    }

    #[tokio::test]
    async fn hls_download_saves_the_best_variant_and_rewrites_the_playlist() {
        let master = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=400000\nlow/index.m3u8\n\
                      #EXT-X-STREAM-INF:BANDWIDTH=2000000\nhigh/index.m3u8\n";
        let media = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXT-X-MEDIA-SEQUENCE:0\n\
                     #EXT-X-KEY:METHOD=AES-128,URI=\"key.bin\",IV=0x000102030405060708090a0b0c0d0e0f\n\
                     #EXTINF:4.000,\nseg0.ts\n#EXTINF:4.000,\nseg1.ts\n#EXT-X-ENDLIST\n";
        let origin = serve(vec![
            ("/master.m3u8", master.as_bytes()),
            ("/high/index.m3u8", media.as_bytes()),
            ("/high/key.bin", &[7u8; 16]),
            ("/high/seg0.ts", b"high-0"),
            ("/high/seg1.ts", b"high-1"),
        ]);

        let root = std::env::temp_dir().join(format!(
            "movie-arena-hls-{}",
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("Film");
        let plan = Plan {
            url: url::Url::parse(&format!("{origin}/master.m3u8")).unwrap(),
            name: "Film.m3u8".into(),
            path: path.clone(),
            kind: Kind::Hls,
            referer: None,
            cookie: None,
        };

        let saved = download_hls(&plan).await.expect("download should succeed");
        assert_eq!(saved, path.to_string_lossy());

        let index = std::fs::read_to_string(path.join(library::HLS_INDEX)).unwrap();
        assert!(index.contains("#EXT-X-KEY:METHOD=AES-128,URI=\"key0.bin\""));
        assert!(index.contains("#EXTINF:4.000,\nseg00000.ts\n"));
        assert!(index.contains("#EXTINF:4.000,\nseg00001.ts\n"));
        assert!(index.ends_with("#EXT-X-ENDLIST\n"));
        assert!(!index.contains("high/index.m3u8"));

        assert_eq!(std::fs::read(path.join("seg00000.ts")).unwrap(), b"high-0");
        assert_eq!(std::fs::read(path.join("seg00001.ts")).unwrap(), b"high-1");
        assert_eq!(std::fs::read(path.join("key0.bin")).unwrap(), vec![7u8; 16]);
        assert!(!PathBuf::from(format!("{}.part", path.display())).exists());

        std::fs::remove_dir_all(&root).unwrap();
    }

    #[tokio::test]
    async fn hls_download_refuses_drm_streams() {
        let media = "#EXTM3U\n#EXT-X-SESSION-KEY:METHOD=SAMPLE-AES,URI=\"skd://key\"\n\
                     #EXT-X-TARGETDURATION:4\n#EXTINF:4,\nseg0.ts\n";
        let origin = serve(vec![("/film.m3u8", media.as_bytes())]);
        let root = std::env::temp_dir().join(format!(
            "movie-arena-drm-{}",
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let plan = Plan {
            url: url::Url::parse(&format!("{origin}/film.m3u8")).unwrap(),
            name: "Film.m3u8".into(),
            path: root.join("Film"),
            kind: Kind::Hls,
            referer: None,
            cookie: None,
        };

        let error = download_hls(&plan).await.expect_err("DRM should be refused");
        assert!(error.contains("DRM"));
        assert!(!plan.path.exists());

        std::fs::remove_dir_all(&root).unwrap();
    }
}
