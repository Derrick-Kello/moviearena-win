import { useState } from "react";
import { ChevronLeft, ChevronRight, Heart, Play, ShieldCheck, Star } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { litVars } from "./ChannelCard";
import { CATEGORY_TITLES, FEATURE_LABELS, type Site } from "../lib/types";
import { FEATURE_ICONS } from "../lib/icons";
import { hostOf } from "../lib/store";

const reduceMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const DWELL_MS = 8000;
const MAX_DOTS = 7;

interface Props {
  sites: Site[];
  shieldOn: boolean;
  paused?: boolean;
  onOpen: (site: Site) => void;
  onToggleFavorite: (site: Site) => void;
}

export function Billboard({ sites, shieldOn, paused, onOpen, onToggleFavorite }: Props) {
  const [index, setIndex] = useState(0);
  const count = Math.min(sites.length, MAX_DOTS);
  if (!count) return null;
  const i = index % count;
  const site = sites[i];
  const go = (n: number) => setIndex((n + count) % count);

  return (
    <section className={`billboard${paused ? " paused" : ""}`} aria-roledescription="carousel" aria-label="Top picks" style={litVars(site)}>
      {/* Keyed so each pick fades in as a new scene. */}
      <div className="billboard-art" key={`art-${site.id}`} aria-hidden>
        <div className="lit" />
        <Wordmark name={site.name} className="giant" fixedSize="inherit" />
      </div>

      <div className="billboard-copy" key={`copy-${site.id}`} aria-live="polite">
        <Wordmark name={site.name} as="h2" className="billboard-title" fixedSize="inherit" />
        <div className="billboard-meta">
          <span>{CATEGORY_TITLES[site.category]}</span>
          <span>
            <Star size={12} strokeWidth={0} fill="currentColor" aria-hidden />
            {site.rating.toFixed(1)}
          </span>
          <span>{hostOf(site.url)}</span>
          {shieldOn && (
            <span className="ok">
              <ShieldCheck size={14} aria-hidden /> Ad-Shield on
            </span>
          )}
        </div>
        <p className="billboard-summary">{site.summary}</p>
        <div className="chips" aria-label="Features">
          {site.features.map((f) => {
            const Icon = FEATURE_ICONS[f];
            return (
              <span key={f} className="chip tag">
                <Icon size={11} aria-hidden /> {FEATURE_LABELS[f]}
              </span>
            );
          })}
        </div>
        <div className="billboard-actions">
          <button className="capsule solid" onClick={() => onOpen(site)}>
            <Play size={15} fill="currentColor" strokeWidth={0} aria-hidden /> Stream now
          </button>
          <button className="capsule frost" onClick={() => onToggleFavorite(site)} aria-pressed={site.isFavorite}>
            <Heart size={15} className={site.isFavorite ? "on" : undefined} aria-hidden />
            {site.isFavorite ? "In favorites" : "Add to favorites"}
          </button>
        </div>
      </div>

      {count > 1 && (
        <>
          <div className="billboard-nav">
            <button className="round" onClick={() => go(i - 1)} aria-label="Previous pick">
              <ChevronLeft size={16} />
            </button>
            <button className="round" onClick={() => go(i + 1)} aria-label="Next pick">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="billboard-dots" role="tablist" aria-label="Choose a pick">
            {sites.slice(0, count).map((s, n) => (
              <button
                key={s.id}
                className="dot"
                role="tab"
                aria-selected={n === i}
                aria-current={n === i}
                aria-label={s.name}
                onClick={() => go(n)}
                style={{ "--dwell": `${DWELL_MS}ms` } as React.CSSProperties}
              >
                {/* The fill animation is the timer: when it ends, advance. */}
                {n === i && !reduceMotion && <i key={site.id} onAnimationEnd={() => go(i + 1)} />}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
