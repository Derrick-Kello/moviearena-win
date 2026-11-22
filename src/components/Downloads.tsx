import { useState, type CSSProperties } from "react";
import { CircleAlert, Download, Ellipsis, FolderOpen, Play, X } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { accentFor } from "../lib/catalog";
import { formatBytes, library, positions, titleOf, type Download as DownloadItem, type LibraryItem } from "../lib/library";
import { popupMenu, type MenuEntry } from "../lib/native";

export const DISCLAIMER =
  "Movie Arena doesn't host, upload or provide any movies. It opens third-party websites, and those sites are responsible for what they show. Many free streaming sites carry films and shows without the rights holder's permission. Only watch and download what you have the right to under the laws where you live. You are responsible for how you use this app.";

interface Props {
  items: LibraryItem[] | null;
  downloads: DownloadItem[];
  onPlay: (item: LibraryItem) => void;
  onDelete: (item: LibraryItem) => void;
  onDismiss: (path: string) => void;
}

const dateFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

export function Downloads({ items, downloads, onPlay, onDelete, onDismiss }: Props) {
  const inFlight = downloads.filter((d) => d.state !== "done");
  const count = items?.length ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Downloads</h1>
          <p className="page-sub">Videos saved on this computer. They play here without internet.</p>
        </div>
        {count > 0 && (
          <span className="page-count">
            {count} {count === 1 ? "video" : "videos"}
          </span>
        )}
        <button className="ghost-btn" onClick={() => library.openFolder()}>
          <FolderOpen size={14} aria-hidden /> Open folder
        </button>
      </div>

      {inFlight.length > 0 && (
        <section className="transfers" aria-label="Downloads in progress">
          {inFlight.map((d) => (
            <div className={`transfer ${d.state}`} key={d.path}>
              {d.state === "saving" ? (
                <span className="spinner" aria-hidden />
              ) : (
                <CircleAlert size={16} className="transfer-fail" aria-hidden />
              )}
              <div className="transfer-text">
                <b>{titleOf(d.name)}</b>
                <span>
                  {d.state === "saving"
                    ? d.written
                      ? `${formatBytes(d.written)} saved`
                      : "Starting download"
                    : d.error ?? "The download stopped. Try again from the site."}
                </span>
              </div>
              {d.state === "saving" && <div className="transfer-bar" aria-hidden />}
              {d.state === "failed" && (
                <button className="icon-btn" onClick={() => onDismiss(d.path)} aria-label="Dismiss">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {items === null ? null : count ? (
        <div className="grid">
          {items.map((item) => (
            <VideoCard key={item.path} item={item} onPlay={onPlay} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <Download size={28} strokeWidth={1.5} color="var(--fg-3)" aria-hidden />
          <h2>No downloads yet</h2>
          <p>
            While a video is playing, use Save in the player toolbar. Files a site offers land here too, and you can
            put your own videos in the folder.
          </p>
          <div className="actions">
            <button className="ghost-btn" onClick={() => library.openFolder()}>
              <FolderOpen size={14} aria-hidden /> Open the Downloads folder
            </button>
          </div>
        </div>
      )}

      <p className="disclaimer">{DISCLAIMER}</p>
    </>
  );
}

function VideoCard({ item, onPlay, onDelete }: { item: LibraryItem } & Pick<Props, "onPlay" | "onDelete">) {
  const isHls = item.kind === "hls";
  const [thumbFailed, setThumbFailed] = useState(isHls);
  const title = titleOf(item.name);
  const [a, b] = accentFor(title);
  const pos = positions.get(item.path);
  const progress = pos && pos.d ? Math.min(pos.t / pos.d, 1) : 0;

  const menu = (at: { x: number; y: number }) => {
    const entries: MenuEntry[] = [
      { kind: "item", text: pos ? "Resume" : "Play", action: () => onPlay(item) },
      ...(isHls
        ? []
        : [
            {
              kind: "item" as const,
              text: "Play in system player",
              action: () => library.playExternally(item.path),
            },
          ]),
      { kind: "item", text: "Show in folder", action: () => library.reveal(item.path) },
      { kind: "separator" },
      { kind: "item", text: "Delete from computer…", action: () => onDelete(item) },
    ];
    popupMenu(entries, at);
  };

  return (
    <article
      className="card"
      onContextMenu={(e) => {
        e.preventDefault();
        menu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="tile" style={{ "--a": a, "--b": b } as CSSProperties}>
        <div className="lit" />
        <div className="wordmark-wrap">
          <Wordmark name={title} fill={0.8} max={14} />
        </div>
        {!thumbFailed && (
          // A frame from a minute in stands in for a poster. Offline streams
          // have no single file to point a video element at.
          <video
            className="thumb"
            src={`${library.src(item.path)}#t=60`}
            preload="metadata"
            muted
            playsInline
            onError={() => setThumbFailed(true)}
            aria-hidden
          />
        )}
        <div className="sheen" />
        <button className="tile-button" onClick={() => onPlay(item)} aria-label={`${pos ? "Resume" : "Play"} ${title}`} />
        <span className="play-badge" aria-hidden>
          <Play size={16} fill="currentColor" strokeWidth={0} />
        </span>
        {progress > 0 && (
          <div className="resume" aria-label={`${Math.round(progress * 100)}% watched`}>
            <i style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
      <div className="caption">
        <div className="caption-text">
          <div className="caption-name" title={item.name}>
            {title}
          </div>
          <div className="caption-sub">
            {isHls ? "Offline stream · " : ""}
            {formatBytes(item.size)} · {dateFmt.format(item.modified)}
          </div>
        </div>
        <button
          className="icon-btn"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            menu({ x: r.left, y: r.bottom + 4 });
          }}
          aria-label={`More options for ${title}`}
          title="More"
        >
          <Ellipsis size={16} />
        </button>
      </div>
    </article>
  );
}
