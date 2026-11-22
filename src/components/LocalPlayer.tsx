import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { ChevronLeft, ExternalLink, FolderOpen, Maximize2, Minimize2 } from "lucide-react";
import { library, positions, titleOf, type LibraryItem } from "../lib/library";
import { player as nativeWindow } from "../lib/native";

interface Props {
  item: LibraryItem;
  onClose: () => void;
}

/** Plays a downloaded file inside the app, offline, resuming where the viewer stopped. */
export function LocalPlayer({ item, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const isHls = item.kind === "hls";
  const title = titleOf(item.name);

  // Resume, then save the position every few seconds and on exit.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let last = 0;
    const save = () => {
      if (!v.duration || !isFinite(v.duration)) return;
      // Finished, or barely started: nothing worth resuming.
      const done = v.currentTime > v.duration - 30 || v.currentTime < 10;
      positions.set(item.path, done ? null : { t: v.currentTime, d: v.duration });
    };
    const onLoaded = () => {
      const pos = positions.get(item.path);
      if (pos && pos.t < v.duration - 30) v.currentTime = pos.t;
      v.play().catch(() => {});
    };
    const onTime = () => {
      if (Math.abs(v.currentTime - last) > 5) {
        last = v.currentTime;
        save();
      }
    };
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("pause", save);
    v.addEventListener("ended", save);
    return () => {
      save();
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("pause", save);
      v.removeEventListener("ended", save);
    };
  }, [item.path]);

  // Offline HLS streams are a folder with a rewritten playlist. hls.js reads
  // it through the asset protocol, so playback matches the site.
  useEffect(() => {
    const v = video.current;
    if (!v || !isHls) return;
    const src = `${library.src(item.path)}/index.m3u8`;
    let disposed = false;
    let hls: Hls | null = null;
    import("hls.js")
      .then(({ default: Hls }) => {
        if (disposed) return;
        if (Hls.isSupported()) {
          const instance = new Hls({ enableWorker: true });
          hls = instance;
          instance.loadSource(src);
          instance.attachMedia(v);
          instance.on(Hls.Events.MANIFEST_PARSED, () => v.play().catch(() => {}));
          instance.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) setFailed(true);
          });
        } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
          v.src = src;
          v.play().catch(() => {});
        } else {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      hls?.destroy();
    };
  }, [item.path, isHls]);

  const toggleFullscreen = () => {
    const next = !fullscreen;
    setFullscreen(next);
    nativeWindow.fullscreen(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = video.current;
      if (e.key === "Escape") {
        e.preventDefault();
        if (fullscreen) toggleFullscreen();
        else onClose();
      } else if (e.key === "F11" || e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      } else if (v && e.target === document.body) {
        // Controls when focus isn't already on the video element.
        if (e.key === " ") {
          e.preventDefault();
          if (v.paused) v.play();
          else v.pause();
        } else if (e.key === "ArrowRight") v.currentTime += 10;
        else if (e.key === "ArrowLeft") v.currentTime -= 10;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Leave window fullscreen if the player closes while in it.
  useEffect(() => () => void nativeWindow.fullscreen(false), []);

  return (
    <div className={`player local${fullscreen ? " immersive" : ""}`} role="region" aria-label={`${title} player`}>
      <div className="player-bar" data-tauri-drag-region>
        <button className="back-btn" onClick={onClose} title="Back to Downloads (Esc)">
          <ChevronLeft size={16} aria-hidden /> Downloads
        </button>
        <span className="sep" aria-hidden />
        <div className="source-text local-title">
          <span className="source-name">{title}</span>
          <span className="source-host">Offline · saved on this computer</span>
        </div>
        <span className="grow" />
        {!isHls && (
          <button className="pill-btn" onClick={() => library.playExternally(item.path)} title="Open in your system video player">
            <ExternalLink size={14} aria-hidden /> <span className="bar-label">System player</span>
          </button>
        )}
        <button className="icon-btn" onClick={() => library.reveal(item.path)} aria-label="Show in folder" title="Show in folder">
          <FolderOpen size={15} />
        </button>
        <button
          className="icon-btn"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? "Exit full screen" : "Full screen"}
          title={fullscreen ? "Exit full screen (Esc)" : "Full screen (F)"}
        >
          {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>
      <div className="stage">
        {failed ? (
          <div className="stage-placeholder">
            <p className="local-error">
              {isHls
                ? "This offline stream couldn't be opened. The folder may be incomplete."
                : "This file's format can't play inside Movie Arena. Your system video player can usually open it."}
            </p>
            {isHls ? (
              <button className="primary-btn" onClick={onClose}>
                Back to Downloads
              </button>
            ) : (
              <button className="primary-btn" onClick={() => library.playExternally(item.path)}>
                <ExternalLink size={14} aria-hidden /> Play in system player
              </button>
            )}
          </div>
        ) : (
          <video
            ref={video}
            className="local-video"
            src={isHls ? undefined : library.src(item.path)}
            controls
            autoPlay
            onError={() => setFailed(true)}
            onDoubleClick={toggleFullscreen}
          />
        )}
      </div>
    </div>
  );
}
