import { memo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Heart, Pencil, Star } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { FEATURE_LABELS, type Site } from "../lib/types";
import { hostOf } from "../lib/store";

const reduceMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function litVars(site: Pick<Site, "accent" | "secondary">): CSSProperties {
  return { "--a": site.accent, "--b": site.secondary } as CSSProperties;
}

export interface CardHandlers {
  onOpen: (site: Site) => void;
  onToggleFavorite: (site: Site) => void;
  onMenu: (site: Site, at: { x: number; y: number }) => void;
  onEdit: (site: Site) => void;
}

interface Props extends CardHandlers {
  site: Site;
}

export const ChannelCard = memo(function ChannelCard({ site, onOpen, onToggleFavorite, onMenu, onEdit }: Props) {
  const tile = useRef<HTMLDivElement>(null);
  const [pop, setPop] = useState(false);

  // tvOS-style focus: the tile tilts toward the pointer and a sheen follows it.
  const move = (e: PointerEvent) => {
    const el = tile.current;
    if (!el || reduceMotion) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    el.style.setProperty("--ry", `${((px - 0.5) * 7).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${((0.5 - py) * 6).toFixed(2)}deg`);
  };
  const leave = () => {
    const el = tile.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  const fav = () => {
    if (!site.isFavorite) {
      setPop(true);
      window.setTimeout(() => setPop(false), 450);
    }
    onToggleFavorite(site);
  };

  return (
    <article
      className="card"
      onPointerMove={move}
      onPointerLeave={leave}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(site, { x: e.clientX, y: e.clientY });
      }}
    >
      <div className="tile" ref={tile} style={litVars(site)}>
        <div className="lit" />
        <div className="wordmark-wrap">
          <Wordmark name={site.name} />
        </div>
        <div className="sheen" />
        <button
          className="tile-button"
          onClick={() => onOpen(site)}
          aria-label={`Stream ${site.name}`}
          title={hostOf(site.url)}
        />
        <div className="tile-top">
          <span className="chip" aria-label={`Rated ${site.rating.toFixed(1)} out of 5`}>
            <Star size={10} strokeWidth={0} fill="currentColor" aria-hidden />
            {site.rating.toFixed(1)}
          </span>
          <button
            className={`fav${site.isFavorite ? " on" : ""}${pop ? " pop" : ""}`}
            onClick={fav}
            aria-pressed={site.isFavorite}
            aria-label={site.isFavorite ? `Remove ${site.name} from favorites` : `Add ${site.name} to favorites`}
          >
            <Heart size={13} strokeWidth={2.4} />
          </button>
        </div>
        <div className="tile-bottom">
          {site.features.slice(0, 2).map((f) => (
            <span key={f} className="chip tag">
              {FEATURE_LABELS[f]}
            </span>
          ))}
          {site.isCustom && <span className="chip custom">MY LINK</span>}
        </div>
      </div>
      <div className="caption">
        <div className="caption-text">
          <div className="caption-name">{site.name}</div>
          <div className="caption-sub">{site.summary}</div>
        </div>
        {site.isCustom && (
          <button className="icon-btn" onClick={() => onEdit(site)} aria-label={`Edit ${site.name}`} title="Edit link">
            <Pencil size={14} />
          </button>
        )}
      </div>
    </article>
  );
});
