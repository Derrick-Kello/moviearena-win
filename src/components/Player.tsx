import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  Download as SaveIcon,
  ExternalLink,
  FastForward,
  Heart,
  Maximize2,
  Minimize2,
  RotateCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { Wordmark } from "./Wordmark";
import { litVars } from "./ChannelCard";
import { isNative, on, openExternal, player, popupMenu, type Bounds, type MenuEntry } from "../lib/native";
import { hostOf } from "../lib/store";
import { formatBytes, media, titleOf, type Download, type MediaItem, type MediaPayload } from "../lib/library";
import { ALL_CATEGORIES, CATEGORY_TITLES, type Site } from "../lib/types";

interface Props {
  site: Site;
  sites: Site[];
  blocked: number;
  bump: number;
  covered: boolean;
  onClose: () => void;
  onSwitch: (site: Site) => void;
  onToggleFavorite: (site: Site) => void;
  onShield: () => void;
  downloads: Download[];
  onOpenDownload: (path: string) => void;
}

interface Held {
  url: string;
  host: string;
}


function rectOf(el: HTMLElement): Bounds {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

export function Player({
  site,
  sites,
  blocked,
  bump,
  covered,
  onClose,
  onSwitch,
  onToggleFavorite,
  onShield,
  downloads,
  onOpenDownload,
}: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const sourceBtn = useRef<HTMLButtonElement>(null);
  const saveBtn = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(true);
  const [pageUrl, setPageUrl] = useState(site.url);
  const [history, setHistory] = useState({ canGoBack: !isNative || !/Windows/.test(navigator.userAgent), canGoForward: !isNative || !/Windows/.test(navigator.userAgent) });
  const [held, setHeld] = useState<Held | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [hiddenDownload, setHiddenDownload] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [immersive, setImmersive] = useState(false);

  // Open (or retarget) the native webview whenever the chosen site changes.
  useLayoutEffect(() => {
    if (!stage.current) return;
    setLoading(true);
    setPageUrl(site.url);
    setHeld(null);
    setMediaItems([]);
    player.open(site.url, rectOf(stage.current)).catch((e) => console.error("Could not open player", e));
  }, [site.id, site.url]);

  // Close the webview when leaving the theater.
  useEffect(() => () => void player.close(), []);

  // Keep the native webview glued to the stage element.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => player.bounds(rectOf(el)));
    };
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  // Native webviews draw above HTML, so hide it while a dialog is up.
  useEffect(() => {
    player.visible(!covered);
  }, [covered]);

  useEffect(() => {
    const offs = [
      on<{ loading: boolean; url: string }>("player:load", (p) => {
        setLoading(p.loading);
        setPageUrl(p.url);
        if (p.loading) setMediaItems([]);
      }),
      on<{ canGoBack: boolean; canGoForward: boolean }>("player:history", setHistory),
      on<{ kind: string; url: string; host: string }>("player:blocked", (p) => {
        if (p.kind === "window") setHeld({ url: p.url, host: p.host });
        // For downloads the backend sends the file name in `url`.
        if (p.kind === "download") setRefused(p.url);
      }),
      on<{ active: boolean }>("player:fullscreen", (p) => {
        setImmersive(p.active);
        setFullscreen(p.active);
      }),
      on<MediaPayload>("player:media", (p) => setMediaItems(p.items)),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  useEffect(() => {
    if (!refused) return;
    const t = window.setTimeout(() => setRefused(null), 8000);
    return () => window.clearTimeout(t);
  }, [refused]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const latest = downloads[0] && downloads[0].path !== hiddenDownload ? downloads[0] : null;

  // Let a held-window notice fade after a while.
  useEffect(() => {
    if (!held) return;
    const t = window.setTimeout(() => setHeld(null), 12000);
    return () => window.clearTimeout(t);
  }, [held]);

  const toggleFullscreen = useCallback(() => {
    const next = !fullscreen;
    setFullscreen(next);
    if (!next) setImmersive(false);
    player.fullscreen(next);
  }, [fullscreen]);

  // Shortcuts while the toolbar has focus. The page itself keeps its own keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (covered) return;
      if (e.altKey && e.key === "ArrowLeft") player.command("back");
      else if (e.altKey && e.key === "ArrowRight") player.command("forward");
      else if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r")) {
        e.preventDefault();
        player.command("reload");
      } else if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "Escape" && fullscreen) toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [covered, fullscreen, toggleFullscreen]);

  const openSwitcher = async () => {
    const r = sourceBtn.current?.getBoundingClientRect();
    const entry = (s: Site): MenuEntry => ({
      kind: "check",
      text: s.name,
      checked: s.id === site.id,
      action: () => s.id !== site.id && onSwitch(s),
    });
    const favorites = sites.filter((s) => s.isFavorite);
    const groups: Site[][] = [
      favorites,
      ...ALL_CATEGORIES.map((c) => sites.filter((s) => s.category === c && !s.isFavorite)),
    ].filter((g) => g.length);
    const entries: MenuEntry[] = [];
    groups.forEach((g, i) => {
      if (i > 0) entries.push({ kind: "separator" });
      const label = i === 0 && favorites.length ? "Favorites" : CATEGORY_TITLES[g[0].category];
      entries.push({ kind: "item", text: label, enabled: false, action: () => {} });
      g.forEach((s) => entries.push(entry(s)));
    });
    await popupMenu(entries, r ? { x: r.left, y: r.bottom + 4 } : undefined);
  };

  const saveVideo = async () => {
    if (!mediaItems.length) {
      setNotice("No video found yet. Start playing, then try Save again.");
      return;
    }
    const r = saveBtn.current?.getBoundingClientRect();
    const entries: MenuEntry[] = [
      { kind: "item", text: "Only download what you have the right to", enabled: false, action: () => {} },
      { kind: "separator" },
      ...mediaItems.map((m) => {
        let host = "";
        try {
          host = new URL(m.url).host;
        } catch {
          // A relative or unusual address; the name is enough.
        }
        const label = m.kind === "hls" ? "Stream" : m.kind === "dash" ? "DASH (not supported)" : "Video";
        return {
          kind: "item" as const,
          text: `${label} · ${titleOf(m.name)}${host ? ` (${host})` : ""}`,
          enabled: m.kind !== "dash",
          action: () => {
            media
              .download(m)
              .catch((e) => setNotice(`Couldn't start the download: ${String(e)}`));
          },
        };
      }),
    ];
    await popupMenu(entries, r ? { x: r.left, y: r.bottom + 4 } : undefined);
  };

  const host = hostOf(pageUrl);

  return (
    <div className={`player${immersive ? " immersive" : ""}`} role="region" aria-label={`${site.name} player`}>
      <div className="player-bar" data-tauri-drag-region>
        <button className="back-btn" onClick={onClose} title="Back to Movie Arena">
          <ChevronLeft size={16} aria-hidden /> Arena
        </button>
        <span className="sep" aria-hidden />
        <button
          className="icon-btn"
          onClick={() => player.command("back")}
          disabled={!history.canGoBack}
          aria-label="Back"
          title="Back (Alt+Left)"
        >
          <ArrowLeft size={16} />
        </button>
        <button
          className="icon-btn"
          onClick={() => player.command("forward")}
          disabled={!history.canGoForward}
          aria-label="Forward"
          title="Forward (Alt+Right)"
        >
          <ArrowRight size={16} />
        </button>
        <button
          className="icon-btn"
          onClick={() => player.command(loading ? "stop" : "reload")}
          aria-label={loading ? "Stop loading" : "Reload"}
          title={loading ? "Stop" : "Reload (F5)"}
        >
          {loading ? <X size={16} /> : <RotateCw size={15} />}
        </button>

        <button className="source" ref={sourceBtn} onClick={openSwitcher} aria-haspopup="menu" title="Switch source">
          <span className="source-mark" style={litVars(site)} aria-hidden>
            <span className="lit" />
            <span className="wordmark-wrap">
              <Wordmark name={site.name} fill={0.8} />
            </span>
          </span>
          <span className="source-text">
            <span className="source-name">
              {site.name} <ChevronDown size={13} aria-hidden />
            </span>
            <span className="source-host">{host}</span>
          </span>
        </button>
        {loading && <span className="spinner" role="status" aria-label="Loading" />}

        <span className="grow" />

        {refused && (
          <span className="held" role="status">
            Blocked <b>{refused}</b>, not a video file
          </span>
        )}
        {notice && (
          <span className="held" role="status">
            {notice}
            <button
              className="icon-btn"
              style={{ width: 24, height: 24 }}
              onClick={() => setNotice(null)}
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </span>
        )}
        {latest && (
          <span className={`held dl ${latest.state}`} role="status">
            {latest.state === "saving" ? (
              <span className="spinner" aria-hidden />
            ) : latest.state === "done" ? (
              <Check size={14} className="dl-ok" aria-hidden />
            ) : (
              <CircleAlert size={14} className="dl-fail" aria-hidden />
            )}
            {latest.state === "saving" ? "Saving" : latest.state === "done" ? "Saved" : "Stopped"}{" "}
            <b>{titleOf(latest.name)}</b>
            {latest.state === "saving" && latest.written > 0 && <span>{formatBytes(latest.written)}</span>}
            {latest.state === "done" && (
              <button className="link" onClick={() => onOpenDownload(latest.path)}>
                Watch
              </button>
            )}
            {latest.state !== "saving" && (
              <button
                className="icon-btn"
                style={{ width: 24, height: 24 }}
                onClick={() => setHiddenDownload(latest.path)}
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>
            )}
          </span>
        )}
        {held && (
          <span className="held" role="status">
            Held a new window to <b>{held.host}</b>
            <button
              className="link"
              onClick={() => {
                player.navigate(held.url);
                setHeld(null);
              }}
            >
              Open here
            </button>
            <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setHeld(null)} aria-label="Dismiss">
              <X size={13} />
            </button>
          </span>
        )}

        <button
          ref={saveBtn}
          className="pill-btn"
          onClick={saveVideo}
          title="Save the video you're watching for offline viewing"
        >
          <SaveIcon size={14} aria-hidden />
          <span className="bar-label">Save</span>
          {mediaItems.length > 0 && <span className="count">{mediaItems.length}</span>}
        </button>
        <button className="skip-btn" onClick={() => player.command("skip")} title="Skip the ad that's playing now">
          <FastForward size={13} fill="currentColor" strokeWidth={0} aria-hidden /> Skip ad
        </button>
        <button className="pill-btn" onClick={onShield} title="Ad-Shield settings and activity">
          <ShieldCheck size={14} className="shield-icon" aria-hidden />
          <span className="bar-label">Shield</span>
          <span className={`count${bump ? " bump" : ""}`} key={bump}>
            {blocked}
          </span>
        </button>
        <span className="sep" aria-hidden />
        <button
          className={`icon-btn${site.isFavorite ? " on" : ""}`}
          onClick={() => onToggleFavorite(site)}
          aria-pressed={site.isFavorite}
          aria-label={site.isFavorite ? "Remove from favorites" : "Add to favorites"}
          title={site.isFavorite ? "In favorites" : "Add to favorites"}
        >
          <Heart size={15} />
        </button>
        <button
          className="icon-btn"
          onClick={() => openExternal(pageUrl)}
          aria-label="Open in browser"
          title="Open this page in your browser"
        >
          <ExternalLink size={15} />
        </button>
        <button
          className="icon-btn"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? "Exit full screen" : "Full screen"}
          title={fullscreen ? "Exit full screen (Esc)" : "Full screen (F11)"}
        >
          {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        {loading && <div className="progress" aria-hidden />}
      </div>

      <div className="stage" ref={stage}>
        {/* Visible until the native webview paints over it, and in browser preview. */}
        <div className="stage-placeholder" style={litVars(site)}>
          <div className="lit" />
          <Wordmark name={site.name} fill={0.4} max={9} />
          <p>
            {isNative ? (
              <>
                <span className="spinner" aria-hidden /> Connecting to {hostOf(site.url)}
              </>
            ) : (
              "Preview mode. In the desktop app the site plays here."
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
