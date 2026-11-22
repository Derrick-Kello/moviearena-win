//! Offline library: one folder of video files the app can list, play and
//! manage. Downloads a site offers land here; users can also drop files in.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

const VIDEO_EXT: &[&str] = &["mp4", "m4v", "mkv", "webm", "mov", "avi", "ogv"];
const SUBTITLE_EXT: &[&str] = &["srt", "vtt"];

/// `<Videos>/Movie Arena` (`~/Movies` on macOS), created on first use.
pub fn dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .video_dir()
        .or_else(|_| app.path().download_dir())
        .map_err(|e| e.to_string())?;
    let dir = base.join("Movie Arena");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn ext(name: &str) -> String {
    Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

pub fn is_video(name: &str) -> bool {
    VIDEO_EXT.contains(&ext(name).as_str())
}

/// Only video and subtitle files may be downloaded. Ad-heavy sites push
/// installers and scripts through fake download buttons.
pub fn download_allowed(name: &str) -> bool {
    is_video(name) || SUBTITLE_EXT.contains(&ext(name).as_str())
}

/// A file name that is safe on Windows, macOS and Linux.
pub fn safe_name(raw: &str) -> String {
    let base = raw.rsplit(['/', '\\']).next().unwrap_or(raw);
    let cleaned: String = base
        .chars()
        .map(|c| if c.is_control() || r#"<>:"/\|?*"#.contains(c) { '_' } else { c })
        .collect();
    let trimmed = cleaned.trim().trim_start_matches('.').trim_end_matches(['.', ' ']);
    let name: String = trimmed.chars().take(150).collect();
    if name.is_empty() { "video".into() } else { name }
}

/// `name.mp4`, or `name (2).mp4` when that is taken.
pub fn unique(dir: &Path, name: &str) -> PathBuf {
    let path = dir.join(name);
    if !path.exists() {
        return path;
    }
    let p = Path::new(name);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("video");
    let ext = p.extension().and_then(|s| s.to_str());
    (2..)
        .map(|n| match ext {
            Some(e) => dir.join(format!("{stem} ({n}).{e}")),
            None => dir.join(format!("{stem} ({n})")),
        })
        .find(|p| !p.exists())
        .expect("unbounded range")
}

/// The file that marks a folder as an offline HLS stream.
pub const HLS_INDEX: &str = "index.m3u8";

fn modified(meta: &std::fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Total bytes under a folder. Used for offline streams, which are folders.
pub fn dir_size(dir: &Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(dir) else { return 0 };
    let mut total = 0;
    for entry in entries.flatten() {
        let Ok(meta) = entry.metadata() else { continue };
        if meta.is_dir() {
            total += dir_size(&entry.path());
        } else if meta.is_file() {
            total += meta.len();
        }
    }
    total
}

/// A folder holding a downloaded HLS stream (`index.m3u8` plus segments).
pub fn is_hls_dir(path: &Path) -> bool {
    path.is_dir() && path.join(HLS_INDEX).is_file()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    name: String,
    path: String,
    size: u64,
    modified: u64,
    /// "file" for a single video, "hls" for an offline stream folder.
    kind: &'static str,
}

/// Video files and offline streams in the library folder and one level of
/// subfolders, newest first.
pub fn list(dir: &Path) -> Vec<Item> {
    fn walk(dir: &Path, depth: u8, out: &mut Vec<Item>) {
        let Ok(entries) = std::fs::read_dir(dir) else { return };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(meta) = entry.metadata() else { continue };
            let name = entry.file_name().to_string_lossy().into_owned();
            if meta.is_dir() && depth > 0 && !name.starts_with('.') && !name.ends_with(".part") {
                if is_hls_dir(&path) {
                    let display = if name.ends_with(".m3u8") { name } else { format!("{name}.m3u8") };
                    out.push(Item {
                        name: display,
                        path: path.to_string_lossy().into_owned(),
                        size: dir_size(&path),
                        modified: modified(&meta),
                        kind: "hls",
                    });
                } else {
                    walk(&path, depth - 1, out);
                }
            } else if meta.is_file() && is_video(&name) {
                out.push(Item {
                    name,
                    path: path.to_string_lossy().into_owned(),
                    size: meta.len(),
                    modified: modified(&meta),
                    kind: "file",
                });
            }
        }
    }
    let mut out = Vec::new();
    walk(dir, 1, &mut out);
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    out
}

/// Resolve `path` and refuse anything outside the library folder.
pub fn inside(dir: &Path, path: &str) -> Result<PathBuf, String> {
    let root = dir.canonicalize().map_err(|e| e.to_string())?;
    let target = Path::new(path).canonicalize().map_err(|_| "That file no longer exists.".to_string())?;
    if target.starts_with(&root) {
        Ok(target)
    } else {
        Err("That file is outside the Movie Arena library.".into())
    }
}

/// Bytes written so far for a download in progress. Chromium-based webviews
/// write to `<name>.crdownload` and rename at the end; the app's own
/// downloader writes to `<name>.crdownload` for files and `<name>.part` for
/// offline streams.
pub fn written(path: &Path) -> u64 {
    let partial_file = PathBuf::from(format!("{}.crdownload", path.display()));
    let partial_dir = PathBuf::from(format!("{}.part", path.display()));
    let mut total = [path.to_path_buf(), partial_file]
        .iter()
        .filter_map(|p| std::fs::metadata(p).ok())
        .map(|m| m.len())
        .max()
        .unwrap_or(0);
    if partial_dir.is_dir() {
        total = total.max(dir_size(&partial_dir));
    }
    total
}

/// Delete a library item, which is either a file or an offline stream folder.
pub fn remove(path: &Path) -> Result<(), String> {
    if path.is_dir() {
        std::fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(path).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_sanitized() {
        assert_eq!(safe_name("../../etc/passwd"), "passwd");
        assert_eq!(safe_name(r"C:\x\Movie: Part 1?.mp4"), "Movie_ Part 1_.mp4");
        assert_eq!(safe_name("  .hidden.mkv. "), "hidden.mkv");
        assert_eq!(safe_name(""), "video");
    }

    #[test]
    fn only_media_downloads_are_allowed() {
        assert!(download_allowed("Film.MP4"));
        assert!(download_allowed("subs.srt"));
        assert!(!download_allowed("setup.exe"));
        assert!(!download_allowed("player.mp4.exe"));
        assert!(!download_allowed("video"));
    }

    #[test]
    fn inside_rejects_escapes() {
        let root = std::env::temp_dir().join(format!("ma-lib-{}", std::process::id()));
        std::fs::create_dir_all(root.join("sub")).unwrap();
        std::fs::write(root.join("sub/a.mp4"), b"x").unwrap();
        assert!(inside(&root, root.join("sub/a.mp4").to_str().unwrap()).is_ok());
        assert!(inside(&root, root.join("sub/../../").to_str().unwrap()).is_err());
        assert_eq!(unique(&root.join("sub"), "a.mp4"), root.join("sub/a (2).mp4"));
        std::fs::remove_dir_all(root).unwrap();
    }
}
